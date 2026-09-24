import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
  Observable,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";

const uri =
  import.meta.env.VITE_GRAPHQL_URL ??
  (import.meta.env.DEV ? "/graphql" : "http://localhost:4000/graphql");

export const ACCESS_KEY = "gql-token";
export const REFRESH_KEY = "gql-refresh";

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem(ACCESS_KEY);
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return null;
  try {
    const res = await fetch(uri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation($t: String!) {
          refreshToken(token: $t) { token refreshToken }
        }`,
        variables: { t: rt },
      }),
    });
    const json = await res.json();
    const pair = json?.data?.refreshToken as
      | { token: string; refreshToken: string }
      | undefined;
    if (!pair?.token) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      return null;
    }
    localStorage.setItem(ACCESS_KEY, pair.token);
    localStorage.setItem(REFRESH_KEY, pair.refreshToken);
    return pair.token;
  } catch {
    return null;
  }
}

const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  const unauth = graphQLErrors?.some(
    (e) => (e.extensions as { code?: string } | undefined)?.code === "UNAUTHENTICATED",
  );
  if (!unauth || operation.getContext().retried) return;
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return new Observable((observer) => {
    refreshing!
      .then((token) => {
        if (!token) {
          observer.error(new Error("Session expired. Please log in again."));
          return;
        }
        operation.setContext(({ headers }: { headers?: Record<string, string> }) => ({
          headers: { ...headers, Authorization: `Bearer ${token}` },
          retried: true,
        }));
        forward(operation).subscribe({
          next: (v) => observer.next(v),
          error: (e) => observer.error(e),
          complete: () => observer.complete(),
        });
      })
      .catch((e) => observer.error(e));
  });
});

export const client = new ApolloClient({
  link: from([errorLink, authLink, new HttpLink({ uri })]),
  cache: new InMemoryCache(),
});
