// jobs.test.mjs — Tests for job lifecycle module
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuote,
  createChallenge,
  authorizePayment,
  createJob,
  cancelJob,
} from '../src/jobs.mjs';

// ---- Mock Store ------------------------------------------------------------

function mockStore(overrides = {}) {
  const data = {
    workers: { 'wrk_1': { id: 'wrk_1', name: 'TestBot', status: 'active', withdrawal_address: '0xW' } },
    services: { 'svc_1': { id: 'svc_1', worker_id: 'wrk_1', name: 'Code Review', price_micro_usd: '5000000', status: 'published' } },
    payments: {},
    jobs: {},
    receipts: {},
    signing: { loadSigningKey: async () => ({ encrypted_data: '0000000000000000000000000000000000000000000000000000000000000000' }) },
    ...overrides,
  };

  return {
    workers: {
      getWorker: async (id) => data.workers[id] || null,
    },
    services: {
      getService: async (id) => data.services[id] || null,
    },
    payments: {
      getPaymentAuth: async (id) => data.payments[id] || null,
      createPaymentAuth: async (pa) => { data.payments[pa.id] = pa; return pa; },
      updateSettlement: async (id, settlementId, txHashes) => {
        if (data.payments[id]) { data.payments[id].status = 'settled'; data.payments[id].settlement_id = settlementId; }
        return data.payments[id];
      },
    },
    jobs: {
      getJob: async (id) => data.jobs[id] || null,
      createJob: async (job) => { data.jobs[job.id] = job; return job; },
      updateStatus: async (id, status) => {
        if (data.jobs[id]) data.jobs[id].status = status;
        return data.jobs[id];
      },
      setResult: async (id, hash) => {
        if (data.jobs[id]) data.jobs[id].result_hash = hash;
        return data.jobs[id];
      },
    },
    receipts: {
      createReceipt: async (r) => { return r; },
    },
    signing: {
      loadSigningKey: async () => ({ encrypted_data: '0000000000000000000000000000000000000000000000000000000000000000' }),
    },
  };
}

// ---- Quote Tests -----------------------------------------------------------

describe('createQuote', () => {
  it('creates a valid quote with 3-way splits', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });

    assert.ok(quote.quoteId.startsWith('q_'));
    assert.equal(quote.workerId, 'wrk_1');
    assert.equal(quote.workerPayoutMicroUsd, '5000000');
    assert.equal(quote.buyerPriceMicroUsd, '5000000');
    assert.equal(quote.splits.length, 3);

    // Check 3-way split
    const purposes = quote.splits.map(s => s.purpose).sort();
    assert.deepEqual(purposes, ['ai_cost', 'protocol_fee', 'worker_payout']);

    // Fee is 3% of $5.00 = $0.15 = 150000 microUSD
    const fee = quote.splits.find(s => s.purpose === 'protocol_fee');
    assert.equal(fee.amountMicroUsd, '150000');
  });

  it('throws when service not found', async () => {
    const store = mockStore();
    await assert.rejects(
      () => createQuote({ store, workerId: 'wrk_1', serviceId: 'bad' }),
      /SERVICE_NOT_FOUND/
    );
  });

  it('throws when worker is inactive', async () => {
    const store = mockStore({
      workers: { 'wrk_1': { id: 'wrk_1', status: 'paused' } },
    });
    await assert.rejects(
      () => createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' }),
      /WORKER_NOT_ACTIVE/
    );
  });

  it('AI cost is zero (BYOK model)', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });
    assert.equal(quote.aiCostEstimateMicroUsd, '0');
  });
});

// ---- Challenge Tests -------------------------------------------------------

describe('createChallenge', () => {
  it('creates challenge with 1-hour deadline', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });
    const challenge = createChallenge({ quote });

    assert.ok(challenge.challengeId.startsWith('ch_'));
    assert.equal(challenge.quoteId, quote.quoteId);
    assert.equal(challenge.splits.length, 3);
    assert.ok(new Date(challenge.deadline) > new Date());
  });
});

// ---- Authorize Tests -------------------------------------------------------

describe('authorizePayment', () => {
  it('rejects less than 3 signatures', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });
    const challenge = createChallenge({ quote });

    await assert.rejects(
      () => authorizePayment({
        store, paymentClient: null, challenge,
        signatures: [{ purpose: 'worker_payout', sig: '0x1' }],
      }),
      /EXACTLY_3_SIGNATURES_REQUIRED/
    );
  });

  it('rejects missing purpose', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });
    const challenge = createChallenge({ quote });

    await assert.rejects(
      () => authorizePayment({
        store, paymentClient: null, challenge,
        signatures: [
          { purpose: 'worker_payout', sig: '0x1' },
          { purpose: 'worker_payout', sig: '0x2' },
          { purpose: 'worker_payout', sig: '0x3' },
        ],
      }),
      /MISSING_REQUIRED_PURPOSES/
    );
  });

  it('creates payment authorization with 3 valid signatures (test mode)', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });
    const challenge = createChallenge({ quote });

    const pa = await authorizePayment({
      store, paymentClient: null, challenge,
      signatures: [
        { purpose: 'worker_payout', sig: '0x1' },
        { purpose: 'ai_cost', sig: '0x2' },
        { purpose: 'protocol_fee', sig: '0x3' },
      ],
    });

    assert.ok(pa.id.startsWith('pa_'));
    assert.equal(pa.status, 'secured');
    assert.equal(pa.rail, 'test');
  });
});

// ---- Job Lifecycle Tests ---------------------------------------------------

describe('createJob', () => {
  it('creates a job when payment is secured', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });
    const challenge = createChallenge({ quote });
    const pa = await authorizePayment({
      store, paymentClient: null, challenge,
      signatures: [
        { purpose: 'worker_payout', sig: '0x1' },
        { purpose: 'ai_cost', sig: '0x2' },
        { purpose: 'protocol_fee', sig: '0x3' },
      ],
    });

    const job = await createJob({
      store, paymentAuthId: pa.id,
      input: { task: 'Review PR #42' },
    });

    assert.ok(job.id.startsWith('job_'));
    assert.equal(job.status, 'created');
    assert.equal(job.payment_auth_id, pa.id);
    assert.ok(job.input_hash);
    assert.ok(job.timeout_at);
  });

  it('rejects when payment auth not found', async () => {
    const store = mockStore();
    await assert.rejects(
      () => createJob({ store, paymentAuthId: 'bad', input: {} }),
      /PAYMENT_AUTH_NOT_FOUND/
    );
  });
});

describe('cancelJob', () => {
  it('cancels a pending job', async () => {
    const store = mockStore();
    const quote = await createQuote({ store, workerId: 'wrk_1', serviceId: 'svc_1' });
    const challenge = createChallenge({ quote });
    const pa = await authorizePayment({
      store, paymentClient: null, challenge,
      signatures: [
        { purpose: 'worker_payout', sig: '0x1' },
        { purpose: 'ai_cost', sig: '0x2' },
        { purpose: 'protocol_fee', sig: '0x3' },
      ],
    });
    const job = await createJob({ store, paymentAuthId: pa.id, input: {} });

    const cancelled = await cancelJob({ store, jobId: job.id });
    assert.equal(cancelled.status, 'failed');
  });
});
