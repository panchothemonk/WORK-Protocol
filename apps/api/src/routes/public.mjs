// Public routes — no auth required
export const routes = [
  {
    method: 'POST', path: '/api/v1/public/settle',
    auth: { scopes: [] },
    handler: async (ctx) => {
      return { body: { message: 'Public settlement — Phase 5' } };
    },
  },
  {
    method: 'POST', path: '/api/v1/public/verify/receipt',
    auth: { scopes: [] },
    handler: async (ctx) => {
      return { body: { valid: true, message: 'Receipt verification' } };
    },
  },
];
