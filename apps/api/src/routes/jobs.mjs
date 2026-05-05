// Jobs routes
import * as jobStore from '@workprotocol/store/jobs';
import * as serviceStore from '@workprotocol/store/services';
import * as workerStore from '@workprotocol/store/workers';
import * as paymentStore from '@workprotocol/store/payments';
import { createQuote, createJob } from '@workprotocol/core/jobs';

export const routes = [
  {
    method: 'POST', path: '/api/v1/jobs/quote',
    auth: { scopes: ['job:quote'] },
    handler: async (ctx) => {
      const store = {
        services: {
          getService: (id) => serviceStore.getService(ctx.pool, id),
        },
        workers: {
          getWorker: (id) => workerStore.getWorker(ctx.pool, id),
        },
      };
      const quote = await createQuote({
        store,
        workerId: ctx.body.workerId,
        serviceId: ctx.body.serviceId,
      });
      return { body: quote };
    },
  },
  {
    method: 'POST', path: '/api/v1/jobs',
    auth: { scopes: ['job:create'] },
    handler: async (ctx) => {
      const store = {
        jobs: {
          createJob: (j) => jobStore.createJob(ctx.pool, j),
          getJob: (id) => jobStore.getJob(ctx.pool, id),
          updateStatus: (id, s) => jobStore.updateStatus(ctx.pool, id, s),
          setResult: (id, h) => jobStore.setResult(ctx.pool, id, h),
        },
        payments: {
          getPaymentAuth: (id) => paymentStore.getPaymentAuth(ctx.pool, id),
          createPaymentAuth: (p) => paymentStore.createPaymentAuth(ctx.pool, p),
          updateSettlement: (id, sid, tx) => paymentStore.updateSettlement(ctx.pool, id, sid, tx),
        },
      };
      const job = await createJob({
        store,
        paymentAuthId: ctx.body.paymentAuthId,
        workerId: ctx.body.workerId,
        input: ctx.body.input,
      });
      return { status: 201, body: job };
    },
  },
  {
    method: 'GET', path: '/api/v1/jobs/:id',
    auth: { scopes: ['job:read'] },
    handler: async (ctx) => {
      const job = await jobStore.getJob(ctx.pool, ctx.params.id);
      if (!job) return { status: 404, body: { error: 'JOB_NOT_FOUND' } };
      return { body: job };
    },
  },
];
