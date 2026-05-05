// signing.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closePool } from '../src/db.mjs';
import * as signing from '../src/signing.mjs';

describe('signing store', () => {
  let pool;
  before(async () => {
    pool = createPool();
    await runMigrations(pool);
    await pool.query('DELETE FROM signing_keys');
  });
  after(async () => { await closePool(pool); });

  it('saves and loads a signing key', async () => {
    await signing.saveSigningKey(pool, 'encrypted_key_data_abc');
    const key = await signing.loadSigningKey(pool);
    assert.ok(key);
    assert.equal(key.encrypted_data, 'encrypted_key_data_abc');
  });

  it('loadSigningKey returns null when no key exists', async () => {
    await pool.query('DELETE FROM signing_keys');
    const key = await signing.loadSigningKey(pool);
    assert.equal(key, null);
  });

  it('rotates a signing key', async () => {
    await signing.saveSigningKey(pool, 'old_encrypted');
    const result = await signing.rotateSigningKey(pool, 'old_encrypted', 'new_encrypted');
    assert.ok(result);
    assert.equal(result.encrypted_data, 'new_encrypted');
  });
});
