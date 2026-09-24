import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { ApolloServer } from "@apollo/server";
import depthLimit from "graphql-depth-limit";
import { typeDefs, resolvers, type GraphQLContext } from "./schema";
import { graphqlHonoHandler } from "./graphql";
import { rateLimit, MemoryStore, SqliteStore } from "./rate-limit";
import { runMigrations, db } from "./db";
import { seedIfEmpty } from "./db/seed";
import { pruneSessions, userFromAuthHeader } from "./auth";
import { isSafeBookId, saveCover } from "./covers";
import { canEdit, getBookOrThrow } from "./schema";
import { books } from "./db/schema";
import { eq } from "drizzle-orm";
import { serveStatic } from "hono/bun";
import { metricsMiddleware, metricsSnapshot } from "./metrics";
import { checkReadiness } from "./health";
import {
  buildAuthUrl,
  completeOAuthLogin,
  isOAuthConfigured,
  makeOAuthState,
  verifyOAuthState,
  type OAuthProvider,
} from "./oauth";
import { getCookie, setCookie } from "hono/cookie";

export const app = new Hono();

app.use(requestId());
if ((process.env.LOG_FORMAT ?? "pretty") === "json") {
  app.use(async (c, next) => {
    const start = Date.now();
    await next();
    console.log(
      JSON.stringify({
        requestId: c.get("requestId"),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Date.now() - start,
      }),
    );
  });
} else {
  app.use(logger());
}
app.use(metricsMiddleware());
app.use(
  "/graphql/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "apollo-require-preflight"],
  }),
);
app.use(
  "/graphql",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "apollo-require-preflight"],
  }),
);

app.get("/", (c) => {
  return c.json({
    message: "Hono + Apollo Server + Drizzle/SQLite",
    graphql: "/graphql",
    health: "/health",
  });
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/readyz", async (c) => {
  const readiness = await checkReadiness();
  return c.json(readiness, readiness.ready ? 200 : 503);
});

app.get("/metrics", (c) =>
  c.json(metricsSnapshot(process.env.SQLITE_PATH ?? "./sqlite.db")),
);

app.get("/api/hello", (c) => c.json({ message: "Hello from Hono REST" }));

app.use("/covers/*", serveStatic({ root: "./uploads" }));

app.post("/api/books/:id/cover", async (c) => {
  const user = await userFromAuthHeader(c.req.header("authorization"));
  if (!user) return c.json({ error: "Authentication required" }, 401);
  const id = c.req.param("id");
  if (!isSafeBookId(id)) return c.json({ error: "Invalid book id" }, 400);
  let book;
  try {
    book = await getBookOrThrow(id);
  } catch {
    return c.json({ error: "Book not found" }, 404);
  }
  if (!canEdit(book, user)) return c.json({ error: "Forbidden" }, 403);
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("cover");
  if (!(file instanceof File)) return c.json({ error: "Missing cover file" }, 400);
  try {
    const coverUrl = await saveCover(id, file);
    await db.update(books).set({ coverUrl }).where(eq(books.id, id));
    return c.json({ coverUrl });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Upload failed" }, 400);
  }
});

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

function oauthError(c: Context, message: string) {
  return c.redirect(
    `${CLIENT_URL}/auth/callback#error=${encodeURIComponent(message)}`,
    302,
  );
}

app.get("/auth/:provider", async (c) => {
  const provider = c.req.param("provider");
  if (!isOAuthConfigured(provider)) {
    return c.json(
      { error: `OAuth provider "${provider}" is not configured` },
      400,
    );
  }
  const p = provider as OAuthProvider;
  const state = await makeOAuthState(p);
  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "Lax",
  });
  return c.redirect(buildAuthUrl(p, state), 302);
});

app.get("/auth/:provider/callback", async (c) => {
  const provider = c.req.param("provider");
  if (!isOAuthConfigured(provider)) {
    return c.json(
      { error: `OAuth provider "${provider}" is not configured` },
      400,
    );
  }
  const p = provider as OAuthProvider;
  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieState = getCookie(c, "oauth_state");
  if (!code || !state || !cookieState || state !== cookieState) {
    return oauthError(c, "Invalid OAuth state");
  }
  if (!(await verifyOAuthState(state, p))) {
    return oauthError(c, "Invalid OAuth state");
  }
  try {
    const { pair } = await completeOAuthLogin(p, code);
    const params = new URLSearchParams({
      token: pair.token,
      refresh: pair.refreshToken,
    });
    return c.redirect(`${CLIENT_URL}/auth/callback#${params.toString()}`, 302);
  } catch (err) {
    return oauthError(c, err instanceof Error ? err.message : "OAuth failed");
  }
});

runMigrations();
await seedIfEmpty();
await pruneSessions();

const GRAPHQL_MAX_DEPTH = Number(process.env.GRAPHQL_MAX_DEPTH ?? 10);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 120);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  store:
    (process.env.RATE_LIMIT_STORE ?? "memory") === "sqlite"
      ? new SqliteStore()
      : new MemoryStore(),
});
// Single prefix check: registering "/graphql" and "/graphql/*" separately
// would run the middleware twice per request and double-count.
app.use(async (c, next) => {
  if (c.req.path === "/graphql" || c.req.path.startsWith("/graphql/")) {
    return limiter(c, next);
  }
  await next();
});

const apollo = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(GRAPHQL_MAX_DEPTH)],
});
await apollo.start();

const graphqlHandler = graphqlHonoHandler(apollo);
app.all("/graphql", graphqlHandler);
app.all("/graphql/*", graphqlHandler);

const port = Number(process.env.PORT ?? 4000);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};

console.log(`Hono running at http://localhost:${port}`);
console.log(`GraphQL (Sandbox) at http://localhost:${port}/graphql`);
