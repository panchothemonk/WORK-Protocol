// Reputation routes
export const routes = [
  {
    method: 'GET', path: '/api/v1/reputation/:workerId',
    auth: { scopes: [] },
    handler: async (ctx) => {
      return { body: { workerId: ctx.params.workerId, overall: 0, dimensions: {} } };
    },
  },
];
