// Middleware: Production-safe error handler
export function errorMiddleware(ctx, err) {
  console.error(`[ERROR] ${ctx.req.method} ${ctx.pathname}:`, err);
  console.error(err.stack);

  if (err.message.startsWith('SERVICE_NOT_FOUND') || err.message.startsWith('WORKER_')) {
    ctx.res.writeHead(404);
    ctx.res.end(JSON.stringify({ error: err.message }));
  } else if (err.message.startsWith('PAYMENT_') || err.message.startsWith('JOB_')) {
    ctx.res.writeHead(400);
    ctx.res.end(JSON.stringify({ error: err.message }));
  } else if (err.message.startsWith('SETTLEMENT_') || err.message.startsWith('SIGNATURE_')) {
    ctx.res.writeHead(402);
    ctx.res.end(JSON.stringify({ error: err.message }));
  } else {
    ctx.res.writeHead(500);
    ctx.res.end(JSON.stringify({ error: 'INTERNAL_ERROR' }));
  }
}
