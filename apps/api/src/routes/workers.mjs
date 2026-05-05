// Workers routes
import * as workerStore from '@workprotocol/store/workers';

export const routes = [
  {
    method: 'POST', path: '/api/v1/workers',
    auth: { scopes: ['worker:create'] },
    handler: async (ctx) => {
      const worker = await workerStore.createWorker(ctx.pool, ctx.body);
      return { status: 201, body: worker };
    },
  },
  {
    method: 'GET', path: '/api/v1/workers/:id',
    auth: { scopes: ['worker:read'] },
    handler: async (ctx) => {
      const worker = await workerStore.getWorker(ctx.pool, ctx.params.id);
      if (!worker) return { status: 404, body: { error: 'WORKER_NOT_FOUND' } };
      return { body: worker };
    },
  },
  {
    method: 'GET', path: '/api/v1/workers/:id/reputation',
    auth: { scopes: [] },
    handler: async (ctx) => {
      return { body: { workerId: ctx.params.id, reputation: { overall: 0, dimensions: {} } } };
    },
  },
];
