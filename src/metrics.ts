import type { Context, Next } from "hono";

const startedAt = Date.now();
let total = 0;
const byStatus = new Map<number, number>();
const byRoute = new Map<string, number>();

export function metricsMiddleware() {
  return async (c: Context, next: Next) => {
    await next();
    total += 1;
    byStatus.set(c.res.status, (byStatus.get(c.res.status) ?? 0) + 1);
    const key = `${c.req.method} ${c.req.routePath}`;
    byRoute.set(key, (byRoute.get(key) ?? 0) + 1);
  };
}

export function metricsSnapshot(dbPath: string) {
  let dbBytes: number | null = null;
  try {
    const file = Bun.file(dbPath);
    // size is 0 for missing files; report null instead.
    dbBytes = file.size > 0 ? file.size : null;
  } catch {
    dbBytes = null;
  }
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    requestsTotal: total,
    byStatus: Object.fromEntries(byStatus),
    byRoute: Object.fromEntries(
      [...byRoute.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
    ),
    dbBytes,
  };
}
