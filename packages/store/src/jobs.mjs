// jobs.mjs — Job lifecycle CRUD operations
import './db.mjs';

/**
 * Create a new job.
 * @param {import('pg').Pool} pool
 * @param {object} job - { id, workerId, buyerId?, serviceId?, paymentAuthId?, inputHash, status?, model?, modelProvider?, timeoutAt? }
 * @returns {Promise<object>} The created job
 */
export async function createJob(pool, job) {
  const { rows } = await pool.query(
    `INSERT INTO jobs (id, worker_id, buyer_id, service_id, payment_auth_id, input_hash, status, model, model_provider, timeout_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      job.id,
      job.workerId,
      job.buyerId || null,
      job.serviceId || null,
      job.paymentAuthId || null,
      job.inputHash,
      job.status || 'created',
      job.model || null,
      job.modelProvider || null,
      job.timeoutAt || null,
    ]
  );
  return rows[0] || null;
}

/**
 * Get a job by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getJob(pool, id) {
  const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Update a job's status.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string} status
 * @returns {Promise<object|null>}
 */
export async function updateStatus(pool, id, status) {
  const updates = { status };
  const setClauses = ['status = $2'];

  if (status === 'completed') {
    setClauses.push('completed_at = NOW()');
  } else if (status === 'failed') {
    setClauses.push('failed_at = NOW()');
  }

  const { rows } = await pool.query(
    `UPDATE jobs SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

/**
 * List jobs for a worker.
 * @param {import('pg').Pool} pool
 * @param {string} workerId
 * @returns {Promise<object[]>}
 */
export async function listByWorker(pool, workerId) {
  const { rows } = await pool.query(
    'SELECT * FROM jobs WHERE worker_id = $1 ORDER BY created_at DESC',
    [workerId]
  );
  return rows;
}

/**
 * List jobs for a buyer.
 * @param {import('pg').Pool} pool
 * @param {string} buyerId
 * @returns {Promise<object[]>}
 */
export async function listByBuyer(pool, buyerId) {
  const { rows } = await pool.query(
    'SELECT * FROM jobs WHERE buyer_id = $1 ORDER BY created_at DESC',
    [buyerId]
  );
  return rows;
}

/**
 * Set the result hash for a completed job.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string} resultHash
 * @returns {Promise<object|null>}
 */
export async function setResult(pool, id, resultHash) {
  const { rows } = await pool.query(
    `UPDATE jobs
     SET result_hash = $2, status = 'completed', completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, resultHash]
  );
  return rows[0] || null;
}

/**
 * Set the timeout for a job.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string|Date} timeoutAt
 * @returns {Promise<object|null>}
 */
export async function setTimeout(pool, id, timeoutAt) {
  const { rows } = await pool.query(
    `UPDATE jobs SET timeout_at = $2 WHERE id = $1 RETURNING *`,
    [id, timeoutAt]
  );
  return rows[0] || null;
}
