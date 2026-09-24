import type { Context } from "hono";
import { ApolloServer, HeaderMap } from "@apollo/server";
import { userFromAuthHeader } from "./auth";
import { createLoaders } from "./loaders";
import type { GraphQLContext } from "./schema";

function iteratorToStream(
  iterator: AsyncIterableIterator<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(value));
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

export function slowOpThresholdMs(): number {
  return Number(process.env.SLOW_OP_MS ?? 1000);
}

function describeBody(body: unknown): { operationName: string | null; preview: string } {
  if (body !== null && typeof body === "object" && !Array.isArray(body)) {
    const rec = body as Record<string, unknown>;
    const query = typeof rec.query === "string" ? rec.query : "";
    return {
      operationName: typeof rec.operationName === "string" ? rec.operationName : null,
      preview: query.replace(/\s+/g, " ").slice(0, 120),
    };
  }
  return { operationName: null, preview: "" };
}

/**
 * Hono handler for Apollo Server 5.
 * Mount with: app.all("/graphql/*", handler) + app.all("/graphql", handler)
 */
export function graphqlHonoHandler(server: ApolloServer<GraphQLContext>) {
  return async (c: Context) => {
    server.assertStarted("graphqlHonoHandler()");
    const startedAt = Date.now();

    const headers = new HeaderMap();
    c.req.raw.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    let body: unknown;
    const method = c.req.method.toUpperCase();
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const contentType = c.req.header("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          body = await c.req.json();
        } catch {
          body = undefined;
        }
      } else {
        // Let Apollo return a proper error for unsupported content-types
        // (important for CSRF prevention).
        body = undefined;
      }
    }

    const search = new URL(c.req.url).search ?? "";

    const httpGraphQLRequest = { method, headers, body, search };

    const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context: async (): Promise<GraphQLContext> => {
        const loaders = createLoaders(null);
        const user = await userFromAuthHeader(headers.get("authorization"));
        if (!user) return { user: null, loaders };
        // Loaders are user-scoped (favorites, shelf, likedByMe).
        return { user, loaders: createLoaders(user.id) };
      },
    });

    const elapsedMs = Date.now() - startedAt;
    const threshold = slowOpThresholdMs();
    if (elapsedMs > threshold) {
      const { operationName, preview } = describeBody(body);
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "slow GraphQL operation",
          method,
          operationName,
          preview,
          elapsedMs,
          status: httpGraphQLResponse.status ?? 200,
        }),
      );
    }

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of httpGraphQLResponse.headers) {
      responseHeaders[key] = value;
    }

    const status = httpGraphQLResponse.status ?? 200;

    if (httpGraphQLResponse.body.kind === "complete") {
      return new Response(httpGraphQLResponse.body.string, {
        status,
        headers: responseHeaders,
      });
    }

    return new Response(
      iteratorToStream(httpGraphQLResponse.body.asyncIterator),
      { status, headers: responseHeaders },
    );
  };
}
