# Bookshelf — Hono + Apollo GraphQL + SQLite/Drizzle + React

[![CI](https://github.com/maybetoolate/gql/actions/workflows/ci.yml/badge.svg)](https://github.com/maybetoolate/gql/actions/workflows/ci.yml)

Full-stack GraphQL starter: Bun + Hono API with Apollo Server 5,
SQLite persistence via Drizzle ORM, JWT auth, and a React + Apollo Client
frontend with GraphQL Codegen types.

## Features

- **Books catalog** — list, search (FTS5 prefix search over title/author/description), cursor pagination (`booksConnection` with opaque cursors, stable under inserts), add / edit / delete (creator-only)
- **Tags** — normalized tags with per-book add/remove, `tags` query with counts, single/multi-tag AND filtering
- **Sorting** — `NEWEST` / `TITLE` / `AUTHOR` / `RATING` (avg rating, unrated last)
- **Auth** — register / login (bcrypt via `Bun.password`), short-lived JWT access tokens + rotating opaque refresh tokens (sha256-hashed at rest), `refreshToken` rotation, per-session `logout` and global `logoutAll`, **Google/GitHub OAuth** (`/auth/:provider` → callback, link-or-create account)
- **Follows + feed** — follow/unfollow readers, follower counts, `activityFeed` merging followed users' reviews, shelf updates, and favorites
- **Notifications** — inbox for follows, review likes, and comments (self-actions excluded, unlikes/unfollows retract, comment deletes cascade), unread counts, mark one/all read, per-type preferences; email seam logs in dev, POSTs to `EMAIL_TRANSPORT_URL` when set
- **Account settings** — display-name update, password change (rotates all sessions, returns a fresh pair), notification preference toggles; Settings tab
- **Recommendations** — `recommendations` merges followed users' 4–5★ reads, tag overlap with finished/loved books, and global top-rated fallback, each with an explainable `reason`; known books always excluded
- **Reading goals** — yearly targets (`setGoal`/`deleteGoal`) with progress derived from finished shelf items, surfaced as a progress widget on the shelf tab
- **Reading stats** — `readingStats(year)` monthly finished counts (UTC) rendered as a bar chart on the shelf tab
- **Import/export** — bulk `importBooks` (case-insensitive dedupe, shelf + review attach, per-row errors, 200-row cap), `exportData` JSON dump, and Goodreads-compatible `exportCsv`; client Import tab parses/uploads Goodreads CSV and downloads both formats
- **Cover uploads** — `POST /api/books/:id/cover` (auth + edit-permission, JPEG/PNG/WebP/GIF ≤ 2MB), served at `/covers/*`, `coverUrl` on books, thumbnails in lists, file cleanup on book delete
- **i18n** — English/Spanish dictionaries with compile-time key parity (`es: Dict`), persisted switcher, translated session-expiry errors (main client fully translated; admin portal fully translated too)
- **Admin** — `admin`/`member` roles, `adminStats` dashboard counts, user search/role/delete (self-demote and self-delete blocked, deletes cascade), book moderation with duplicate **merging** (reviews/shelf/favorites/tags moved with conflict rules), **audit log** of destructive actions with actor attribution (survives actor deletion); separate admin portal on :5174
- **Bookshelf** — `want_to_read` / `reading` / `finished` per user, plus 0–100 **reading progress** (100 auto-marks finished)
- **Reviews** — 1–5 star ratings + text, one per user per book, avg rating counts, **likes** with `likesCount`/`likedByMe`, `NEWEST`/`TOP` sorting, **comments** (add/edit/delete, owner-only edits, `commentsCount`)
- **Favorites** — toggle + personal list
- **Counts** — `booksCount` mirrors `books` filters for pagination UI
- **Codegen** — typed operations generated from the server schema

## Layout

```
src/
  index.ts        Hono app + Apollo wiring (port 4000, /graphql)
  schema.ts       GraphQL typeDefs (source of truth) + resolvers
  schema.graphql  Dumped SDL (bun run schema:dump) — codegen input
  graphql.ts      Hono ↔ Apollo bridge + JWT context
  auth.ts         Password hashing + token signing
  db/
    schema.ts     Drizzle tables (users, books, shelf_items, reviews, favorites)
    index.ts      bun:sqlite connection + runMigrations()
    seed.ts       Demo data (demo@example.com / password123)
    seed-run.ts   Standalone migrate + seed
drizzle/          SQL migrations (applied on startup)
client/           Vite + React + Apollo Client (port 5173)
  codegen.ts      Codegen config (typescript-operations, no runtime code)
  src/queries.ts  gql documents · src/types/__generated__/ generated types
client-admin/     Admin portal (port 5174): dashboard stats, user roles,
                  deletes, book moderation. Admin login required.
```

## Quickstart

Server uses Bun; client uses npm (Bun's installer truncates some of the
client's transitive packages, breaking `graphql-codegen` under Node).

```sh
# install
bun install
cd client && npm install && cd ..

# dump SDL + generate client types (already committed, re-run after schema changes)
bun run schema:dump
npm --prefix client run codegen

# dev (server :4000 + client :5173 with /graphql proxy)
bun run dev
# admin portal on :5174 (separate terminal)
bun run dev:admin
# or separately:
bun run dev:server
bun run dev:client
```

Open http://localhost:5173 (app) and http://localhost:4000/graphql (Sandbox).

Seeded login: `demo@example.com` / `password123`.

## Scripts

| Command | What |
|---|---|
| `bun run dev` | server + client concurrently |
| `bun run start` | server only (migrates + seeds automatically) |
| `bun run test` | server test suite (isolated in-memory SQLite, 79 tests) |
| `npm --prefix client test` | client component tests (Vitest, 16 tests) |
| `npm --prefix client-admin test` | admin portal tests (Vitest, 6 tests) |
| `bun run db:promote <email>` | grant admin role (seeded demo is already admin) |
| `bun run schema:dump` | regenerate `src/schema.graphql` from `src/schema.ts` |
| `npm --prefix client run codegen` | regenerate `client/src/types/__generated__/` |
| `bun run db:seed` | migrate + seed without starting the server |
| `bun run db:generate` | new migration via drizzle-kit (requires npm-installed env) |

## Tests & CI

- `bun test ./test` runs `test/*.test.ts` against a fresh in-memory DB
  (`test/setup.ts` preload sets `SQLITE_PATH=:memory:`, a test JWT secret,
  and low bcrypt cost — never touches `sqlite.db`). Scoped to `./test` so
  Bun doesn't pick up the client's Vitest files.
- Tests execute real GraphQL operations through `ApolloServer.executeOperation`
  (same typeDefs/resolvers/validation rules as production, per-request loaders).
- Client: `npm test` runs Vitest + Testing Library (`happy-dom`) component tests
  for auth, book list/search, and shelf progress (Apollo `MockedProvider`).
- `.github/workflows/ci.yml` runs server typecheck + tests and client
  tests + codegen-drift check + build on every push/PR.

## Deploy (Docker)

The image is API-only; host the client (`client/dist`) on any static host
with `VITE_GRAPHQL_URL` pointed at the API.

```sh
docker build -t bookshelf-api .
docker run -p 4000:4000 \
  -e JWT_SECRET=... \
  -v sqlite-data:/data \
  bookshelf-api
# or: JWT_SECRET=... docker compose up --build
```

## Ops

- `bun run db:backup [dir] [keep]` — online backup via `VACUUM INTO`
  (safe on the live DB), keeps the N newest (default 7). Restore by stopping
  the server and copying the backup over `SQLITE_PATH`.
- `GET /metrics` — uptime, request totals by status/route, DB size.
- `GET /readyz` — readiness probe (DB readable + migrations applied,
  503 otherwise); also wired as the compose `healthcheck`.
- Every response carries `X-Request-Id`; set `LOG_FORMAT=json` for
  structured access logs.
- Slow GraphQL operations (over `SLOW_OP_MS`, default 1000) log a JSON
  warning with operation name and elapsed time.

Notes:

- Migrations + seed run automatically on startup; SQLite lives at
  `SQLITE_PATH` (`/data/sqlite.db` in the image, persisted via volume).
- The server binds `0.0.0.0` for container networking.
- The image build itself is verified by the `docker` CI job — it was not
  built locally (this environment has no container runtime).

## Env

- `PORT` (default 4000) · `SQLITE_PATH` (default `./sqlite.db`)
- `JWT_SECRET` — **required in production** (dev default warns)
- `ACCESS_TOKEN_TTL_S` (default 900) · `REFRESH_TOKEN_TTL_S` (default 30d)
- `BCRYPT_COST` (default 10; tests use 4)
- Dead sessions are pruned on boot and hourly (`PRUNE_INTERVAL_MS`, `DISABLE_PRUNER=1` to opt out)
- OAuth: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`
  (unconfigured providers return 400), `OAUTH_REDIRECT_BASE` (default
  `http://localhost:4000` — must match the provider console entry),
  `CLIENT_URL` (default `http://localhost:5173`, receives `#token=..&refresh=..`)
- `RATE_LIMIT_MAX` (default 120) · `RATE_LIMIT_WINDOW_MS` (default 60000) · `RATE_LIMIT_STORE` (`memory`/`sqlite`)
- `GRAPHQL_MAX_DEPTH` (default 10, rejects cyclic deep queries)
- `VITE_GRAPHQL_URL` — override client endpoint (default: `/graphql` proxy in dev)

## Performance & hardening

- Per-request DataLoader batching (`src/loaders.ts`) for book stats, tags,
  favorites, shelf status, review likes, follow graphs, tag counts, and all
  entity hydration — lists resolve in constant queries instead of N+1.
- Sliding-window rate limiting on `/graphql` (429 + `X-RateLimit-*` headers).
  `RATE_LIMIT_STORE=memory` (default, per-process) or `sqlite` (shared
  counters in the app DB — safe across replicas on one volume).
- Query depth cap via `graphql-depth-limit` (the schema is cyclic:
  `Book → reviews → book → …`).

## Notes

- Mutations except `register`/`login` require `Authorization: Bearer <token>`.
- `addBook`/`updateBook`/`deleteBook`: creator-only edits (seeded books are editable by anyone logged in).
- `drizzle/` migration `0000_init.sql` is hand-written: `drizzle-kit generate`
  can't run under Bun here (`esbuild` resolution), but works from an npm-based env.
