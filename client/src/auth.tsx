import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { GET_ME, LOGIN, LOGOUT, LOGOUT_ALL, REGISTER } from "./queries";
import { ACCESS_KEY, REFRESH_KEY, client } from "./apollo-client";
import type {
  GetMeQuery,
  LoginMutation,
  LoginMutationVariables,
  RegisterMutation,
  RegisterMutationVariables,
} from "./types/__generated__/graphql";

interface AuthState {
  token: string | null;
  user: GetMeQuery["me"];
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  setSession: (token: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  authLoading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(ACCESS_KEY),
  );
  const { data, loading, refetch } = useQuery<GetMeQuery>(GET_ME, {
    skip: !token,
  });
  const [doLogin] = useMutation<LoginMutation, LoginMutationVariables>(LOGIN);
  const [doRegister] = useMutation<RegisterMutation, RegisterMutationVariables>(
    REGISTER,
  );
  const [doLogout] = useMutation(LOGOUT);
  const [doLogoutAll] = useMutation(LOGOUT_ALL);

  const save = useCallback(
    async (t: string, rt: string) => {
      localStorage.setItem(ACCESS_KEY, t);
      localStorage.setItem(REFRESH_KEY, rt);
      setToken(t);
      await refetch();
    },
    [refetch],
  );

  // OAuth landing: backend redirects to /auth/callback#token=..&refresh=..
  // (or #error=..). Capture the pair once, then clean the URL.
  useEffect(() => {
    if (window.location.pathname === "/auth/callback") {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const t = params.get("token");
      const rt = params.get("refresh");
      const err = params.get("error");
      window.history.replaceState(null, "", "/");
      if (t && rt) {
        void save(t, rt);
      } else if (err) {
        console.error("OAuth failed:", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = useCallback(async () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(null);
    await client.clearStore();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await doLogin({ variables: { email, password } });
      const pair = res.data?.login;
      if (!pair?.token || !pair?.refreshToken) throw new Error("Login failed");
      await save(pair.token, pair.refreshToken);
    },
    [doLogin, save],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await doRegister({ variables: { email, password, name } });
      const pair = res.data?.register;
      if (!pair?.token || !pair?.refreshToken) throw new Error("Registration failed");
      await save(pair.token, pair.refreshToken);
    },
    [doRegister, save],
  );

  const logout = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    try {
      if (rt) await doLogout({ variables: { token: rt } });
    } finally {
      await clear();
    }
  }, [doLogout, clear]);

  const logoutAll = useCallback(async () => {
    try {
      await doLogoutAll();
    } finally {
      await clear();
    }
  }, [doLogoutAll, clear]);

  return (
    <AuthContext.Provider
      value={{ token, user: data?.me ?? null, login, register, setSession: save, logout, logoutAll, authLoading: loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
