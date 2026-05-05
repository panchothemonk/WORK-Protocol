/**
 * WORK Protocol v4 — Crypto Tests
 * TDD: RED → GREEN → REFACTOR
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, sha256, canonicalize, verifySignature } from '../src/crypto.mjs';
import * as ed from '@noble/ed25519';

describe('generateKeyPair', () => {
  it('produces valid Ed25519 keypair (32-byte hex strings)', () => {
    const { publicKey, privateKey } = generateKeyPair();

    assert.equal(typeof publicKey, 'string');
    assert.equal(typeof privateKey, 'string');
    assert.equal(publicKey.length, 64); // 32 bytes = 64 hex chars
    assert.equal(privateKey.length, 64);

    // Verify the private key derives the same public key
    const pubBytes = Buffer.from(publicKey, 'hex');
    const privBytes = Buffer.from(privateKey, 'hex');
    const derivedPub = ed.getPublicKey(privBytes);
    assert.deepEqual(Buffer.from(derivedPub).toString('hex'), publicKey);
  });

  it('generates unique keys on each call', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    assert.notEqual(kp1.publicKey, kp2.publicKey);
    assert.notEqual(kp1.privateKey, kp2.privateKey);
  });
});

describe('sha256', () => {
  it('is deterministic — same input produces same hash', () => {
    const h1 = sha256('hello world');
    const h2 = sha256('hello world');
    assert.equal(h1, h2);
    assert.equal(h1.length, 64); // SHA-256 = 32 bytes = 64 hex chars
  });

  it('produces different hashes for different inputs', () => {
    assert.notEqual(sha256('hello'), sha256('world'));
  });

  it('handles Uint8Array input', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const h = sha256(bytes);
    assert.equal(h.length, 64);
    // Deterministic check
    assert.equal(sha256(bytes), sha256(bytes));
  });

  it('handles object input via JSON.stringify', () => {
    const h = sha256({ a: 1, b: 2 });
    assert.equal(h.length, 64);
  });

  it('avalanche effect — small change yields very different hash', () => {
    const h1 = sha256('hello');
    const h2 = sha256('hallo');
    assert.notEqual(h1, h2);
    // First few chars should differ
    assert.notEqual(h1.slice(0, 8), h2.slice(0, 8));
  });
});

describe('canonicalize', () => {
  it('produces the same hash for key-reordered objects', () => {
    const h1 = canonicalize({ b: 2, a: 1, c: 3 });
    const h2 = canonicalize({ a: 1, c: 3, b: 2 });
    assert.equal(h1, h2);
  });

  it('produces different hashes for different values', () => {
    assert.notEqual(
      canonicalize({ a: 1, b: 2 }),
      canonicalize({ a: 2, b: 1 })
    );
  });

  it('nested objects are NOT sorted — only top-level keys', () => {
    const h1 = canonicalize({ key: { b: 2, a: 1 } });
    const h2 = canonicalize({ key: { a: 1, b: 2 } });
    // JSON.stringify preserves insertion order for nested objects,
    // but since we iterate sortedKeys from h1, the nested order may differ
    // if it came from different sources. Let's check behavior.
    // Currently nested keys are NOT sorted — this is the design choice.
    assert.notEqual(h1, h2);
  });

  it('returns a 64-char hex string', () => {
    const h = canonicalize({ x: 1 });
    assert.equal(h.length, 64);
  });
});

describe('verifySignature', () => {
  it('sign + verify roundtrip succeeds', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const message = 'WORK Protocol v4 receipt payload';

    // Sign using noble
    const privBytes = Buffer.from(privateKey, "hex");
    const msgBytes = new TextEncoder().encode(message);
    const signature = ed.sign(msgBytes, privBytes);
    const sigHex = Buffer.from(signature).toString('hex');

    // Verify via our wrapper
    const result = verifySignature(publicKey, message, sigHex);
    assert.equal(result, true);
  });

  it('rejects invalid signature (all zeros)', () => {
    const { publicKey } = generateKeyPair();
    const result = verifySignature(publicKey, 'test', '00'.repeat(64));
    assert.equal(result, false);
  });

  it('rejects signature from different keypair', () => {
    const { publicKey: pubA, privateKey: privA } = generateKeyPair();
    const { publicKey: pubB } = generateKeyPair();

    const msgBytes = new TextEncoder().encode('test');
    const privBytes = Buffer.from(privA, 'hex');
    const signature = ed.sign(msgBytes, privBytes);
    const sigHex = Buffer.from(signature).toString('hex');

    // Verify with wrong public key
    const result = verifySignature(pubB, 'test', sigHex);
    assert.equal(result, false);
  });

  it('handles Uint8Array message', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const message = new Uint8Array([1, 2, 3, 4]);

    const privBytes = Buffer.from(privateKey, "hex");
    const signature = ed.sign(message, privBytes);
    const sigHex = Buffer.from(signature).toString('hex');

    const result = verifySignature(publicKey, message, sigHex);
    assert.equal(result, true);
  });
});
