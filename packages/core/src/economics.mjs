/**
 * WORK Protocol v4 — Core Economics
 *
 * Every agent transaction produces exactly 3 splits:
 *   1. worker_payout  – the worker's earnings
 *   2. ai_cost        – compute / model reimbursement
 *   3. protocol_fee   – 3% of *worker payout only* (never on AI cost)
 *
 * All amounts are in microUSD (1 USD = 1 000 000 microUSD, stored as strings
 * to preserve precision across JSON/bigint boundaries).
 */

/** Protocol fee in basis points (300 = 3%). */
export const FEE_BPS = 300;

// ---- Split calculation ----------------------------------------------------

/**
 * Calculate the three-way split for a job.
 *
 * @param {string} workerPayoutMicroUsd  Worker payout, microUSD string (e.g. "100000000")
 * @param {string} aiCostMicroUsd        AI cost, microUSD string (e.g. "2000000")
 * @param {number} [feeBps=300]          Protocol fee in basis points
 * @returns {{ purpose: string, amountMicroUsd: string }[]}
 */
export function calculateSplits(workerPayoutMicroUsd, aiCostMicroUsd, feeBps = FEE_BPS) {
  const worker = BigInt(workerPayoutMicroUsd);
  const ai = BigInt(aiCostMicroUsd);
  const fee = (worker * BigInt(feeBps)) / 10000n;

  return [
    { purpose: 'worker_payout', amountMicroUsd: worker.toString() },
    { purpose: 'ai_cost', amountMicroUsd: ai.toString() },
    { purpose: 'protocol_fee', amountMicroUsd: fee.toString() },
  ];
}

// ---- Unit conversion ------------------------------------------------------

/** 1 USD = 1_000_000 microUSD */
const MICRO_SCALE = 1_000_000n;

/**
 * Convert a microUSD string (e.g. "1000000") to USD number (e.g. 1.00).
 *
 * @param {string} microUsd
 * @returns {number}
 */
export function microUsdToHuman(microUsd) {
  const val = BigInt(microUsd);
  return Number(val) / Number(MICRO_SCALE);
}

/**
 * Convert a USD number (e.g. 1.00) to microUSD string (e.g. "1000000").
 *
 * @param {number} usd
 * @returns {string}
 */
export function humanToMicroUsd(usd) {
  // Multiply by MICRO_SCALE then floor to avoid floating-point shenanigans
  const micro = BigInt(Math.floor(usd * Number(MICRO_SCALE)));
  return micro.toString();
}

// ---- Validation -----------------------------------------------------------

/**
 * Validate splits produced by `calculateSplits`.
 *
 * @param {{ purpose: string, amountMicroUsd: string }[]} splits
 * @param {string} expectedWorkerPayout
 * @param {string} expectedAiCost
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSplits(splits, expectedWorkerPayout, expectedAiCost) {
  const errors = [];

  if (!Array.isArray(splits)) {
    return { valid: false, errors: ['splits must be an array'] };
  }
  if (splits.length !== 3) {
    errors.push(`expected 3 splits, got ${splits.length}`);
  }

  const expectedPurposes = ['worker_payout', 'ai_cost', 'protocol_fee'];
  const seen = new Set();

  for (const split of splits) {
    if (!split.purpose) {
      errors.push('split missing purpose');
    } else if (!expectedPurposes.includes(split.purpose)) {
      errors.push(`unexpected purpose: ${split.purpose}`);
    } else if (seen.has(split.purpose)) {
      errors.push(`duplicate purpose: ${split.purpose}`);
    } else {
      seen.add(split.purpose);
    }

    if (split.amountMicroUsd === undefined || split.amountMicroUsd === null) {
      errors.push('split missing amountMicroUsd');
    } else if (typeof split.amountMicroUsd !== 'string') {
      errors.push(`amountMicroUsd must be a string, got ${typeof split.amountMicroUsd}`);
    }
  }

  // Validate worker_payout and ai_cost match (if present)
  for (const split of splits) {
    if (split.purpose === 'worker_payout' && split.amountMicroUsd !== expectedWorkerPayout) {
      errors.push(`worker_payout mismatch: expected ${expectedWorkerPayout}, got ${split.amountMicroUsd}`);
    }
    if (split.purpose === 'ai_cost' && split.amountMicroUsd !== expectedAiCost) {
      errors.push(`ai_cost mismatch: expected ${expectedAiCost}, got ${split.amountMicroUsd}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
