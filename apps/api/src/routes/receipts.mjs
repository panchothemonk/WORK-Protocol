// Receipts routes
import * as receiptStore from '@workprotocol/store/receipts';

export const routes = [
  {
    method: 'GET', path: '/api/v1/receipts/:id',
    auth: { scopes: [] },
    handler: async (ctx) => {
      const receipt = await receiptStore.getReceipt(ctx.pool, ctx.params.id);
      if (!receipt) return { status: 404, body: { error: 'RECEIPT_NOT_FOUND' } };
      return { body: receipt };
    },
  },
];
