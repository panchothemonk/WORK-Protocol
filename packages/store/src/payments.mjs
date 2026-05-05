/**
 * WORK Protocol v4 — Payments Store
 * Payment authorization lifecycle: secure → settle → reconcile.
 */

/**
 * Create a payment authorization record.
 * @param {import('pg').Pool} pool
 * @param {object} pa
 * @param {string} pa.id
 * @param {string} pa.job_id
 * @param {string} [pa.rail='x402']
 * @param {string} [pa.status='secured']
 * @param {object|Array} pa.splits - Payment splits (will be JSONB)
 * @param {string} [pa.settlement_id]
 * @param {string[]} [pa.tx_hashes]
 * @returns {Promise<object>} inserted row
 */
export async function createPaymentAuth(pool, pa) {
  const {
    id,
    job_id,
    rail = 'x402',
    status = 'secured',
    splits,
    settlement_id = null,
    tx_hashes = null,
  } = pa;

  const { rows } = await pool.query(
    `INSERT INTO payment_authorizations (id, job_id, rail, status, splits, settlement_id, tx_hashes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, job_id, rail, status, JSON.stringify(splits), settlement_id, tx_hashes]
  );

  return rows[0];
}

/**
 * Get a payment authorization by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getPaymentAuth(pool, id) {
  const { rows } = await pool.query(
    'SELECT * FROM payment_authorizations WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Update settlement details for a payment authorization.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string} settlementId
 * @param {string[]} txHashes
 * @returns {Promise<object|null>} updated row
 */
export async function updateSettlement(pool, id, settlementId, txHashes) {
  const { rows } = await pool.query(
    `UPDATE payment_authorizations
     SET settlement_id = $2, tx_hashes = $3, status = 'settled', settled_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, settlementId, txHashes]
  );
  return rows[0] || null;
}

/**
 * Get all payment authorizations for a job.
 * @param {import('pg').Pool} pool
 * @param {string} jobId
 * @returns {Promise<object[]>}
 */
export async function getByJobId(pool, jobId) {
  const { rows } = await pool.query(
    'SELECT * FROM payment_authorizations WHERE job_id = $1 ORDER BY created_at DESC',
    [jobId]
  );
  return rows;
}
