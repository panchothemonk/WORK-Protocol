/**
 * WORK Protocol v4 — Webhooks Store
 * Outbound webhook registration and delivery tracking.
 */

/**
 * Create a webhook registration.
 * @param {import('pg').Pool} pool
 * @param {object} wh
 * @param {string} wh.id
 * @param {string} wh.url
 * @param {string[]} wh.events
 * @param {string} wh.secret
 * @param {string} [wh.status='active']
 * @returns {Promise<object>} inserted row
 */
export async function createWebhook(pool, wh) {
  const {
    id,
    url,
    events,
    secret,
    status = 'active',
  } = wh;

  const { rows } = await pool.query(
    `INSERT INTO webhooks (id, url, events, secret, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, url, events, secret, status]
  );

  return rows[0];
}

/**
 * Get a webhook by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getWebhook(pool, id) {
  const { rows } = await pool.query(
    'SELECT * FROM webhooks WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * List all active webhooks.
 * @param {import('pg').Pool} pool
 * @returns {Promise<object[]>}
 */
export async function listActive(pool) {
  const { rows } = await pool.query(
    'SELECT * FROM webhooks WHERE status = $1 ORDER BY created_at DESC',
    ['active']
  );
  return rows;
}

/**
 * Delete (deactivate) a webhook by ID.
 * Sets status to 'deleted' rather than actually removing the row.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>} updated row
 */
export async function deleteWebhook(pool, id) {
  const { rows } = await pool.query(
    `UPDATE webhooks SET status = 'deleted' WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Record a webhook delivery attempt.
 * @param {import('pg').Pool} pool
 * @param {object} delivery
 * @param {string} delivery.id
 * @param {string} delivery.webhook_id
 * @param {string} delivery.event_type
 * @param {object} delivery.payload
 * @param {string} [delivery.status='pending']
 * @returns {Promise<object>} inserted row
 */
export async function createDelivery(pool, delivery) {
  const {
    id,
    webhook_id,
    event_type,
    payload,
    status = 'pending',
  } = delivery;

  const { rows } = await pool.query(
    `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, webhook_id, event_type, JSON.stringify(payload), status]
  );

  return rows[0];
}

/**
 * Update a webhook delivery status and increment attempt counter.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string} status - 'delivered', 'failed', 'pending'
 * @returns {Promise<object|null>} updated row
 */
export async function updateDelivery(pool, id, status) {
  const { rows } = await pool.query(
    `UPDATE webhook_deliveries
     SET status = $2, attempts = attempts + 1, last_attempt_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}
