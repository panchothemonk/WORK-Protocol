/**
 * WORK Protocol v4 — Payment Module
 * CDP x402 facilitator (PRIMARY) + EIP-3009 helpers.
 * Zero gas via Coinbase CDP — 1,000 free tx/month.
 */
import { createCdpAuthHeaders } from '@coinbase/x402';
import { HTTPFacilitatorClient } from '@x402/core/http';

// ---- Configuration ---------------------------------------------------------

/**
 * Check if CDP credentials are available.
 * @returns {boolean}
 */
export function isCdpConfigured() {
  return !!(process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY);
}

/**
 * Create a CDP x402 facilitator client.
 * Uses @coinbase/x402 createCdpAuthHeaders for JWT + Correlation-Context.
 * @returns {HTTPFacilitatorClient}
 */
export function createCdpClient() {
  return new HTTPFacilitatorClient({
    url: 'https://api.cdp.coinbase.com/platform/v2/x402',
    createAuthHeaders: createCdpAuthHeaders(
      process.env.CDP_API_KEY_NAME,
      process.env.CDP_API_KEY_PRIVATE_KEY
    ),
  });
}

// ---- EIP-3009 helpers ------------------------------------------------------

/**
 * Build an EIP-3009 transferWithAuthorization call.
 * @param {object} params
 * @param {string} params.from - buyer address
 * @param {string} params.to - recipient address
 * @param {string} params.value - amount in wei/USDC units (BigInt-safe string)
 * @param {string} params.nonce - unique nonce
 * @param {number} params.validAfter - Unix timestamp
 * @param {number} params.validBefore - Unix timestamp
 * @returns {object} unsigned transfer params
 */
export function buildTransferAuthorization({ from, to, value, nonce, validAfter, validBefore }) {
  return {
    from,
    to,
    value: String(value),
    nonce: String(nonce),
    validAfter: String(validAfter),
    validBefore: String(validBefore),
  };
}

/**
 * Build 3 EIP-3009 transfer authorizations for the protocol's 3-way split.
 * @param {object} params
 * @param {string} params.buyerAddress
 * @param {Array<{purpose:string, amountMicroUsd:string, toAddress:string}>} params.splits
 * @param {object} params.nonces - { worker_payout, ai_cost, protocol_fee }
 * @returns {Array<object>} three unsigned transfer authorizations
 */
export function buildThreeWayTransfers({ buyerAddress, splits, nonces, validAfter = 0, validBefore = Math.floor(Date.now()/1000) + 86400 }) {
  return splits.map(split => ({
    purpose: split.purpose,
    transfer: buildTransferAuthorization({
      from: buyerAddress,
      to: split.toAddress,
      value: split.amountMicroUsd,
      nonce: nonces[split.purpose],
      validAfter,
      validBefore,
    }),
  }));
}

// ---- Settlement ------------------------------------------------------------

/**
 * Verify 3 EIP-3009 signatures via CDP x402 facilitator.
 * @param {HTTPFacilitatorClient} client
 * @param {Array<{signature:object, transfer:object}>} signedTransfers
 * @returns {Promise<{valid:boolean, results?:Array}>}
 */
export async function verifyTransfers(client, signedTransfers) {
  try {
    const results = await Promise.all(
      signedTransfers.map(st => client.verify(st))
    );
    const allValid = results.every(r => r.valid === true);
    return { valid: allValid, results };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Settle verified transfers on-chain via CDP x402 facilitator.
 * @param {HTTPFacilitatorClient} client
 * @param {Array<{signature:object, transfer:object}>} signedTransfers
 * @returns {Promise<{success:boolean, txHashes?:string[], error?:string}>}
 */
export async function settleTransfers(client, signedTransfers) {
  try {
    const results = await Promise.all(
      signedTransfers.map(st => client.settle(st))
    );
    const txHashes = results.map(r => r.txHash).filter(Boolean);
    return { success: txHashes.length === signedTransfers.length, txHashes };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
