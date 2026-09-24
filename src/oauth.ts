import { randomBytes } from "node:crypto";
import { sign, verify } from "hono/jwt";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { oauthAccounts, users } from "./db/schema";
import { getJwtSecret, hashPassword, issueAuthPair, type AuthPair } from "./auth";

export type OAuthProvider = "google" | "github";

export const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github"];

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

const PROVIDER_CONFIG: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
  },
};

function clientId(provider: OAuthProvider): string | undefined {
  return process.env[`${provider.toUpperCase()}_CLIENT_ID`];
}

function clientSecret(provider: OAuthProvider): string | undefined {
  return process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
}

export function isOAuthConfigured(provider: string): provider is OAuthProvider {
  if (!(OAUTH_PROVIDERS as string[]).includes(provider)) return false;
  const p = provider as OAuthProvider;
  return Boolean(clientId(p) && clientSecret(p));
}

export function redirectUri(provider: OAuthProvider): string {
  const base = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:4000";
  return `${base}/auth/${provider}/callback`;
}

export async function makeOAuthState(provider: OAuthProvider): Promise<string> {
  return sign(
    {
      provider,
      nonce: randomBytes(16).toString("hex"),
      exp: Math.floor(Date.now() / 1000) + 10 * 60,
    },
    getJwtSecret(),
    "HS256",
  );
}

export async function verifyOAuthState(
  state: string,
  provider: OAuthProvider,
): Promise<boolean> {
  try {
    const payload = (await verify(state, getJwtSecret(), "HS256")) as {
      provider?: string;
    };
    return payload.provider === provider;
  } catch {
    return false;
  }
}

export function buildAuthUrl(provider: OAuthProvider, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(provider) ?? "",
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: PROVIDER_CONFIG[provider].scope,
    state,
  });
  return `${PROVIDER_CONFIG[provider].authUrl}?${params.toString()}`;
}

export interface ProviderUser {
  id: string;
  email: string | null;
  name: string;
}

type FetchFn = typeof fetch;

export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  fetchFn: FetchFn = fetch,
): Promise<string> {
  const res = await fetchFn(PROVIDER_CONFIG[provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId(provider),
      client_secret: clientSecret(provider),
      code,
      redirect_uri: redirectUri(provider),
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const body = (await res.json()) as { access_token?: string; error?: string };
  if (!body.access_token) {
    throw new Error(`Token exchange failed: ${body.error ?? "no access token"}`);
  }
  return body.access_token;
}

export async function fetchProviderUser(
  provider: OAuthProvider,
  accessToken: string,
  fetchFn: FetchFn = fetch,
): Promise<ProviderUser> {
  if (provider === "google") {
    const res = await fetchFn("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Userinfo failed (${res.status})`);
    const body = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    if (!body.sub) throw new Error("Userinfo missing sub");
    return {
      id: body.sub,
      email: body.email ?? null,
      name: body.name ?? body.email ?? "Google User",
    };
  }
  const res = await fetchFn("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub user failed (${res.status})`);
  const body = (await res.json()) as {
    id?: number;
    email?: string | null;
    name?: string | null;
    login?: string;
  };
  if (body.id == null) throw new Error("GitHub user missing id");
  let email = body.email ?? null;
  if (!email) {
    const emailsRes = await fetchFn("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      email =
        emails.find((e) => e.primary && e.verified)?.email ??
        emails.find((e) => e.verified)?.email ??
        null;
    }
  }
  return {
    id: String(body.id),
    email,
    name: body.name ?? body.login ?? "GitHub User",
  };
}

export async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  info: ProviderUser,
): Promise<{ userId: string; created: boolean }> {
  const linked = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerId, info.id),
      ),
    );
  if (linked[0]) return { userId: linked[0].userId, created: false };

  const email = info.email?.trim().toLowerCase() ?? null;
  let userId: string | null = null;
  if (email) {
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing[0]) userId = existing[0].id;
  }
  let created = false;
  if (!userId) {
    const [user] = await db
      .insert(users)
      .values({
        email: email ?? `${provider}-${info.id}@oauth.local`,
        name: info.name,
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      })
      .returning();
    userId = user.id;
    created = true;
  }
  await db
    .insert(oauthAccounts)
    .values({ userId, provider, providerId: info.id, email })
    .onConflictDoNothing();
  return { userId, created };
}

export async function completeOAuthLogin(
  provider: OAuthProvider,
  code: string,
  fetchFn: FetchFn = fetch,
): Promise<{ pair: AuthPair; userId: string; created: boolean }> {
  const accessToken = await exchangeCode(provider, code, fetchFn);
  const info = await fetchProviderUser(provider, accessToken, fetchFn);
  const { userId, created } = await findOrCreateOAuthUser(provider, info);
  const rows = await db.select().from(users).where(eq(users.id, userId));
  const pair = await issueAuthPair(rows[0]!);
  return { pair, userId, created };
}
