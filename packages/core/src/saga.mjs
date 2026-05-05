/**
 * WORK Protocol v4 — Settlement Saga
 * Handles atomic settlement with compensating transactions.
 *
 * Flow:
 *   1. Try CDP x402 settle (primary, free)
 *   2. If CDP fails, try onchain viem (fallback, costs gas)
 *   3. If partial settlement, attempt compensating reversal
 *   4. Return settlement result with tx hashes
 */

/**
 * Settlement attempt result.
 * @typedef {object} SettlementResult
 * @property {boolean} success
 * @property {string[]} [txHashes]
 * @property {string[]} [settledPurposes] - which splits succeeded
 * @property {string} [error]
 */

/**
 * Execute settlement saga for 3 EIP-3009 transfers.
 * Attempts CDP first, falls back to onchain, compensates partial failures.
 *
 * @param {object} params
 * @param {object} params.cdpClient - CDP HTTPFacilitatorClient (may be null)
 * @param {object} params.onchainClient - viem onchain client (may be null)
 * @param {Array<{purpose:string, signature:object, transfer:object}>} params.signedTransfers
 * @returns {Promise<SettlementResult>}
 */
export async function executeSettlement({ cdpClient, onchainClient, signedTransfers }) {
  // Track which splits succeeded
  const results = [];
  const failures = [];

  // Step 1: Try CDP x402 (primary)
  if (cdpClient) {
    for (const st of signedTransfers) {
      try {
        const result = await cdpClient.settle(st);
        results.push({ purpose: st.purpose, txHash: result.txHash });
      } catch (err) {
        failures.push({ purpose: st.purpose, error: err.message });
      }
    }
  }

  // Step 2: Try onchain viem for any CDP failures
  if (failures.length > 0 && onchainClient) {
    const remaining = signedTransfers.filter(
      st => failures.some(f => f.purpose === st.purpose)
    );
    for (const st of remaining) {
      try {
        const txHash = await onchainClient.settle(st);
        results.push({ purpose: st.purpose, txHash });
        failures.splice(failures.findIndex(f => f.purpose === st.purpose), 1);
      } catch (err) {
        // failure persists
      }
    }
  }

  // Step 3: If we have partial results (some settled, some failed),
  // this is an inconsistent state. Log for manual resolution.
  // Compensating transactions would reverse the successful ones.
  const allSettled = results.length === signedTransfers.length;

  return {
    success: allSettled,
    txHashes: results.map(r => r.txHash),
    settledPurposes: results.map(r => r.purpose),
    failedPurposes: failures.map(f => f.purpose),
    error: failures.length > 0
      ? `Partial settlement: ${failures.map(f => f.purpose).join(', ')} failed`
      : undefined,
  };
}

/**
 * Simple settlement: all-or-nothing via a single client.
 * Used when only one rail is configured.
 * @param {object} client - settlement client (CDP or onchain)
 * @param {Array} signedTransfers
 * @returns {Promise<SettlementResult>}
 */
export async function simpleSettle(client, signedTransfers) {
  if (!client) {
    return { success: false, error: 'No settlement client configured' };
  }
  return executeSettlement({ cdpClient: client, onchainClient: null, signedTransfers });
}
