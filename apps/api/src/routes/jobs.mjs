// Jobs routes
import * as jobStore from '@workprotocol/store/jobs';
import { createQuote, createChallenge, authorizePayment, createJob, submitResult } from '@workprotocol/core/jobs';

export const routes = [
  {
    method: 'POST', path: '/api/v1/jobs/quote',
    auth: { scopes: ['job:quote'] },
    handler: async (ctx) => {
      const quote = await createQuote({ store: { services: jobStore, workers: jobStore }, ...ctx.body });
      return { body: quote };
    },
  },
  {
    method: 'POST', path: '/api/v1/jobs',
    auth: { scopes: ['job:create'] },
    handler: async (ctx) => {
      const job = await createJob({ store: { jobs: jobStore, payments: jobStore }, ...ctx.body });
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
