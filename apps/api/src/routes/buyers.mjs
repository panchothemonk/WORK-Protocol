// Buyers routes
import * as buyerStore from '@workprotocol/store/buyers';

export const routes = [
  {
    method: 'POST', path: '/api/v1/buyers',
    auth: { scopes: ['buyer:create'] },
    handler: async (ctx) => {
      const buyer = await buyerStore.createBuyer(ctx.pool, ctx.body);
      return { status: 201, body: buyer };
    },
  },
  {
    method: 'GET', path: '/api/v1/buyers/:id',
    auth: { scopes: ['buyer:read'] },
    handler: async (ctx) => {
      const buyer = await buyerStore.getBuyer(ctx.pool, ctx.params.id);
      if (!buyer) return { status: 404, body: { error: 'BUYER_NOT_FOUND' } };
      return { body: buyer };
    },
  },
];
