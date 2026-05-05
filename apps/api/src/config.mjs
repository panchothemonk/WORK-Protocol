/**
 * WORK Protocol v4 — Config
 * Validates all required env vars at startup.
 */
const required = ['DATABASE_URL'];
const optional = [
  'CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY',
  'BASE_SETTLEMENT_PRIVATE_KEY', 'BASE_VAULT_ADDRESS',
  'WORK_PROTOCOL_FEE_BPS', 'SIGNING_KEY_ENCRYPTION_KEY',
  'RATE_LIMIT_PUBLIC_RPM', 'RATE_LIMIT_AUTHED_RPM',
  'PORT', 'BASE_NETWORK',
];

/**
 * Validate required env vars. Throws on missing.
 */
export function validate() {
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

/**
 * Get config with defaults.
 */
export function get() {
  validate();
  return {
    port: parseInt(process.env.PORT || '3100', 10),
    databaseUrl: process.env.DATABASE_URL,
    feeBps: parseInt(process.env.WORK_PROTOCOL_FEE_BPS || '300', 10),
    vaultAddress: process.env.BASE_VAULT_ADDRESS || '0xf6D6Dd0B47B433dcA95d7B69586c6c5Cd7CbD63A',
    network: process.env.BASE_NETWORK || 'base-mainnet',
    cdpConfigured: !!(process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY),
    rateLimitPublic: parseInt(process.env.RATE_LIMIT_PUBLIC_RPM || '30', 10),
    rateLimitAuthed: parseInt(process.env.RATE_LIMIT_AUTHED_RPM || '300', 10),
  };
}
