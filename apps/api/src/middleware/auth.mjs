// Middleware: Scope-based authentication. Routes auto-register their scope.
const PUBLIC_SCOPES = [];

export async function authMiddleware(ctx, route) {
  const requiredScopes = route.auth?.scopes || PUBLIC_SCOPES;
  if (requiredScopes.length === 0) return; // Public route

  const authHeader = ctx.req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ctx.res.writeHead(401);
    ctx.res.end(JSON.stringify({ error: 'UNAUTHORIZED' }));
    return;
  }

  // TODO: real API key validation against store
  ctx.auth = { apiKey: authHeader.slice(7) };
}
