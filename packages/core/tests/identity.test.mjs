/**
 * WORK Protocol v4 — Identity unit tests
 *
 * Usage: node --test packages/core/tests/identity.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkerIdentity,
  createBuyerIdentity,
  keyPossessionChallenge,
  keyPossessionProof,
  verifyKeyPossession,
} from '../src/identity.mjs';
import { bytesToHex, generateKeypair, sign, verify } from '../src/crypto.mjs';

// ---- Worker identity ------------------------------------------------------

describe('createWorkerIdentity', () => {
  it('creates a valid worker identity with Ed25519 keypair', () => {
    const worker = createWorkerIdentity({
      name: 'CodeReviewBot',
      withdrawalAddress: '0xAbCdEf0000000000000000000000000000000000',
      guardrails: { maxJobsPerDay: 5 },
    });

    assert.ok(worker.workerId.startsWith('wrk_'));
    assert.strictEqual(typeof worker.workerId, 'string');
    assert.ok(worker.workerId.length > 4);

    assert.strictEqual(worker.name, 'CodeReviewBot');
    assert.strictEqual(worker.withdrawalAddress, '0xAbCdEf0000000000000000000000000000000000');
    assert.deepStrictEqual(worker.guardrails, { maxJobsPerDay: 5 });

    // Public key must be valid 64-char hex
    assert.strictEqual(typeof worker.publicKey, 'string');
    assert.strictEqual(worker.publicKey.length, 64);

    // Private key must be valid 64-char hex
    assert.strictEqual(typeof worker.privateKey, 'string');
    assert.strictEqual(worker.privateKey.length, 64);

    // Verify that public key derives from private key
    const { hexToBytes } = require_node_crypto();
    const derivedPub = bytesToHex(
      (await import('../src/crypto.mjs')).getPublicKey(
        hexToBytes(worker.privateKey),
      ),
    );
    assert.strictEqual(worker.publicKey, derivedPub);
  });

  it('guardrails defaults to {}', () => {
    const worker = createWorkerIdentity({
      name: 'Bot',
      withdrawalAddress: '0x0',
    });
    assert.deepStrictEqual(worker.guardrails, {});
  });
});

// ---- Buyer identity -------------------------------------------------------

describe('createBuyerIdentity', () => {
  it('creates a valid buyer identity with Ed25519 keypair', () => {
    const buyer = createBuyerIdentity({
      address: '0xDeAdBeEf00000000000000000000000000000000',
    });

    assert.ok(buyer.buyerId.startsWith('buy_'));
    assert.strictEqual(typeof buyer.buyerId, 'string');
    assert.ok(buyer.buyerId.length > 4);

    assert.strictEqual(buyer.address, '0xDeAdBeEf00000000000000000000000000000000');

    assert.strictEqual(typeof buyer.publicKey, 'string');
    assert.strictEqual(buyer.publicKey.length, 64);

    assert.strictEqual(typeof buyer.privateKey, 'string');
    assert.strictEqual(buyer.privateKey.length, 64);
  });
});

// ---- Uniqueness -----------------------------------------------------------

describe('identity uniqueness', () => {
  it('worker IDs are unique', () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const w = createWorkerIdentity({ name: `w${i}`, withdrawalAddress: '0x0' });
      assert.ok(!ids.has(w.workerId), `duplicate workerId: ${w.workerId}`);
      ids.add(w.workerId);
    }
  });

  it('buyer IDs are unique', () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const b = createBuyerIdentity({ address: '0x0' });
      assert.ok(!ids.has(b.buyerId), `duplicate buyerId: ${b.buyerId}`);
      ids.add(b.buyerId);
    }
  });
});

// ---- Key possession challenge-response ------------------------------------

describe('key possession challenge-response', () => {
  it('roundtrip: challenge → proof → verify works', () => {
    // Create a worker to get a keypair
    const worker = createWorkerIdentity({
      name: 'TestBot',
      withdrawalAddress: '0x0',
    });

    // Generate challenge
    const { challenge } = keyPossessionChallenge();
    assert.strictEqual(typeof challenge, 'string');
    assert.ok(challenge.length > 0);

    // Create proof
    const { signature } = keyPossessionProof({
      challenge,
      privateKeyHex: worker.privateKey,
    });
    assert.strictEqual(typeof signature, 'string');

    // Verify
    const result = verifyKeyPossession({
      challenge,
      signature,
      publicKeyHex: worker.publicKey,
    });
    assert.strictEqual(result, true);
  });

  it('wrong private key fails verification', () => {
    const worker = createWorkerIdentity({
      name: 'TestBot',
      withdrawalAddress: '0x0',
    });

    const { challenge } = keyPossessionChallenge();

    // Create a different keypair to sign with
    const other = createWorkerIdentity({
      name: 'Impostor',
      withdrawalAddress: '0x1',
    });

    // Sign with other's key
    const { signature } = keyPossessionProof({
      challenge,
      privateKeyHex: other.privateKey,
    });

    // Verify against original worker's public key — MUST fail
    const result = verifyKeyPossession({
      challenge,
      signature,
      publicKeyHex: worker.publicKey,
    });
    assert.strictEqual(result, false);
  });

  it('tampered challenge fails verification', () => {
    const worker = createWorkerIdentity({
      name: 'TestBot',
      withdrawalAddress: '0x0',
    });

    const { challenge } = keyPossessionChallenge();

    const { signature } = keyPossessionProof({
      challenge,
      privateKeyHex: worker.privateKey,
    });

    // Tamper with challenge
    const tampered = challenge.slice(0, -2) + 'ff';

    const result = verifyKeyPossession({
      challenge: tampered,
      signature,
      publicKeyHex: worker.publicKey,
    });
    assert.strictEqual(result, false);
  });

  it('tampered signature fails verification', () => {
    const worker = createWorkerIdentity({
      name: 'TestBot',
      withdrawalAddress: '0x0',
    });

    const { challenge } = keyPossessionChallenge();

    const { signature } = keyPossessionProof({
      challenge,
      privateKeyHex: worker.privateKey,
    });

    // Tamper with signature
    const tampered = signature.slice(0, -2) + 'ff';

    const result = verifyKeyPossession({
      challenge,
      signature: tampered,
      publicKeyHex: worker.publicKey,
    });
    assert.strictEqual(result, false);
  });
});

/**
 * Small helper — node 25 doesn't need require for crypto, but just in case.
 */
function require_node_crypto() {
  // We use the crypto module from esm via dynamic import
  return { hexToBytes: (h) => Uint8Array.from(Buffer.from(h, 'hex')) };
}
