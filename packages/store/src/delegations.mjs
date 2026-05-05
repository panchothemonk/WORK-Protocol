/**
 * WORK Protocol v4 — Delegations Store
 * Parent-child job relationships: delegation lifecycle management.
 */

/**
 * Create a delegation between a parent and child job.
 * @param {import('pg').Pool} pool
 * @param {object} del
 * @param {string} del.id
 * @param {string} del.parent_job_id
 * @param {string} del.child_job_id
 * @param {string} del.budget_micro_usd
 * @param {string} [del.status='pending']
 * @param {string} del.timeout_at - ISO 8601 timestamp
 * @returns {Promise<object>} inserted row
 */
export async function createDelegation(pool, del) {
  const {
    id,
    parent_job_id,
    child_job_id,
    budget_micro_usd,
    status = 'pending',
    timeout_at,
  } = del;

  const { rows } = await pool.query(
    `INSERT INTO delegations (id, parent_job_id, child_job_id, budget_micro_usd, status, timeout_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, parent_job_id, child_job_id, budget_micro_usd, status, timeout_at]
  );

  return rows[0];
}

/**
 * Get a delegation by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getDelegation(pool, id) {
  const { rows } = await pool.query(
    'SELECT * FROM delegations WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * List all child delegations for a parent job.
 * @param {import('pg').Pool} pool
 * @param {string} parentJobId
 * @returns {Promise<object[]>}
 */
export async function listByParent(pool, parentJobId) {
  const { rows } = await pool.query(
    'SELECT * FROM delegations WHERE parent_job_id = $1 ORDER BY created_at DESC',
    [parentJobId]
  );
  return rows;
}

/**
 * Update delegation status.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string} status - 'pending', 'accepted', 'completed', 'expired', 'rejected'
 * @returns {Promise<object|null>} updated row
 */
export async function updateStatus(pool, id, status) {
  const updates = ['status = $2'];
  const params = [id, status];

  // Auto-set completed_at when status becomes 'completed'
  if (status === 'completed') {
    updates.push('completed_at = NOW()');
  }

  const { rows } = await pool.query(
    `UPDATE delegations
     SET ${updates.join(', ')}
     WHERE id = $1
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

/**
 * Get all expired delegations that are still pending.
 * @param {import('pg').Pool} pool
 * @returns {Promise<object[]>}
 */
export async function getExpired(pool) {
  const { rows } = await pool.query(
    `SELECT * FROM delegations
     WHERE status = 'pending' AND timeout_at < NOW()`
  );
  return rows;
}
