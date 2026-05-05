/**
 * WORK Protocol v4 — Receipts Store
 * Cryptographic proof of work: receipt creation, lookup, verification.
 */

/**
 * Create a receipt record.
 * @param {import('pg').Pool} pool
 * @param {object} receipt
 * @param {string} receipt.id
 * @param {string} receipt.job_id
 * @param {string} receipt.receipt_type
 * @param {object} receipt.data - Full receipt payload (JSONB)
 * @param {string} receipt.receipt_hash
 * @param {string} [receipt.base_anchor_tx]
 * @returns {Promise<object>} inserted row
 */
export async function createReceipt(pool, receipt) {
  const {
    id,
    job_id,
    receipt_type,
    data,
    receipt_hash,
    base_anchor_tx = null,
  } = receipt;

  const { rows } = await pool.query(
    `INSERT INTO receipts (id, job_id, receipt_type, data, receipt_hash, base_anchor_tx)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, job_id, receipt_type, JSON.stringify(data), receipt_hash, base_anchor_tx]
  );

  return rows[0];
}

/**
 * Get a receipt by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getReceipt(pool, id) {
  const { rows } = await pool.query(
    'SELECT * FROM receipts WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Get a receipt by its hash (unique).
 * @param {import('pg').Pool} pool
 * @param {string} hash
 * @returns {Promise<object|null>}
 */
export async function getByHash(pool, hash) {
  const { rows } = await pool.query(
    'SELECT * FROM receipts WHERE receipt_hash = $1',
    [hash]
  );
  return rows[0] || null;
}

/**
 * List receipts associated with a worker.
 * Searches the JSONB data field for the worker ID.
 * @param {import('pg').Pool} pool
 * @param {string} workerId
 * @returns {Promise<object[]>}
 */
export async function listByWorker(pool, workerId) {
  const { rows } = await pool.query(
    `SELECT * FROM receipts
     WHERE data->'ids'->>'workerId' = $1
     ORDER BY created_at DESC`,
    [workerId]
  );
  return rows;
}
