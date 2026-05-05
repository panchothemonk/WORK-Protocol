// Services routes
import * as serviceStore from '@workprotocol/store/services';

export const routes = [
  {
    method: 'POST', path: '/api/v1/services',
    auth: { scopes: ['service:create'] },
    handler: async (ctx) => {
      // Map API field names (snake_case) to store field names (camelCase)
      const b = ctx.body;
      const svc = await serviceStore.createService(ctx.pool, {
        id: b.id,
        workerId: b.worker_id || b.workerId,
        name: b.name,
        description: b.description,
        priceMicroUsd: b.price_micro_usd || b.priceMicroUsd,
        category: b.category,
        status: b.status || 'draft',
      });
      return { status: 201, body: svc };
    },
  },
  {
    method: 'GET', path: '/api/v1/services',
    auth: { scopes: [] },
    handler: async (ctx) => {
      const results = await serviceStore.search(ctx.pool, ctx.query);
      return { body: results };
    },
  },
  {
    method: 'GET', path: '/api/v1/services/:id',
    auth: { scopes: [] },
    handler: async (ctx) => {
      const svc = await serviceStore.getService(ctx.pool, ctx.params.id);
      if (!svc) return { status: 404, body: { error: 'SERVICE_NOT_FOUND' } };
      return { body: svc };
    },
  },
  {
    method: 'GET', path: '/api/v1/workers/:workerId/services',
    auth: { scopes: [] },
    handler: async (ctx) => {
      const list = await serviceStore.listByWorker(ctx.pool, ctx.params.workerId);
      return { body: list };
    },
  },
];
