// payments.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closePool } from '../src/db.mjs';
import * as workers from '../src/workers.mjs';
import * as jobs from '../src/jobs.mjs';
import * as payments from '../src/payments.mjs';
import crypto from 'node:crypto';

describe('payments store', () => {
  let pool, workerId, jobId;
  before(async () => {
    pool = createPool();
    await runMigrations(pool);
    await pool.query('DELETE FROM payment_authorizations');
    await pool.query('DELETE FROM jobs');
    await pool.query('DELETE FROM workers');
    workerId = crypto.randomUUID();
    await workers.createWorker(pool, { id: workerId, name: 'PW', publicKey: 'pk', encryptedPrivateKey: 'epk', withdrawalAddress: '0x0' });
    jobId = crypto.randomUUID();
    await jobs.createJob(pool, { id: jobId, workerId, inputHash: 'sha256_xxx' });
  });
  after(async () => { await closePool(pool); });

  const paId = crypto.randomUUID();

  it('creates a payment authorization', async () => {
    const pa = await payments.createPaymentAuth(pool, { id: paId, job_id: jobId, splits: JSON.stringify([{purpose:'worker_payout',amount:'100000'}]), status: 'secured' });
    assert.ok(pa);
    assert.equal(pa.id, paId);
    assert.equal(pa.status, 'secured');
  });

  it('gets payment auth by id', async () => {
    const pa = await payments.getPaymentAuth(pool, paId);
    assert.ok(pa);
  });

  it('returns null for missing', async () => {
    assert.equal(await payments.getPaymentAuth(pool, 'nope'), null);
  });

  it('updates settlement', async () => {
    const pa = await payments.updateSettlement(pool, paId, 'stl_001', ['0xabc']);
    assert.ok(pa);
    assert.equal(pa.settlement_id, 'stl_001');
    assert.equal(pa.status, 'settled');
  });
});
