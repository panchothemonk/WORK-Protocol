// buyers.test.mjs — Tests for buyers store module
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closePool } from '../src/db.mjs';
import * as buyers from '../src/buyers.mjs';
import crypto from 'node:crypto';

describe('buyers store', () => {
  /** @type {import('pg').Pool} */
  let pool;

  before(async () => {
    pool = createPool();
    await runMigrations(pool);
    // Clean up test data respecting FK order
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

  const buyerId = crypto.randomUUID();
  const sampleBuyer = {
    id: buyerId,
    address: '0xBuyerAddress00112233445566778899001122334455667788',
    publicKey: 'buyer_ed25519_pub_abc',
  };

  it('createBuyer — creates a new buyer', async () => {
    const b = await buyers.createBuyer(pool, sampleBuyer);
    assert.ok(b, 'buyer should be created');
    assert.equal(b.id, buyerId);
    assert.equal(b.address, '0xBuyerAddress00112233445566778899001122334455667788');
    assert.equal(b.public_key, 'buyer_ed25519_pub_abc');
  });

  it('createBuyer — idempotent (ON CONFLICT DO NOTHING)', async () => {
    const b = await buyers.createBuyer(pool, sampleBuyer);
    assert.equal(b, null, 'duplicate insert should return null');
  });

  it('getBuyer — retrieves an existing buyer by ID', async () => {
    const b = await buyers.getBuyer(pool, buyerId);
    assert.ok(b, 'buyer should be found');
    assert.equal(b.id, buyerId);
    assert.equal(b.address, '0xBuyerAddress00112233445566778899001122334455667788');
  });

  it('getBuyer — returns null for missing buyer', async () => {
    const b = await buyers.getBuyer(pool, 'nonexistent-buyer');
    assert.equal(b, null);
  });

  it('getByAddress — retrieves a buyer by their on-chain address', async () => {
    const b = await buyers.getByAddress(
      pool,
      '0xBuyerAddress00112233445566778899001122334455667788'
    );
    assert.ok(b, 'buyer should be found by address');
    assert.equal(b.id, buyerId);
  });

  it('getByAddress — returns null for unknown address', async () => {
    const b = await buyers.getByAddress(pool, '0xUnknown');
    assert.equal(b, null);
  });

  it('getByAddress — case sensitive match', async () => {
    // Create another buyer with a different case
    const id2 = crypto.randomUUID();
    await buyers.createBuyer(pool, {
      id: id2,
      address: '0xMIXEDcaseADDRESS',
      publicKey: 'buyer_pub_xyz',
    });

    const b = await buyers.getByAddress(pool, '0xMIXEDcaseADDRESS');
    assert.ok(b, 'should find exact case match');
    assert.equal(b.id, id2);
  });
});
