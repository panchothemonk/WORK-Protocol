// workers.mjs — Worker CRUD operations
import './db.mjs';

/**
 * Create a new worker.
 * @param {import('pg').Pool} pool
 * @param {object} worker - { id, name, publicKey, encryptedPrivateKey, withdrawalAddress, guardrails?, status? }
 * @returns {Promise<object>} The created worker
 */
export async function createWorker(pool, worker) {
  const { rows } = await pool.query(
    `INSERT INTO workers (id, name, public_key, encrypted_private_key, withdrawal_address, guardrails, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      worker.id,
      worker.name,
      worker.publicKey,
      worker.encryptedPrivateKey,
      worker.withdrawalAddress,
      JSON.stringify(worker.guardrails || {}),
      worker.status || 'active',
    ]
  );
  return rows[0] || null;
}

/**
 * Get a worker by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getWorker(pool, id) {
  const { rows } = await pool.query('SELECT * FROM workers WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Update a worker's guardrails.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {object} guardrails
 * @returns {Promise<object|null>}
 */
export async function updateGuardrails(pool, id, guardrails) {
  const { rows } = await pool.query(
    `UPDATE workers
     SET guardrails = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(guardrails)]
  );
  return rows[0] || null;
}

/**
 * List workers by status.
 * @param {import('pg').Pool} pool
 * @param {string} status
 * @returns {Promise<object[]>}
 */
export async function listByStatus(pool, status) {
  const { rows } = await pool.query(
    'SELECT * FROM workers WHERE status = $1 ORDER BY created_at DESC',
    [status]
  );
  return rows;
}
