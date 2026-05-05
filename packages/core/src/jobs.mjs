/**
 * WORK Protocol v4 — Job Lifecycle
 * Quote → Authorize → Create → Settle → Execute(BYOK) → Receipt
 *
 * All functions take store modules as parameters (dependency injection).
 * This keeps core DB-free while containing all business logic.
 */
import { calculateSplits } from './economics.mjs';
import { sign as signReceipt } from './receipt.mjs';
import crypto from 'node:crypto';

// ---- Quote -----------------------------------------------------------------

/**
 * Create a job quote with 3-way split calculation.
 * @param {object} params
 * @param {object} params.store - { services, workers }
 * @param {string} params.workerId
 * @param {string} params.serviceId
 * @param {string} [params.model] - AI model (for cost estimation)
 * @param {string} [params.buyerAddress]
 * @returns {Promise<object>} quote with buyerPrice and splits
 */
export async function createQuote({ store, workerId, serviceId, model, buyerAddress }) {
  const service = await store.services.getService(serviceId);
  if (!service) throw new Error('SERVICE_NOT_FOUND');
  if (service.worker_id !== workerId) throw new Error('WORKER_MISMATCH');

  const worker = await store.workers.getWorker(workerId);
  if (!worker || worker.status !== 'active') throw new Error('WORKER_NOT_ACTIVE');

  const workerPayoutMicroUsd = service.price_micro_usd;
  const aiCostEstimateMicroUsd = '0'; // BYOK — worker fronts their own cost

  const splits = calculateSplits(workerPayoutMicroUsd, aiCostEstimateMicroUsd);

  const protocolFeeMicroUsd = splits.find(s => s.purpose === 'protocol_fee').amountMicroUsd;
  const buyerPriceMicroUsd = String(
    BigInt(workerPayoutMicroUsd) + BigInt(aiCostEstimateMicroUsd)
  );

  return {
    quoteId: `q_${crypto.randomBytes(12).toString('hex')}`,
    workerId,
    serviceId,
    model: model || service.model || 'unknown',
    buyerAddress: buyerAddress || null,
    workerPayoutMicroUsd,
    aiCostEstimateMicroUsd,
    protocolFeeMicroUsd,
    buyerPriceMicroUsd,
    splits,
    createdAt: new Date().toISOString(),
  };
}

// ---- Challenge + Authorize -------------------------------------------------

/**
 * Create an x402 payment challenge.
 * @param {object} params
 * @param {object} params.quote - from createQuote()
 * @returns {object} challenge
 */
export function createChallenge({ quote }) {
  return {
    challengeId: `ch_${crypto.randomBytes(16).toString('hex')}`,
    quoteId: quote.quoteId,
    splits: quote.splits,
    buyerPriceMicroUsd: quote.buyerPriceMicroUsd,
    deadline: new Date(Date.now() + 3600_000).toISOString(), // 1 hour
    createdAt: new Date().toISOString(),
  };
}

/**
 * Authorize a payment — verify 3 EIP-3009 signatures match the challenge splits.
 * @param {object} params
 * @param {object} params.store - { payments }
 * @param {object} params.paymentClient - CDP or onchain client
 * @param {object} params.challenge
 * @param {Array<{purpose:string, signature:object}>} params.signatures
 * @returns {Promise<object>} payment authorization
 */
export async function authorizePayment({ store, paymentClient, challenge, signatures }) {
  // Must have exactly 3 signatures
  if (!Array.isArray(signatures) || signatures.length !== 3) {
    throw new Error('EXACTLY_3_SIGNATURES_REQUIRED');
  }

  // Must have one per purpose
  const purposes = signatures.map(s => s.purpose).sort();
  const required = ['ai_cost', 'protocol_fee', 'worker_payout'];
  if (JSON.stringify(purposes) !== JSON.stringify(required)) {
    throw new Error('MISSING_REQUIRED_PURPOSES');
  }

  // Verify signatures with payment rail
  if (paymentClient) {
    const { valid, error } = await paymentClient.verify(signatures);
    if (!valid) throw new Error(`SIGNATURE_VERIFICATION_FAILED: ${error || 'unknown'}`);
  }

  // Create payment authorization
  const paId = `pa_${crypto.randomBytes(12).toString('hex')}`;
  const pa = await store.payments.createPaymentAuth({
    id: paId,
    job_id: null, // assigned when job is created
    rail: paymentClient ? 'x402' : 'test',
    status: 'secured',
    splits: JSON.stringify(signatures),
    created_at: new Date().toISOString(),
  });

  return pa;
}

// ---- Job Lifecycle ---------------------------------------------------------

/**
 * Create a job after payment is secured.
 * @param {object} params
 * @param {object} params.store - { jobs, payments, workers }
 * @param {string} params.paymentAuthId
 * @param {*} params.input - job input (will be hashed)
 * @param {string} [params.model]
 * @param {string} [params.modelProvider]
 * @param {number} [params.timeoutMs] - default 1 hour
 * @returns {Promise<object>} created job
 */
export async function createJob({ store, paymentAuthId, input, model, modelProvider, timeoutMs = 3600_000 }) {
  const pa = await store.payments.getPaymentAuth(paymentAuthId);
  if (!pa) throw new Error('PAYMENT_AUTH_NOT_FOUND');
  if (pa.status !== 'secured') throw new Error('PAYMENT_NOT_SECURED');

  const inputHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const jobId = `job_${crypto.randomBytes(12).toString('hex')}`;
  const timeoutAt = new Date(Date.now() + timeoutMs).toISOString();

  const job = await store.jobs.createJob({
    id: jobId,
    worker_id: null, // assigned on accept
    buyer_id: null,
    service_id: null,
    payment_auth_id: paymentAuthId,
    input_hash: inputHash,
    status: 'created',
    model: model || null,
    model_provider: modelProvider || null,
    timeout_at: timeoutAt,
    created_at: new Date().toISOString(),
  });

  // Link payment auth to job
  await store.payments.updateSettlement(paymentAuthId, null, []);

  return job;
}

/**
 * Submit a result (BYOK path). Settlement-first: settle → record → sign receipt.
 * @param {object} params
 * @param {object} params.store - { jobs, payments, receipts, signing }
 * @param {object} params.settlementClient - CDP or onchain client
 * @param {string} params.jobId
 * @param {*} params.result - worker's output
 * @param {object} [params.aiUsage] - { cacheHitInputTokens, cacheMissInputTokens, outputTokens }
 * @param {string} [params.model]
 * @param {string} [params.modelProvider]
 * @returns {Promise<object>} signed receipt
 */
export async function submitResult({ store, settlementClient, jobId, result, aiUsage, model, modelProvider }) {
  const job = await store.jobs.getJob(jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (job.status === 'completed' || job.status === 'failed') {
    throw new Error(`JOB_ALREADY_${job.status.toUpperCase()}`);
  }

  const resultHash = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');

  // SETTLEMENT-FIRST: settle all 3 transfers on-chain before recording result
  const pa = await store.payments.getPaymentAuth(job.payment_auth_id);
  if (pa && pa.status === 'secured' && settlementClient) {
    const splits = JSON.parse(pa.splits);
    const { success, txHashes, error } = await settlementClient.settle(splits);
    if (!success) {
      throw new Error(`SETTLEMENT_FAILED: ${error || 'unknown'}`);
    }
    await store.payments.updateSettlement(pa.id, `stl_${crypto.randomBytes(8).toString('hex')}`, txHashes);
  }

  // Record result
  await store.jobs.setResult(jobId, resultHash);
  await store.jobs.updateStatus(jobId, 'completed');

  // Sign receipt
  const signingKey = await store.signing.loadSigningKey();
  const receiptBase = {
    version: '4.0',
    receiptType: 'completed',
    ids: {
      jobId,
      workerId: job.worker_id,
      buyerId: job.buyer_id,
      paymentAuthorizationId: job.payment_auth_id,
    },
    payment: { rail: pa?.rail || 'test', amountMicroUsd: pa ? JSON.parse(pa.splits)[0]?.amount || '0' : '0' },
    economics: {
      buyerPriceMicroUsd: '0',
      workerPayoutMicroUsd: '0',
      aiCostEstimateMicroUsd: '0',
      protocolFeeMicroUsd: '0',
    },
    execution: {
      model: model || job.model || 'unknown',
      modelProvider: modelProvider || job.model_provider || 'unknown',
      inputHash: job.input_hash,
      resultHash,
      aiUsage: aiUsage || null,
    },
    hashes: { inputHash: job.input_hash, resultHash },
    timestamps: {
      createdAt: job.created_at,
      completedAt: new Date().toISOString(),
    },
  };

  const receipt = signReceipt(receiptBase, signingKey.encrypted_data);
  const receiptId = `rct_${crypto.randomBytes(12).toString('hex')}`;

  await store.receipts.createReceipt({
    id: receiptId,
    job_id: jobId,
    receipt_type: 'completed',
    data: receipt,
    receipt_hash: receipt.receiptHash,
  });

  return { jobId, receiptId, receipt };
}

/**
 * Cancel a job (timeout or manual).
 * @param {object} params
 * @param {object} params.store - { jobs }
 * @param {string} params.jobId
 * @param {string} [params.reason]
 * @returns {Promise<object>}
 */
export async function cancelJob({ store, jobId, reason = 'cancelled' }) {
  const job = await store.jobs.getJob(jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (job.status === 'completed' || job.status === 'failed') {
    throw new Error('JOB_ALREADY_FINAL');
  }
  return store.jobs.updateStatus(jobId, 'failed');
}
