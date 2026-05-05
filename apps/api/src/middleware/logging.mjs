// Middleware: Request logging
export async function loggingMiddleware(ctx, route) {
  const start = Date.now();
  ctx.res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${ctx.req.method}] ${ctx.pathname} → ${ctx.res.statusCode} (${ms}ms)`);
  });
}
