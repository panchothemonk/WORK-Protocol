/**
 * WORK Protocol v4 — Payment Helpers
 * BigInt-safe serialization for CDP API, unit conversion.
 */

/**
 * Deep-convert all BigInt values to strings for CDP API JSON serialization.
 * JSON.stringify throws on BigInt — this prevents that.
 * @param {*} obj - any value that might contain BigInt
 * @returns {*} same structure with BigInt → string
 */
export function serializeForCdp(obj) {
  if (typeof obj === 'bigint') return String(obj);
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serializeForCdp);
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeForCdp(value);
    }
    return result;
  }
  return obj;
}

/**
 * Convert microUSD string to human-readable USD number.
 * @param {string} microUsd - e.g. "1000000" = $1.00
 * @returns {number}
 */
export function microUsdToHuman(microUsd) {
  return Number(BigInt(microUsd)) / 1_000_000;
}

/**
 * Convert human USD to microUSD string.
 * @param {number} usd - e.g. 1.00
 * @returns {string} e.g. "1000000"
 */
export function humanToMicroUsd(usd) {
  return String(BigInt(Math.round(usd * 1_000_000)));
}

/**
 * Build a CDP settlement request body.
 * @param {object} params
 * @returns {object} ready for JSON.stringify
 */
export function buildSettlementRequest({ splits, signatures }) {
  return serializeForCdp({
    splits,
    signatures,
  });
}
