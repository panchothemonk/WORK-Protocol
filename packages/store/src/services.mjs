// services.mjs — Service listing CRUD operations
import './db.mjs';

/**
 * Create a new service listing.
 * @param {import('pg').Pool} pool
 * @param {object} svc - { id, workerId, name, description?, priceMicroUsd, category?, status? }
 * @returns {Promise<object>} The created service
 */
export async function createService(pool, svc) {
  const { rows } = await pool.query(
    `INSERT INTO services (id, worker_id, name, description, price_micro_usd, category, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      svc.id,
      svc.workerId,
      svc.name,
      svc.description || null,
      svc.priceMicroUsd,
      svc.category || null,
      svc.status || 'draft',
    ]
  );
  return rows[0] || null;
}

/**
 * Get a service by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getService(pool, id) {
  const { rows } = await pool.query(
    'SELECT * FROM services WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * List all services for a given worker.
 * @param {import('pg').Pool} pool
 * @param {string} workerId
 * @returns {Promise<object[]>}
 */
export async function listByWorker(pool, workerId) {
  const { rows } = await pool.query(
    'SELECT * FROM services WHERE worker_id = $1 ORDER BY created_at DESC',
    [workerId]
  );
  return rows;
}

/**
 * Update a service's status.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string} status
 * @returns {Promise<object|null>}
 */
export async function updateStatus(pool, id, status) {
  const { rows } = await pool.query(
    `UPDATE services
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

/**
 * Search services with optional filters.
 * @param {import('pg').Pool} pool
 * @param {object} filters - { category?, minPrice?, maxPrice?, status? }
 * @returns {Promise<object[]>}
 */
export async function search(pool, { category, minPrice, maxPrice, status } = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(category);
  }
  if (minPrice !== undefined && minPrice !== null) {
    conditions.push(`price_micro_usd::bigint >= $${paramIndex++}`);
    params.push(String(minPrice));
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    conditions.push(`price_micro_usd::bigint <= $${paramIndex++}`);
    params.push(String(maxPrice));
  }
  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM services ${where} ORDER BY created_at DESC`,
    params
  );
  return rows;
}
