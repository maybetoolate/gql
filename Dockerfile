# API image. The client is static output (client/dist) — host it on any
# static host with VITE_GRAPHQL_URL pointing at this API.
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY drizzle ./drizzle

ENV PORT=4000
ENV SQLITE_PATH=/data/sqlite.db
VOLUME /data
EXPOSE 4000

# Migrations + seed run automatically on startup (see src/index.ts).
CMD ["bun", "src/index.ts"]
