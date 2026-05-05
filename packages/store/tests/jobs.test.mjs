// jobs.test.mjs — Tests for jobs store module
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closePool } from '../src/db.mjs';
import * as workers from '../src/workers.mjs';
import * as buyers from '../src/buyers.mjs';
import * as services from '../src/services.mjs';
import * as jobs from '../src/jobs.mjs';
import crypto from 'node:crypto';

describe('jobs store', () => {
  let pool, workerId, buyerId, serviceId, jobId, sampleJob;

  before(async () => {
    pool = createPool();
    await runMigrations(pool);
    await pool.query('DELETE FROM delegations');
    await pool.query('DELETE FROM jobs');
    await pool.query('DELETE FROM payment_authorizations');
    await pool.query('DELETE FROM services');
    await pool.query('DELETE FROM buyers');
    await pool.query('DELETE FROM workers');

    workerId = crypto.randomUUID();
    await workers.createWorker(pool, {
      id: workerId, name: 'JobWorker', publicKey: 'job_worker_pub',
      encryptedPrivateKey: 'job_enc_priv',
      withdrawalAddress: '0xJobWorkerAddress000000000000000000000000',
      status: 'active',
    });

    buyerId = crypto.randomUUID();
    await buyers.createBuyer(pool, {
      id: buyerId, address: '0xJobBuyerAddress00000000000000000000000000',
      publicKey: 'job_buyer_pub',
    });

    serviceId = crypto.randomUUID();
    await services.createService(pool, {
      id: serviceId, workerId, name: 'Test Service',
      description: 'A test service for jobs', priceMicroUsd: '1000000',
      category: 'testing', status: 'published',
    });

    jobId = crypto.randomUUID();
    sampleJob = {
      id: jobId, workerId, buyerId, serviceId, paymentAuthId: 'pay_auth_001',
      inputHash: 'sha256_of_input_data_abc123', model: 'gpt-4', modelProvider: 'openai',
    };
  });

  after(async () => { await closePool(pool); });

  it('createJob — creates a new job', async () => {
    const j = await jobs.createJob(pool, sampleJob);
    assert.ok(j, 'job should be created');
    assert.equal(j.id, jobId);
    assert.equal(j.worker_id, workerId);
    assert.equal(j.status, 'created');
    assert.equal(j.model, 'gpt-4');
  });

  it('createJob — idempotent (ON CONFLICT DO NOTHING)', async () => {
    const j = await jobs.createJob(pool, sampleJob);
    assert.equal(j, null, 'duplicate insert should return null');
  });

  it('getJob — retrieves an existing job', async () => {
    const j = await jobs.getJob(pool, jobId);
    assert.ok(j, 'job should be found');
    assert.equal(j.id, jobId);
  });

  it('getJob — returns null for missing job', async () => {
    const j = await jobs.getJob(pool, 'nonexistent');
    assert.equal(j, null);
  });

  it('updateStatus — changes job status to in_progress', async () => {
    const j = await jobs.updateStatus(pool, jobId, 'in_progress');
    assert.ok(j, 'job should be returned');
    assert.equal(j.status, 'in_progress');
  });

  it('updateStatus — marks completed_at when status is completed', async () => {
    const id2 = crypto.randomUUID();
    await jobs.createJob(pool, { id: id2, workerId, buyerId, serviceId, inputHash: 'sha256_input_xyz' });
    const j = await jobs.updateStatus(pool, id2, 'completed');
    assert.equal(j.status, 'completed');
    assert.ok(j.completed_at, 'completed_at should be set');
  });

  it('updateStatus — marks failed_at when status is failed', async () => {
    const id3 = crypto.randomUUID();
    await jobs.createJob(pool, { id: id3, workerId, buyerId, serviceId, inputHash: 'sha256_input_fail' });
    const j = await jobs.updateStatus(pool, id3, 'failed');
    assert.equal(j.status, 'failed');
    assert.ok(j.failed_at, 'failed_at should be set');
  });

  it('listByWorker — lists all jobs for a worker', async () => {
    const list = await jobs.listByWorker(pool, workerId);
    assert.ok(list.length >= 3, 'should have at least 3 jobs');
    list.forEach((j) => assert.equal(j.worker_id, workerId));
  });

  it('listByBuyer — lists all jobs for a buyer', async () => {
    const list = await jobs.listByBuyer(pool, buyerId);
    assert.ok(list.length >= 3, 'should have at least 3 jobs');
    list.forEach((j) => assert.equal(j.buyer_id, buyerId));
  });

  it('setResult — sets result hash and marks job as completed', async () => {
    const id4 = crypto.randomUUID();
    await jobs.createJob(pool, { id: id4, workerId, buyerId, serviceId, inputHash: 'sha256_input_result_test', status: 'in_progress' });
    const j = await jobs.setResult(pool, id4, 'sha256_result_data_here');
    assert.ok(j, 'job should be returned');
    assert.equal(j.result_hash, 'sha256_result_data_here');
    assert.equal(j.status, 'completed');
  });

  it('setTimeout — sets the timeout for a job', async () => {
    const id5 = crypto.randomUUID();
    await jobs.createJob(pool, { id: id5, workerId, buyerId, serviceId, inputHash: 'sha256_input_timeout_test' });
    const future = new Date(Date.now() + 3600_000).toISOString();
    const j = await jobs.setTimeout(pool, id5, future);
    assert.ok(j, 'job should be returned');
    assert.ok(j.timeout_at, 'timeout_at should be set');
  });

  it('createJob — minimal job (only required fields)', async () => {
    const minId = crypto.randomUUID();
    const j = await jobs.createJob(pool, { id: minId, workerId, inputHash: 'sha256_minimal_input' });
    assert.ok(j, 'minimal job should be created');
    assert.equal(j.id, minId);
    assert.equal(j.worker_id, workerId);
    assert.equal(j.status, 'created');
  });
});
