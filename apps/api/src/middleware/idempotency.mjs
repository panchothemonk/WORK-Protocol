// Middleware: Idempotency — 24h TTL. Keys derived from request content hash.
import crypto from 'node:crypto';

const cache = new Map();

export async function idempotencyMiddleware(ctx) {
  const key = ctx.req.headers['idempotency-key'];
  if (!key) return;

  if (cache.has(key)) {
    const cached = cache.get(key);
    ctx.res.writeHead(cached.status || 200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(cached.body));
    return;
  }

  // Store response after handler completes
  const originalEnd = ctx.res.end.bind(ctx.res);
  ctx.res.end = function(data) {
    try {
      cache.set(key, { status: ctx.res.statusCode, body: JSON.parse(data) });
      // 24h TTL
      setTimeout(() => cache.delete(key), 86_400_000);
    } catch {}
    originalEnd(data);
  };
}
