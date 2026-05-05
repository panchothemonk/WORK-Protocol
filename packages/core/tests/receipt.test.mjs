/**
 * WORK Protocol v4 — Receipt Engine Tests
 * TDD: RED → GREEN → REFACTOR
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair } from '../src/crypto.mjs';
import { sign, verify, freeze, anchor } from '../src/receipt.mjs';

describe('sign', () => {
  it('adds receiptHash, signature, and freezes the receipt', () => {
    const { privateKey } = generateKeyPair();
    const receipt = {
      type: 'work_receipt_v4',
      workerId: 'worker_1',
      jobId: 'job_abc123',
      result: 'completed successfully',
    };

    const signed = sign(receipt, privateKey);

    // Same object reference returned
    assert.equal(signed, receipt);

    // Hash present and well-formed
    assert.ok(signed.receiptHash);
    assert.equal(typeof signed.receiptHash, 'string');
    assert.equal(signed.receiptHash.length, 64);

    // Signature object present
    assert.ok(signed.signature);
    assert.equal(signed.signature.algorithm, 'ed25519');
    assert.ok(signed.signature.signingKeyId);
    assert.equal(typeof signed.signature.signingKeyId, 'string');
    assert.equal(signed.signature.signingKeyId.length, 64);
    assert.ok(signed.signature.signatureBase64);
    assert.equal(typeof signed.signature.signatureBase64, 'string');

    // Frozen flag set
    assert.equal(signed._frozen, true);
  });

  it('throws when trying to sign an already-frozen receipt', () => {
    const { privateKey } = generateKeyPair();
    const receipt = { type: 'work_receipt_v4', _frozen: true };

    assert.throws(
      () => sign(receipt, privateKey),
      /Cannot sign: receipt is frozen/
    );
  });

  it('throws when signing after freeze()', () => {
    const { privateKey } = generateKeyPair();
    const receipt = { type: 'work_receipt_v4' };
    freeze(receipt);

    assert.throws(
      () => sign(receipt, privateKey),
      /Cannot sign: receipt is frozen/
    );
  });

  it('produces deterministic hash for same receipt content', () => {
    const { privateKey: pk1 } = generateKeyPair();
    const { privateKey: pk2 } = generateKeyPair();

    const receipt1 = { type: 'x', data: 'same' };
    const receipt2 = { data: 'same', type: 'x' }; // different key order

    sign(receipt1, pk1);
    sign(receipt2, pk2);

    // Same canonical hash regardless of key order
    assert.equal(receipt1.receiptHash, receipt2.receiptHash);
    // Different signatures (different keys)
    assert.notEqual(receipt1.signature.signatureBase64, receipt2.signature.signatureBase64);
  });

  it('ignores pre-existing receiptHash and signature fields during canonicalization', () => {
    const { privateKey } = generateKeyPair();
    const receipt = {
      type: 'x',
      receiptHash: 'fake-hash',
      signature: { algorithm: 'fake', signingKeyId: 'fake', signatureBase64: 'fake' },
    };

    sign(receipt, privateKey);

    // The signed hash should NOT be 'fake-hash'
    assert.notEqual(receipt.receiptHash, 'fake-hash');
    assert.equal(receipt.receiptHash.length, 64);
  });
});

describe('verify', () => {
  it('sign receipt → verify passes', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const receipt = {
      type: 'work_receipt_v4',
      workerId: 'worker_1',
      jobId: 'job_abc',
    };

    sign(receipt, privateKey);
    const result = verify(receipt, publicKey);

    assert.deepEqual(result, { valid: true });
  });

  it('tamper receipt after signing → hash_mismatch', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const receipt = {
      type: 'work_receipt_v4',
      workerId: 'worker_1',
      jobId: 'job_abc',
      result: 'original result',
    };

    sign(receipt, privateKey);

    // Tamper with the result
    receipt.result = 'tampered result';

    const result = verify(receipt, publicKey);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'hash_mismatch');
  });

  it('tamper receiptHash directly → hash_mismatch', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const receipt = { type: 'x', data: 'y' };

    sign(receipt, privateKey);

    // Corrupt the hash
    receipt.receiptHash = '00'.repeat(32);

    const result = verify(receipt, publicKey);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'hash_mismatch');
  });

  it('different keypair signatures do not verify', () => {
    const { publicKey: pubKeyA, privateKey: privKeyA } = generateKeyPair();
    const { publicKey: pubKeyB } = generateKeyPair();

    const receipt = { type: 'work_receipt_v4', data: 'test' };

    // Sign with key A
    sign(receipt, privKeyA);

    // Try to verify with key B's public key
    const result = verify(receipt, pubKeyB);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'signature_invalid');
  });

  it('cross-instance verification: serialize/deserialize then verify', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const receipt = { type: 'work_receipt_v4', workerId: 'w1', jobId: 'j1', result: 'done' };

    sign(receipt, privateKey);

    // Simulate cross-instance transfer via JSON round-trip
    const exported = JSON.parse(JSON.stringify(receipt));

    // _frozen is a non-enumerable-like concept; JSON won't include it but we don't care
    const result = verify(exported, publicKey);
    assert.deepEqual(result, { valid: true });
  });

  it('verify with missing signature field returns signature_invalid', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const receipt = { type: 'x' };

    sign(receipt, privateKey);

    // Remove the signature
    delete receipt.signature;

    const result = verify(receipt, publicKey);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'signature_invalid');
  });

  it('verify with corrupted signature returns signature_invalid', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const receipt = { type: 'x' };

    sign(receipt, privateKey);

    // Corrupt the signature base64
    receipt.signature.signatureBase64 = 'AAAA' + receipt.signature.signatureBase64.slice(4);

    const result = verify(receipt, publicKey);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'signature_invalid');
  });
});

describe('freeze', () => {
  it('sets _frozen to true on the receipt', () => {
    const receipt = { type: 'work_receipt_v4', data: 'test' };
    const result = freeze(receipt);

    assert.equal(result, receipt);
    assert.equal(receipt._frozen, true);
  });

  it('frozen receipt cannot be signed', () => {
    const { privateKey } = generateKeyPair();
    const receipt = { type: 'x' };
    freeze(receipt);

    assert.throws(() => sign(receipt, privateKey), /frozen/);
  });
});

describe('anchor', () => {
  it('does not throw and logs a placeholder message', () => {
    // Capture console.log
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args);

    try {
      anchor('abc123def456');
    } finally {
      console.log = originalLog;
    }

    assert.equal(logs.length, 1);
    assert.ok(logs[0][0].includes('would anchor on Base:'));
    assert.ok(logs[0][0].includes('abc123def456'));
  });
});
