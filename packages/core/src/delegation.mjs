/**
 * WORK Protocol v4 — Delegation
 * Worker→worker composition: budget locking, depth enforcement, receipt chains.
 */
import crypto from 'node:crypto';

/**
 * Delegate a subtask from parent job to a child worker.
 * Locks budget from parent's payment. Enforces max depth.
 *
 * @param {object} params
 * @param {object} params.store - { jobs, delegations, workers }
 * @param {string} params.parentJobId
 * @param {string} params.childWorkerId
 * @param {string} params.budgetMicroUsd - locked budget for child
 * @param {*} params.input - child job input
 * @param {number} [params.timeoutMs] - default 30 min
 * @returns {Promise<object>} { delegation, childJob }
 */
export async function delegate({ store, parentJobId, childWorkerId, budgetMicroUsd, input, timeoutMs = 1800_000 }) {
  const parentJob = await store.jobs.getJob(parentJobId);
  if (!parentJob) throw new Error('PARENT_JOB_NOT_FOUND');
  if (parentJob.status === 'completed' || parentJob.status === 'failed') {
    throw new Error('PARENT_JOB_ALREADY_FINAL');
  }

  // Check depth
  const parentWorker = await store.workers.getWorker(parentJob.worker_id);
  const maxDepth = parentWorker?.guardrails?.maxDelegationDepth ?? 3;
  const currentDepth = await getCurrentDepth(store, parentJobId);
  if (currentDepth >= maxDepth) throw new Error('MAX_DEPTH_EXCEEDED');

  // Create child job
  const inputHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const childJobId = `job_${crypto.randomBytes(12).toString('hex')}`;
  const timeoutAt = new Date(Date.now() + timeoutMs).toISOString();

  const childJob = await store.jobs.createJob({
    id: childJobId,
    worker_id: childWorkerId,
    buyer_id: parentJob.buyer_id,
    service_id: null,
    payment_auth_id: null,
    input_hash: inputHash,
    status: 'created',
    timeout_at: timeoutAt,
    created_at: new Date().toISOString(),
  });

  // Create delegation link
  const delId = `del_${crypto.randomBytes(12).toString('hex')}`;
  const delegation = await store.delegations.createDelegation({
    id: delId,
    parent_job_id: parentJobId,
    child_job_id: childJobId,
    budget_micro_usd: budgetMicroUsd,
    status: 'pending',
    timeout_at: timeoutAt,
    created_at: new Date().toISOString(),
  });

  return { delegation, childJob };
}

/**
 * Get current delegation depth from a job upward.
 */
async function getCurrentDepth(store, jobId) {
  let depth = 0;
  let currentId = jobId;
  while (true) {
    const delegations = await store.delegations.listByParent(currentId);
    if (!delegations || delegations.length === 0) break;
    depth++;
    currentId = delegations[0].child_job_id;
  }
  return depth;
}

/**
 * Check for expired delegations and release budgets.
 * @param {object} params
 * @param {object} params.store - { delegations, jobs }
 * @returns {Promise<string[]>} released delegation IDs
 */
export async function releaseExpiredDelegations({ store }) {
  const expired = await store.delegations.getExpired();
  const released = [];

  for (const del of expired) {
    if (del.status === 'pending') {
      await store.delegations.updateStatus(del.id, 'expired');
      await store.jobs.updateStatus(del.child_job_id, 'failed');
      released.push(del.id);
    }
  }

  return released;
}

/**
 * Verify a receipt chain. Given a parent receipt, verify all child receipts.
 * Recursively validates the receipt tree.
 *
 * @param {object} params
 * @param {object} params.store - { receipts, delegations }
 * @param {string} params.receiptId
 * @param {Function} params.verifyFn - (receipt) => boolean
 * @returns {Promise<{valid:boolean, chain:Array}>}
 */
export async function verifyReceiptChain({ store, receiptId, verifyFn }) {
  const receipt = await store.receipts.getReceipt(receiptId);
  if (!receipt) return { valid: false, error: 'RECEIPT_NOT_FOUND' };

  const verified = verifyFn ? verifyFn(receipt) : true;
  if (!verified) return { valid: false, error: 'RECEIPT_VERIFICATION_FAILED' };

  // Find child receipts
  const delegations = await store.delegations.listByParent(receipt.job_id);
  const children = [];

  for (const del of delegations) {
    const childReceipts = await store.receipts.listByWorker(del.child_job_id);
    for (const childReceipt of childReceipts) {
      const result = await verifyReceiptChain({
        store, receiptId: childReceipt.id, verifyFn,
      });
      children.push(result);
      if (!result.valid) return { valid: false, error: result.error, chain: children };
    }
  }

  return { valid: true, chain: children };
}
