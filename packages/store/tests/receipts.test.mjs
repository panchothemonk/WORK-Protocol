// receipts.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closePool } from '../src/db.mjs';
import * as workers from '../src/workers.mjs';
import * as jobs from '../src/jobs.mjs';
import * as receipts from '../src/receipts.mjs';
import crypto from 'node:crypto';

describe('receipts store', () => {
  let pool, workerId, jobId;
  before(async () => {
    pool = createPool();
    await runMigrations(pool);
    await pool.query('DELETE FROM receipts');
    await pool.query('DELETE FROM jobs');
    await pool.query('DELETE FROM workers');
    workerId = crypto.randomUUID();
    await workers.createWorker(pool, { id: workerId, name: 'RW', publicKey: 'pk', encryptedPrivateKey: 'epk', withdrawalAddress: '0x0' });
    jobId = crypto.randomUUID();
    await jobs.createJob(pool, { id: jobId, workerId, inputHash: 'sha256_yyy' });
  });
  after(async () => { await closePool(pool); });

  const id = crypto.randomUUID();
  const hash = crypto.randomBytes(32).toString('hex');

  it('creates a receipt', async () => {
    const r = await receipts.createReceipt(pool, { id, job_id: jobId, receipt_type: 'completed', data: { test: true }, receipt_hash: hash });
    assert.ok(r);
    assert.equal(r.id, id);
  });

  it('gets receipt by id', async () => {
    const r = await receipts.getReceipt(pool, id);
    assert.ok(r);
  });

  it('gets receipt by hash', async () => {
    const r = await receipts.getByHash(pool, hash);
    assert.ok(r);
  });

  it('returns null for missing', async () => {
    assert.equal(await receipts.getReceipt(pool, 'nope'), null);
  });
});
