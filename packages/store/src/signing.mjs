/**
 * WORK Protocol v4 — Signing Key Store
 * Secure storage and rotation of the protocol Ed25519 signing key.
 * The key is encrypted at rest; encryption/decryption happens outside this module.
 */

/**
 * Load the current encrypted signing key from the database.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ encrypted_key: string, created_at: string, rotated_at: string|null }|null>}
 */
export async function loadSigningKey(pool) {
  const { rows } = await pool.query(
    `SELECT encrypted_key, created_at, rotated_at
     FROM signing_keys
     WHERE id = 'current'
     LIMIT 1`
  );
  return rows[0] || null;
}

/**
 * Save (upsert) the encrypted signing key.
 * @param {import('pg').Pool} pool
 * @param {string} encryptedKey - The encrypted Ed25519 private key
 * @returns {Promise<object>} inserted/updated row
 */
export async function saveSigningKey(pool, encryptedKey) {
  const { rows } = await pool.query(
    `INSERT INTO signing_keys (id, encrypted_key, created_at)
     VALUES ('current', $1, NOW())
     ON CONFLICT (id)
     DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, rotated_at = NULL
     RETURNING *`,
    [encryptedKey]
  );
  return rows[0];
}

/**
 * Rotate the signing key: replace the old encrypted key with a new one.
 * Records rotation timestamp for auditing.
 * @param {import('pg').Pool} pool
 * @param {string} oldEncrypted - The previous encrypted key (for verification)
 * @param {string} newEncrypted - The new encrypted key to store
 * @returns {Promise<object>} updated row
 */
export async function rotateSigningKey(pool, oldEncrypted, newEncrypted) {
  const { rows } = await pool.query(
    `UPDATE signing_keys
     SET encrypted_key = $2, rotated_at = NOW()
     WHERE id = 'current' AND encrypted_key = $1
     RETURNING *`,
    [oldEncrypted, newEncrypted]
  );
  return rows[0] || null;
}
