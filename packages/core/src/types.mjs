// @workprotocol/core — Core Types
//
// Type definitions and validation for WORK Protocol v4.
// All monetary values use MicroUsd (string-encoded BigInt-compatible integer).
// Example: "1000000" = $1.00 (6 decimal places).

// ---------------------------------------------------------------------------
// Type aliases (documentation-only in JSDoc, enforced via validators at runtime)
// ---------------------------------------------------------------------------

/**
 * MicroUsd — string-encoded integer representing 1/1,000,000 of a US dollar.
 * Example: "1000000" = $1.00, "50" = $0.00005
 * This format avoids floating-point rounding and is BigInt-compatible.
 * @typedef {string} MicroUsd
 */

/**
 * SplitPurpose — the three-way split categories.
 *   - "worker_payout": Payment to the worker agent
 *   - "ai_cost":       Reimbursement for AI compute costs
 *   - "protocol_fee":  3% protocol fee (on worker payout only)
 * @typedef {'worker_payout' | 'ai_cost' | 'protocol_fee'} SplitPurpose
 */

/**
 * PaymentSplit — a single payment split in a three-way settlement.
 * @typedef {Object} PaymentSplit
 * @property {SplitPurpose} purpose
 * @property {MicroUsd}     amountMicroUsd
 * @property {string}       toAddress - Ethereum address (0x...)
 */

/**
 * EIP3009Signature — an EIP-3009 transferWithAuthorization signature from a buyer.
 * @typedef {Object} EIP3009Signature
 * @property {string} from   - Signer address (0x...)
 * @property {number} v      - Recovery byte
 * @property {string} r      - Signature r (hex, 0x...)
 * @property {string} s      - Signature s (hex, 0x...)
 * @property {number} nonce  - Authorization nonce
 */

/**
 * SignedSplit — an EIP-3009 signature bound to a specific split purpose.
 * @typedef {Object} SignedSplit
 * @property {string}       from    - Signer address (0x...)
 * @property {number}       v, r, s, nonce - EIP-3009 fields
 * @property {SplitPurpose} purpose
 */

/**
 * ReceiptV4 — a cryptographic proof of work signed by the protocol.
 * Receipts are frozen after signing and anchored on Base L2.
 * @typedef {Object} ReceiptV4
 * @property {'4.0'}   version
 * @property {string}  receiptType      - e.g. 'job_completion', 'delegation'
 * @property {Object}  ids              - { jobId, workerId, buyerId, ... }
 * @property {Object}  payment          - { rail: 'cdp'|'viem', amountMicroUsd }
 * @property {Object}  economics        - { buyerPrice, workerPayout, aiCost, protocolFee, feeBps }
 * @property {Object}  execution        - { model?, platform?, inputHash }
 * @property {Object}  hashes           - { receiptHash }
 * @property {Object}  timestamps       - { createdAt, completedAt }
 * @property {Object}  signature        - { algorithm: 'ed25519', signingKeyId, signatureBase64 }
 */

/**
 * WorkerIdentity — an agent's registered identity as a worker.
 * @typedef {Object} WorkerIdentity
 * @property {string}  workerId
 * @property {string}  name
 * @property {string}  publicKey           - Ed25519 public key (hex)
 * @property {string}  withdrawalAddress   - USDC destination (0x...)
 * @property {Object}  guardrails
 * @property {MicroUsd} guardrails.maxExposureMicroUsd   - Max total value in flight
 * @property {MicroUsd} guardrails.minPriceMicroUsd      - Minimum price per job
 * @property {number}   guardrails.maxDelegationDepth     - Max delegation chain depth
 */

/**
 * BuyerIdentity — a registered buyer on the protocol.
 * @typedef {Object} BuyerIdentity
 * @property {string} buyerId
 * @property {string} address    - Ethereum address (0x...)
 * @property {string} publicKey  - Ed25519 public key (hex)
 */

// ---------------------------------------------------------------------------
// Regular expressions
// ---------------------------------------------------------------------------

const MICRO_USD_RE = /^[0-9]+$/;
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_64_RE = /^0x[0-9a-fA-F]{64}$/;
const HEX_PUBKEY_RE = /^[0-9a-fA-F]{64}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const ISO8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const VALID_SPLIT_PURPOSES = new Set([
  'worker_payout',
  'ai_cost',
  'protocol_fee',
]);

const VALID_RECEIPT_TYPES = new Set([
  'job_completion',
  'delegation',
]);

const VALID_RAILS = new Set(['cdp', 'viem']);

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Check if a string is a valid MicroUsd value.
 * Must be a non-empty string of digits (no leading zeros unless exactly "0").
 * @param {string} str
 * @returns {boolean}
 */
export function isValidMicroUsd(str) {
  if (typeof str !== 'string') return false;
  if (!MICRO_USD_RE.test(str)) return false;
  // Reject leading zeros unless it's exactly "0"
  if (str.length > 1 && str[0] === '0') return false;
  return true;
}

/**
 * Check if a string is a valid SplitPurpose.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidSplitPurpose(str) {
  return VALID_SPLIT_PURPOSES.has(str);
}

/**
 * Validate a PaymentSplit object.
 * @param {*} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePaymentSplit(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['PaymentSplit must be a non-null object'] };
  }

  // purpose
  if (!obj.purpose || !isValidSplitPurpose(obj.purpose)) {
    errors.push(
      `purpose must be one of: ${[...VALID_SPLIT_PURPOSES].join(', ')}`
    );
  }

  // amountMicroUsd
  if (!isValidMicroUsd(obj.amountMicroUsd)) {
    errors.push(
      'amountMicroUsd must be a non-empty digit string without leading zeros (or "0")'
    );
  }

  // toAddress
  if (typeof obj.toAddress !== 'string' || !ETH_ADDRESS_RE.test(obj.toAddress)) {
    errors.push('toAddress must be a valid Ethereum address (0x + 40 hex chars)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an EIP-3009 signature object.
 * @param {*} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEIP3009Signature(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['EIP3009Signature must be a non-null object'] };
  }

  if (typeof obj.from !== 'string' || !ETH_ADDRESS_RE.test(obj.from)) {
    errors.push('from must be a valid Ethereum address (0x + 40 hex chars)');
  }

  if (typeof obj.v !== 'number' || !Number.isInteger(obj.v)) {
    errors.push('v must be an integer');
  }

  if (typeof obj.r !== 'string' || !HEX_64_RE.test(obj.r)) {
    errors.push('r must be a 32-byte hex string (0x + 64 hex chars)');
  }

  if (typeof obj.s !== 'string' || !HEX_64_RE.test(obj.s)) {
    errors.push('s must be a 32-byte hex string (0x + 64 hex chars)');
  }

  if (typeof obj.nonce !== 'number' || !Number.isInteger(obj.nonce) || obj.nonce < 0) {
    errors.push('nonce must be a non-negative integer');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a SignedSplit (EIP-3009 signature bound to a purpose).
 * @param {*} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSignedSplit(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['SignedSplit must be a non-null object'] };
  }

  const sigResult = validateEIP3009Signature(obj);
  errors.push(...sigResult.errors);

  if (!obj.purpose || !isValidSplitPurpose(obj.purpose)) {
    errors.push(
      `purpose must be one of: ${[...VALID_SPLIT_PURPOSES].join(', ')}`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a ReceiptV4 object.
 * @param {*} receipt
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateReceipt(receipt) {
  const errors = [];

  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, errors: ['ReceiptV4 must be a non-null object'] };
  }

  // version
  if (receipt.version !== '4.0') {
    errors.push('version must be "4.0"');
  }

  // receiptType
  if (!receipt.receiptType || !VALID_RECEIPT_TYPES.has(receipt.receiptType)) {
    errors.push(
      `receiptType must be one of: ${[...VALID_RECEIPT_TYPES].join(', ')}`
    );
  }

  // ids
  if (!receipt.ids || typeof receipt.ids !== 'object') {
    errors.push('ids must be a non-null object');
  } else {
    if (!receipt.ids.jobId || typeof receipt.ids.jobId !== 'string') {
      errors.push('ids.jobId must be a non-empty string');
    }
    if (!receipt.ids.workerId || typeof receipt.ids.workerId !== 'string') {
      errors.push('ids.workerId must be a non-empty string');
    }
    if (!receipt.ids.buyerId || typeof receipt.ids.buyerId !== 'string') {
      errors.push('ids.buyerId must be a non-empty string');
    }
  }

  // payment
  if (!receipt.payment || typeof receipt.payment !== 'object') {
    errors.push('payment must be a non-null object');
  } else {
    if (!receipt.payment.rail || !VALID_RAILS.has(receipt.payment.rail)) {
      errors.push(`payment.rail must be one of: ${[...VALID_RAILS].join(', ')}`);
    }
    if (!isValidMicroUsd(receipt.payment.amountMicroUsd)) {
      errors.push('payment.amountMicroUsd must be a valid MicroUsd string');
    }
  }

  // economics
  if (!receipt.economics || typeof receipt.economics !== 'object') {
    errors.push('economics must be a non-null object');
  } else {
    if (!isValidMicroUsd(receipt.economics.buyerPrice)) {
      errors.push('economics.buyerPrice must be a valid MicroUsd string');
    }
    if (!isValidMicroUsd(receipt.economics.workerPayout)) {
      errors.push('economics.workerPayout must be a valid MicroUsd string');
    }
    if (!isValidMicroUsd(receipt.economics.aiCost)) {
      errors.push('economics.aiCost must be a valid MicroUsd string');
    }
    if (!isValidMicroUsd(receipt.economics.protocolFee)) {
      errors.push('economics.protocolFee must be a valid MicroUsd string');
    }
    if (
      typeof receipt.economics.feeBps !== 'number' ||
      !Number.isInteger(receipt.economics.feeBps) ||
      receipt.economics.feeBps < 0
    ) {
      errors.push('economics.feeBps must be a non-negative integer');
    }
  }

  // execution
  if (!receipt.execution || typeof receipt.execution !== 'object') {
    errors.push('execution must be a non-null object');
  } else {
    if (!receipt.execution.inputHash || typeof receipt.execution.inputHash !== 'string') {
      errors.push('execution.inputHash must be a non-empty string');
    }
  }

  // hashes
  if (!receipt.hashes || typeof receipt.hashes !== 'object') {
    errors.push('hashes must be a non-null object');
  } else {
    if (!receipt.hashes.receiptHash || typeof receipt.hashes.receiptHash !== 'string') {
      errors.push('hashes.receiptHash must be a non-empty string');
    }
  }

  // timestamps
  if (!receipt.timestamps || typeof receipt.timestamps !== 'object') {
    errors.push('timestamps must be a non-null object');
  } else {
    if (
      typeof receipt.timestamps.createdAt !== 'string' ||
      !ISO8601_RE.test(receipt.timestamps.createdAt)
    ) {
      errors.push('timestamps.createdAt must be an ISO 8601 string');
    }
    if (
      typeof receipt.timestamps.completedAt !== 'string' ||
      !ISO8601_RE.test(receipt.timestamps.completedAt)
    ) {
      errors.push('timestamps.completedAt must be an ISO 8601 string');
    }
  }

  // signature
  if (!receipt.signature || typeof receipt.signature !== 'object') {
    errors.push('signature must be a non-null object');
  } else {
    if (receipt.signature.algorithm !== 'ed25519') {
      errors.push('signature.algorithm must be "ed25519"');
    }
    if (
      !receipt.signature.signingKeyId ||
      typeof receipt.signature.signingKeyId !== 'string'
    ) {
      errors.push('signature.signingKeyId must be a non-empty string');
    }
    if (
      !receipt.signature.signatureBase64 ||
      typeof receipt.signature.signatureBase64 !== 'string' ||
      !BASE64_RE.test(receipt.signature.signatureBase64)
    ) {
      errors.push('signature.signatureBase64 must be a valid base64 string');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a WorkerIdentity object.
 * @param {*} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateWorkerIdentity(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['WorkerIdentity must be a non-null object'] };
  }

  if (!obj.workerId || typeof obj.workerId !== 'string') {
    errors.push('workerId must be a non-empty string');
  }

  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('name must be a non-empty string');
  }

  if (!obj.publicKey || !HEX_PUBKEY_RE.test(obj.publicKey)) {
    errors.push('publicKey must be a 64-character hex string');
  }

  if (
    !obj.withdrawalAddress ||
    typeof obj.withdrawalAddress !== 'string' ||
    !ETH_ADDRESS_RE.test(obj.withdrawalAddress)
  ) {
    errors.push('withdrawalAddress must be a valid Ethereum address (0x + 40 hex chars)');
  }

  // guardrails
  if (!obj.guardrails || typeof obj.guardrails !== 'object') {
    errors.push('guardrails must be a non-null object');
  } else {
    if (!isValidMicroUsd(obj.guardrails.maxExposureMicroUsd)) {
      errors.push('guardrails.maxExposureMicroUsd must be a valid MicroUsd string');
    }
    if (!isValidMicroUsd(obj.guardrails.minPriceMicroUsd)) {
      errors.push('guardrails.minPriceMicroUsd must be a valid MicroUsd string');
    }
    if (
      typeof obj.guardrails.maxDelegationDepth !== 'number' ||
      !Number.isInteger(obj.guardrails.maxDelegationDepth) ||
      obj.guardrails.maxDelegationDepth < 0
    ) {
      errors.push('guardrails.maxDelegationDepth must be a non-negative integer');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a BuyerIdentity object.
 * @param {*} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBuyerIdentity(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['BuyerIdentity must be a non-null object'] };
  }

  if (!obj.buyerId || typeof obj.buyerId !== 'string') {
    errors.push('buyerId must be a non-empty string');
  }

  if (
    !obj.address ||
    typeof obj.address !== 'string' ||
    !ETH_ADDRESS_RE.test(obj.address)
  ) {
    errors.push('address must be a valid Ethereum address (0x + 40 hex chars)');
  }

  if (!obj.publicKey || !HEX_PUBKEY_RE.test(obj.publicKey)) {
    errors.push('publicKey must be a 64-character hex string');
  }

  return { valid: errors.length === 0, errors };
}
