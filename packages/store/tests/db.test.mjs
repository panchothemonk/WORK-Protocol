import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPool,
  query,
  runMigrations,
  closePool,
  getClient,
} from '../src/db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://workprotocol:workprotocol@localhost:5432/work_test';

/** @type {import('pg').Pool} */
let pool;

before(async () => {
  pool = createPool(DATABASE_URL);
});

after(async () => {
  // Clean up test tables
  try {
    await pool.query('DROP TABLE IF EXISTS _test_people CASCADE');
    await pool.query('DROP TABLE IF EXISTS _txn_test CASCADE');
    await pool.query('DROP TABLE IF EXISTS _txn_commit CASCADE');
    await pool.query('DROP TABLE IF EXISTS signing_keys CASCADE');
    await pool.query('DROP TABLE IF EXISTS migrations CASCADE');
  } catch {
    // ignore cleanup errors
  }
  await closePool(pool);
});

describe('db.mjs', () => {
  describe('createPool', () => {
    it('should create a Pool instance', () => {
      assert.ok(pool, 'pool should be truthy');
      assert.equal(typeof pool.query, 'function', 'pool should have query method');
      assert.equal(typeof pool.connect, 'function', 'pool should have connect method');
      assert.equal(typeof pool.end, 'function', 'pool should have end method');
    });
  });

  describe('query', () => {
    it('should execute a simple SELECT and return rows', async () => {
      const result = await query(pool, 'SELECT 1 AS num');
      assert.ok(Array.isArray(result.rows), 'rows should be an array');
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].num, 1);
    });

    it('should handle parameterized queries', async () => {
      const result = await query(pool, 'SELECT $1::text AS val', ['hello']);
      assert.equal(result.rows[0].val, 'hello');
    });

    it('should create a table, insert, and select using a single client', async () => {
      const client = await getClient(pool);
      try {
        // Use a regular table so it persists across statements on the same connection
        await client.query('CREATE TEMP TABLE _test_people (id SERIAL PRIMARY KEY, name TEXT NOT NULL)');
        await client.query("INSERT INTO _test_people (name) VALUES ('Alice')");
        const result = await client.query('SELECT * FROM _test_people');
        assert.equal(result.rows.length, 1);
        assert.equal(result.rows[0].name, 'Alice');
      } finally {
        client.release();
      }
    });
  });

  describe('getClient', () => {
    it('should return a client that supports rollback', async () => {
      const client = await getClient(pool);
      assert.ok(client, 'client should be truthy');
      assert.equal(typeof client.query, 'function');
      assert.equal(typeof client.release, 'function');

      try {
        await client.query('CREATE TEMP TABLE _txn_test (val int)');
        await client.query('BEGIN');
        await client.query('INSERT INTO _txn_test (val) VALUES (42)');
        await client.query('ROLLBACK');

        // After rollback, the inserted row should not be visible
        const result = await client.query('SELECT * FROM _txn_test');
        assert.equal(result.rows.length, 0, 'insert should be rolled back');
      } finally {
        client.release();
      }
    });

    it('should allow committing a transaction', async () => {
      const client = await getClient(pool);
      try {
        await client.query('CREATE TEMP TABLE _txn_commit (val int)');
        await client.query('BEGIN');
        await client.query("INSERT INTO _txn_commit (val) VALUES (99)");
        await client.query('COMMIT');

        const result = await client.query('SELECT * FROM _txn_commit');
        assert.equal(result.rows.length, 1);
        assert.equal(result.rows[0].val, 99);
      } finally {
        client.release();
      }
    });
  });

  describe('runMigrations', () => {
    // Run all migration tests sequentially to avoid concurrency conflicts
    it('should create migrations table, apply 0001_init.sql, and be idempotent', async () => {
      // --- Part 1: Fresh run ---
      await pool.query('DROP TABLE IF EXISTS signing_keys CASCADE');
      await pool.query('DROP TABLE IF EXISTS migrations CASCADE');

      const applied = await runMigrations(pool, MIGRATIONS_DIR);

      assert.ok(Array.isArray(applied), 'should return an array');
      assert.ok(applied.includes('0001_init.sql'), 'should apply 0001_init.sql');

      // Verify migrations table exists with the record
      let migResult = await pool.query('SELECT * FROM migrations WHERE name = $1', ['0001_init.sql']);
      assert.equal(migResult.rows.length, 1);
      assert.equal(migResult.rows[0].name, '0001_init.sql');

      // Verify signing_keys table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'signing_keys'
        ) AS exists
      `);
      assert.equal(tableCheck.rows[0].exists, true);

      // Verify signing_keys table has the expected columns
      const cols = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'signing_keys'
        ORDER BY ordinal_position
      `);
      const colNames = cols.rows.map((r) => r.column_name);
      assert.ok(colNames.includes('id'));
      assert.ok(colNames.includes('encrypted_data'));
      assert.ok(colNames.includes('created_at'));
      assert.ok(colNames.includes('rotated_at'));

      // --- Part 2: Idempotency ---
      const applied2 = await runMigrations(pool, MIGRATIONS_DIR);
      assert.equal(applied2.length, 0, 'second run should apply zero migrations');

      // Verify we still have exactly one migration record
      migResult = await pool.query('SELECT * FROM migrations WHERE name = $1', ['0001_init.sql']);
      assert.equal(migResult.rows.length, 1, 'only one migration record should exist');
    });
  });
});
