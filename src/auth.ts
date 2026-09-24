import { createHash, randomBytes } from "node:crypto";
import { sign, verify } from "hono/jwt";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { refreshTokens, users, type User } from "./db/schema";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
if (!process.env.JWT_SECRET) {
  console.warn(
    "WARN: JWT_SECRET not set, using insecure dev default. Set JWT_SECRET in production.",
  );
}

export const ACCESS_TOKEN_TTL_S = Number(process.env.ACCESS_TOKEN_TTL_S ?? 900);
export const REFRESH_TOKEN_TTL_S = Number(
  process.env.REFRESH_TOKEN_TTL_S ?? 30 * 24 * 60 * 60,
);

export interface TokenPayload {
  sub: string;
  email: string;
  exp: number;
}

export interface AuthPair {
  token: string;
  refreshToken: string;
}

export async function hashPassword(password: string): Promise<string> {
  const cost = Number(process.env.BCRYPT_COST ?? 10);
  return Bun.password.hash(password, { algorithm: "bcrypt", cost });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function signToken(user: User, ttlS = ACCESS_TOKEN_TTL_S): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlS;
  return sign({ sub: user.id, email: user.email, exp }, JWT_SECRET, "HS256");
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueAuthPair(user: User): Promise<AuthPair> {
  const refreshToken = randomBytes(32).toString("hex");
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_S * 1000,
  });
  return { token: await signToken(user), refreshToken };
}

export async function rotateRefreshToken(
  presented: string,
): Promise<{ user: User; pair: AuthPair } | null> {
  const now = Date.now();
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented.trim())));
  const session = rows[0];
  if (!session || session.revokedAt != null || session.expiresAt <= now) {
    return null;
  }
  // Rotate: revoke the presented token before issuing replacements.
  await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(eq(refreshTokens.id, session.id));

  const userRows = await db.select().from(users).where(eq(users.id, session.userId));
  const user = userRows[0];
  if (!user) return null;
  return { user, pair: await issueAuthPair(user) };
}

export async function revokeRefreshToken(presented: string): Promise<boolean> {
  const rows = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented.trim())));
  if (!rows[0]) return false;
  await db
    .update(refreshTokens)
    .set({ revokedAt: Date.now() })
    .where(eq(refreshTokens.id, rows[0].id));
  return true;
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: Date.now() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
    );
}

/** Delete expired/revoked sessions. Run periodically (startup + daily). */
export async function pruneSessions(): Promise<number> {
  const now = Date.now();
  const stale = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(lt(refreshTokens.expiresAt, now - 7 * 24 * 60 * 60 * 1000));
  for (const row of stale) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
  }
  return stale.length;
}

export function getJwtSecret(): string {
  return JWT_SECRET;
}

/** Resolve the user for a REST endpoint from an Authorization header value. */
export async function userFromAuthHeader(auth: string | null | undefined): Promise<User | null> {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = (await verify(auth.slice(7), JWT_SECRET, "HS256")) as {
      sub?: string;
    };
    if (!payload.sub) return null;
    const rows = await db.select().from(users).where(eq(users.id, payload.sub));
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
