// workers.test.mjs — Tests for workers store module
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closePool } from '../src/db.mjs';
import * as workers from '../src/workers.mjs';
import crypto from 'node:crypto';

describe('workers store', () => {
  /** @type {import('pg').Pool} */
  let pool;

  before(async () => {
    pool = createPool();
    await runMigrations(pool);
    await pool.query('DELETE FROM delegations');
    await pool.query('DELETE FROM jobs');
    await pool.query('DELETE FROM payment_authorizations');
    await pool.query('DELETE FROM services');
    await pool.query('DELETE FROM buyers');
    await pool.query('DELETE FROM workers');
  });

  after(async () => {
    await closePool(pool);
  });

  const workerId = crypto.randomUUID();
  const sampleWorker = {
    id: workerId,
    name: 'TestWorker-1',
    publicKey: 'ed25519_pub_abc123',
    encryptedPrivateKey: 'encrypted_private_key_data',
    withdrawalAddress: '0x1234567890abcdef1234567890abcdef12345678',
    guardrails: { maxPricePerJob: '1000000', allowedModels: ['gpt-4'] },
    status: 'active',
  };

  it('createWorker — creates a new worker', async () => {
    const w = await workers.createWorker(pool, sampleWorker);
    assert.ok(w, 'worker should be created');
    assert.equal(w.id, workerId);
    assert.equal(w.name, 'TestWorker-1');
    assert.equal(w.public_key, 'ed25519_pub_abc123');
    assert.equal(w.encrypted_private_key, 'encrypted_private_key_data');
    assert.equal(w.withdrawal_address, '0x1234567890abcdef1234567890abcdef12345678');
    assert.deepEqual(w.guardrails, { maxPricePerJob: '1000000', allowedModels: ['gpt-4'] });
    assert.equal(w.status, 'active');
  });

  it('createWorker — idempotent (ON CONFLICT DO NOTHING)', async () => {
    const w = await workers.createWorker(pool, sampleWorker);
    assert.equal(w, null, 'duplicate insert should return null');
  });

  it('getWorker — retrieves an existing worker', async () => {
    const w = await workers.getWorker(pool, workerId);
    assert.ok(w, 'worker should be found');
    assert.equal(w.id, workerId);
    assert.equal(w.name, 'TestWorker-1');
  });

  it('getWorker — returns null for missing worker', async () => {
    const w = await workers.getWorker(pool, 'nonexistent-id');
    assert.equal(w, null);
  });

  it('updateGuardrails — updates guardrails', async () => {
    const newGuardrails = { maxPricePerJob: '500000', allowedModels: ['claude-3'] };
    const w = await workers.updateGuardrails(pool, workerId, newGuardrails);
    assert.ok(w, 'worker should be returned');
    assert.deepEqual(w.guardrails, newGuardrails);
  });

  it('listByStatus — lists workers by status', async () => {
    // Create another active worker
    const id2 = crypto.randomUUID();
    await workers.createWorker(pool, {
      id: id2,
      name: 'TestWorker-2',
      publicKey: 'ed25519_pub_def456',
      encryptedPrivateKey: 'enc2',
      withdrawalAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'active',
    });

    // Create an inactive worker
    const id3 = crypto.randomUUID();
    await workers.createWorker(pool, {
      id: id3,
      name: 'TestWorker-3',
      publicKey: 'ed25519_pub_ghi789',
      encryptedPrivateKey: 'enc3',
      withdrawalAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      status: 'inactive',
    });

    const active = await workers.listByStatus(pool, 'active');
    assert.ok(active.length >= 2, 'should have at least 2 active workers');

    const inactive = await workers.listByStatus(pool, 'inactive');
    assert.ok(inactive.length >= 1, 'should have at least 1 inactive worker');
    assert.equal(inactive[0].name, 'TestWorker-3');
  });
});
