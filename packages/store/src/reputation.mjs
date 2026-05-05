/**
 * WORK Protocol v4 — Reputation Store
 * Multi-dimensional reputation scores and event history.
 */

/**
 * Upsert a reputation score for a worker in a specific dimension.
 * @param {import('pg').Pool} pool
 * @param {string} workerId
 * @param {string} dimension - e.g. 'quality', 'speed', 'reliability'
 * @param {number} score
 * @returns {Promise<object>} updated row
 */
export async function upsertScore(pool, workerId, dimension, score) {
  const { rows } = await pool.query(
    `INSERT INTO reputation_scores (worker_id, dimension, score, event_count, updated_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (worker_id, dimension)
     DO UPDATE SET
       score = ((reputation_scores.score * reputation_scores.event_count) + $3)
               / (reputation_scores.event_count + 1),
       event_count = reputation_scores.event_count + 1,
       updated_at = NOW()
     RETURNING *`,
    [workerId, dimension, score]
  );
  return rows[0];
}

/**
 * Get all reputation scores for a worker.
 * @param {import('pg').Pool} pool
 * @param {string} workerId
 * @returns {Promise<object[]>}
 */
export async function getScores(pool, workerId) {
  const { rows } = await pool.query(
    'SELECT * FROM reputation_scores WHERE worker_id = $1 ORDER BY dimension',
    [workerId]
  );
  return rows;
}

/**
 * Record a reputation event.
 * @param {import('pg').Pool} pool
 * @param {object} event
 * @param {string} event.id
 * @param {string} event.worker_id
 * @param {string} [event.job_id]
 * @param {string} event.event_type
 * @param {number} event.value
 * @returns {Promise<object>} inserted row
 */
export async function recordEvent(pool, event) {
  const {
    id,
    worker_id,
    job_id = null,
    event_type,
    value,
  } = event;

  const { rows } = await pool.query(
    `INSERT INTO reputation_events (id, worker_id, job_id, event_type, value)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, worker_id, job_id, event_type, value]
  );

  return rows[0];
}

/**
 * Get reputation events for a worker, optionally limited.
 * @param {import('pg').Pool} pool
 * @param {string} workerId
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
export async function getEvents(pool, workerId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT * FROM reputation_events
     WHERE worker_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workerId, limit]
  );
  return rows;
}
