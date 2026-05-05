// buyers.mjs — Buyer CRUD operations
import './db.mjs';

/**
 * Create a new buyer.
 * @param {import('pg').Pool} pool
 * @param {object} buyer - { id, address, publicKey }
 * @returns {Promise<object>} The created buyer
 */
export async function createBuyer(pool, buyer) {
  const { rows } = await pool.query(
    `INSERT INTO buyers (id, address, public_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [buyer.id, buyer.address, buyer.publicKey]
  );
  return rows[0] || null;
}

/**
 * Get a buyer by ID.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getBuyer(pool, id) {
  const { rows } = await pool.query('SELECT * FROM buyers WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Get a buyer by on-chain address.
 * @param {import('pg').Pool} pool
 * @param {string} address
 * @returns {Promise<object|null>}
 */
export async function getByAddress(pool, address) {
  const { rows } = await pool.query(
    'SELECT * FROM buyers WHERE address = $1',
    [address]
  );
  return rows[0] || null;
}
