/**
 * WORK Protocol v4 — Database Layer
 * PostgreSQL 16 connection management and migrations.
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '..', 'migrations');

/**
 * Create a PostgreSQL connection pool.
 * @param {string} [connectionString] - DATABASE_URL or pg connection config
 * @param {object} [options] - Additional pool options
 * @returns {pg.Pool}
 */
export function createPool(connectionString, options = {}) {
  const config = typeof connectionString === 'string'
    ? { connectionString, ...options }
    : connectionString || { connectionString: process.env.DATABASE_URL || 'postgresql://workprotocol:workprotocol@localhost:5432/workprotocol', ...options };

  return new pg.Pool(config);
}

/**
 * Execute a single query. Convenience wrapper for one-off queries.
 * @param {pg.Pool} pool
 * @param {string} text - SQL query
 * @param {any[]} [params] - Parameter values
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(pool, text, params = []) {
  return pool.query(text, params);
}

/**
 * Get a client from the pool for transactions.
 * @param {pg.Pool} pool
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient(pool) {
  return pool.connect();
}

/**
 * Close the pool and all connections.
 * @param {pg.Pool} pool
 * @returns {Promise<void>}
 */
export async function closePool(pool) {
  await pool.end();
}

/**
 * Run all migrations from the migrations directory in order.
 * Each migration file is named NNNN_description.sql.
 * Tracks applied migrations in a _migrations table.
 * @param {pg.Pool} pool
 * @returns {Promise<string[]>} list of applied migration filenames
 */
export async function runMigrations(pool) {
  // Ensure migrations tracking table exists (also created by 0001_init.sql)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Read migration files
  let files = [];
  try {
    files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    // No migrations directory / no files
    return [];
  }

  const applied = [];

  for (const file of files) {
    // Check if already applied
    const { rows } = await pool.query(
      'SELECT name FROM migrations WHERE name = $1',
      [file]
    );

    if (rows.length > 0) {
      continue; // Already applied
    }

    // Read and run migration
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);

    // Record migration
    await pool.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [file]
    );

    applied.push(file);
  }

  return applied;
}
