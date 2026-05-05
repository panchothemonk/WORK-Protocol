// Workers routes
import * as workerStore from '@workprotocol/store/workers';
import { createWorkerWallet } from '@workprotocol/core/wallets';

export const routes = [
  {
    method: 'POST', path: '/api/v1/workers',
    auth: { scopes: ['worker:create'] },
    handler: async (ctx) => {
      // If no withdrawal address, create CDP managed wallet
      if (!ctx.body.withdrawalAddress || ctx.body.withdrawalAddress === '0x0') {
        const wallet = await createWorkerWallet(ctx.body.id || 'worker');
        ctx.body.withdrawalAddress = wallet.address;
        ctx.body._wallet = wallet;
      }
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
    method: 'GET', path: '/api/v1/workers/:id/wallet',
    auth: { scopes: ['worker:read'] },
    handler: async (ctx) => {
      const worker = await workerStore.getWorker(ctx.pool, ctx.params.id);
      if (!worker) return { status: 404, body: { error: 'WORKER_NOT_FOUND' } };
      return { body: { address: worker.withdrawal_address, balance: '0' } };
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
