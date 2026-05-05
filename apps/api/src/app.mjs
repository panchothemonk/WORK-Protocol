/**
 * WORK Protocol v4 — App Router
 * Routes incoming requests to handlers.
 */
import { authMiddleware } from './middleware/auth.mjs';
import { errorMiddleware } from './middleware/error.mjs';
import { loggingMiddleware } from './middleware/logging.mjs';
import { idempotencyMiddleware } from './middleware/idempotency.mjs';

import * as workers from './routes/workers.mjs';
import * as buyers from './routes/buyers.mjs';
import * as services from './routes/services.mjs';
import * as jobs from './routes/jobs.mjs';
import * as payments from './routes/payments.mjs';
import * as receipts from './routes/receipts.mjs';
import * as reputation from './routes/reputation.mjs';
import * as publicRoutes from './routes/public.mjs';

const routes = [
  ...workers.routes,
  ...buyers.routes,
  ...services.routes,
  ...jobs.routes,
  ...payments.routes,
  ...receipts.routes,
  ...reputation.routes,
  ...publicRoutes.routes,
];

/**
 * Main request handler.
 * @param {object} ctx - { req, res, pool, config }
 */
export async function app(ctx) {
  const { req, res } = ctx;

  try {
    // Parse body for POST/PUT
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      ctx.body = await parseBody(req);
    }

    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    ctx.pathname = url.pathname;
    ctx.query = Object.fromEntries(url.searchParams);

    // Find matching route
    const route = routes.find(r => {
      if (r.method !== req.method) return false;
      return matchPath(r.path, ctx.pathname);
    });

    if (!route) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'NOT_FOUND' }));
      return;
    }

    // Extract path params
    ctx.params = extractParams(route.path, ctx.pathname);

    // Apply middleware chain
    await authMiddleware(ctx, route);
    await idempotencyMiddleware(ctx);
    await loggingMiddleware(ctx, route);

    // Execute handler
    const result = await route.handler(ctx);
    res.writeHead(result.status || 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body || result));

  } catch (err) {
    errorMiddleware(ctx, err);
  }
}

// ---- Helpers ---------------------------------------------------------------

function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((p, i) => p.startsWith(':') || p === pathParts[i]);
}

function extractParams(pattern, pathname) {
  const params = {};
  const pp = pattern.split('/');
  const pp2 = pathname.split('/');
  pp.forEach((p, i) => {
    if (p.startsWith(':')) params[p.slice(1)] = pp2[i];
  });
  return params;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({ raw: data }); }
    });
  });
}
