// services.test.mjs — Tests for services store module
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closePool } from '../src/db.mjs';
import * as workers from '../src/workers.mjs';
import * as services from '../src/services.mjs';
import crypto from 'node:crypto';

describe('services store', () => {
  let pool;
  let workerId;
  let serviceId;
  let sampleService;

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
      id: workerId,
      name: 'ServiceWorker',
      publicKey: 'svc_worker_pub',
      encryptedPrivateKey: 'svc_enc_priv',
      withdrawalAddress: '0xServiceWorkerAddress0000000000000000000000',
      status: 'active',
    });

    serviceId = crypto.randomUUID();
    sampleService = {
      id: serviceId,
      workerId,
      name: 'GPT-4 Inference',
      description: 'High-quality text generation using GPT-4',
      priceMicroUsd: '500000',
      category: 'text-generation',
      status: 'draft',
    };
  });

  after(async () => {
    await closePool(pool);
  });

  it('createService — creates a new service listing', async () => {
    const svc = await services.createService(pool, sampleService);
    assert.ok(svc, 'service should be created');
    assert.equal(svc.id, serviceId);
    assert.equal(svc.worker_id, workerId);
    assert.equal(svc.name, 'GPT-4 Inference');
  });

  it('createService — idempotent (ON CONFLICT DO NOTHING)', async () => {
    const svc = await services.createService(pool, sampleService);
    assert.equal(svc, null, 'duplicate insert should return null');
  });

  it('getService — retrieves an existing service', async () => {
    const svc = await services.getService(pool, serviceId);
    assert.ok(svc, 'service should be found');
    assert.equal(svc.id, serviceId);
  });

  it('getService — returns null for missing service', async () => {
    const svc = await services.getService(pool, 'nonexistent');
    assert.equal(svc, null);
  });

  it('listByWorker — lists all services for a worker', async () => {
    const id2 = crypto.randomUUID();
    await services.createService(pool, {
      id: id2,
      workerId,
      name: 'Claude-3 Opus',
      description: 'Anthropic Claude 3 Opus API',
      priceMicroUsd: '1500000',
      category: 'text-generation',
      status: 'published',
    });

    const list = await services.listByWorker(pool, workerId);
    assert.ok(list.length >= 2, 'should have at least 2 services');
    const names = list.map((s) => s.name);
    assert.ok(names.includes('GPT-4 Inference'));
    assert.ok(names.includes('Claude-3 Opus'));
  });

  it('updateStatus — changes a service status', async () => {
    const svc = await services.updateStatus(pool, serviceId, 'published');
    assert.ok(svc, 'should return updated service');
    assert.equal(svc.status, 'published');
  });

  it('search — filters by category', async () => {
    const results = await services.search(pool, { category: 'text-generation' });
    assert.ok(results.length >= 2, 'should find text-generation services');
  });

  it('search — filters by price range', async () => {
    const results = await services.search(pool, { minPrice: 1000000, maxPrice: 2000000 });
    assert.ok(results.length >= 1, 'should find services in price range');
    const claude = results.find((s) => s.name === 'Claude-3 Opus');
    assert.ok(claude, 'Claude-3 Opus should be in price range');
  });

  it('search — filters by status', async () => {
    const results = await services.search(pool, { status: 'published' });
    assert.ok(results.length >= 1, 'should find published services');
    results.forEach((s) => assert.equal(s.status, 'published'));
  });

  it('search — combined filters', async () => {
    const results = await services.search(pool, {
      category: 'text-generation', status: 'published', minPrice: 100000,
    });
    assert.ok(results.length >= 1, 'should find matching services');
    results.forEach((s) => {
      assert.equal(s.category, 'text-generation');
      assert.equal(s.status, 'published');
    });
  });

  it('search — empty search returns all services', async () => {
    const results = await services.search(pool, {});
    assert.ok(results.length >= 2, 'empty search should return all services');
  });
});
