// Payments routes
import * as paymentStore from '@workprotocol/store/payments';
import { createChallenge, authorizePayment } from '@workprotocol/core/jobs';
import { isCdpConfigured, createCdpClient } from '@workprotocol/core/payment';

export const routes = [
  {
    method: 'POST', path: '/api/v1/payments/x402/challenge',
    auth: { scopes: ['payment:challenge'] },
    handler: async (ctx) => {
      const challenge = createChallenge({ quote: ctx.body.quote });
      return { body: challenge };
    },
  },
  {
    method: 'POST', path: '/api/v1/payments/x402/authorize',
    auth: { scopes: ['payment:authorize'] },
    handler: async (ctx) => {
      const paymentClient = isCdpConfigured() ? createCdpClient() : null;
      const store = {
        payments: {
          createPaymentAuth: (pa) => paymentStore.createPaymentAuth(ctx.pool, pa),
          getPaymentAuth: (id) => paymentStore.getPaymentAuth(ctx.pool, id),
          updateSettlement: (id, sid, tx) => paymentStore.updateSettlement(ctx.pool, id, sid, tx),
        },
      };
      const pa = await authorizePayment({
        store,
        paymentClient,
        challenge: ctx.body.challenge,
        signatures: ctx.body.signatures,
      });
      return { status: 201, body: pa };
    },
  },
];
