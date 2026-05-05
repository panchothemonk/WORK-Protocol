// @workprotocol/core — Types Tests
//
// TDD: RED → GREEN → REFACTOR → COMMIT
// Tests for all validation functions exported from types.mjs

import {
  isValidMicroUsd,
  isValidSplitPurpose,
  validatePaymentSplit,
  validateSignedSplit,
  validateReceipt,
  validateWorkerIdentity,
  validateBuyerIdentity,
} from '../src/types.mjs';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid ReceiptV4 for testing.
 * Override any field via overrides param.
 */
function makeValidReceipt(overrides = {}) {
  return {
    version: '4.0',
    receiptType: 'job_completion',
    ids: {
      jobId: 'job_abc123',
      workerId: 'worker_def456',
      buyerId: 'buyer_ghi789',
    },
    payment: {
      rail: 'cdp',
      amountMicroUsd: '105000000', // $105.00
    },
    economics: {
      buyerPrice: '105000000',
      workerPayout: '100000000',
      aiCost: '2000000',
      protocolFee: '3000000',
      feeBps: 300,
    },
    execution: {
      model: 'gpt-4',
      platform: 'paperclip',
      inputHash: 'abc123def456',
    },
    hashes: {
      receiptHash: '0x' + 'a'.repeat(64),
    },
    timestamps: {
      createdAt: '2026-05-04T12:00:00.000Z',
      completedAt: '2026-05-04T12:05:00.000Z',
    },
    signature: {
      algorithm: 'ed25519',
      signingKeyId: 'key_001',
      signatureBase64: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=', // made-up valid base64
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isValidMicroUsd
// ---------------------------------------------------------------------------

describe('isValidMicroUsd', () => {
  describe('valid inputs', () => {
    const validCases = [
      ['zero', '0'],
      ['one dollar', '1000000'],
      ['one micro-dollar', '1'],
      ['large value', '999999999999999999'],
      ['five dollars', '5000000'],
      ['50 cents', '500000'],
    ];

    for (const [label, input] of validCases) {
      it(`returns true for ${label} (${input})`, () => {
        assert.strictEqual(isValidMicroUsd(input), true);
      });
    }
  });

  describe('invalid inputs', () => {
    const invalidCases = [
      ['empty string', ''],
      ['leading zeros', '01000000'],
      ['negative sign', '-100'],
      ['decimal point', '100.50'],
      ['letters', 'abc'],
      ['hex', '0xff'],
      ['whitespace', ' 100 '],
      ['null', null],
      ['undefined', undefined],
      ['number type', 1000000],
      ['boolean', true],
      ['object', {}],
    ];

    for (const [label, input] of invalidCases) {
      it(`returns false for ${label}`, () => {
        assert.strictEqual(isValidMicroUsd(input), false);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// isValidSplitPurpose
// ---------------------------------------------------------------------------

describe('isValidSplitPurpose', () => {
  it('accepts worker_payout', () => {
    assert.strictEqual(isValidSplitPurpose('worker_payout'), true);
  });

  it('accepts ai_cost', () => {
    assert.strictEqual(isValidSplitPurpose('ai_cost'), true);
  });

  it('accepts protocol_fee', () => {
    assert.strictEqual(isValidSplitPurpose('protocol_fee'), true);
  });

  it('rejects invalid purpose', () => {
    assert.strictEqual(isValidSplitPurpose('invalid_purpose'), false);
  });

  it('rejects empty string', () => {
    assert.strictEqual(isValidSplitPurpose(''), false);
  });

  it('rejects null', () => {
    assert.strictEqual(isValidSplitPurpose(null), false);
  });
});

// ---------------------------------------------------------------------------
// validatePaymentSplit
// ---------------------------------------------------------------------------

describe('validatePaymentSplit', () => {
  describe('valid splits', () => {
    it('validates a correct worker_payout split', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        amountMicroUsd: '100000000',
        toAddress: '0x' + 'a'.repeat(40),
      });
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.errors, []);
    });

    it('validates a correct ai_cost split', () => {
      const result = validatePaymentSplit({
        purpose: 'ai_cost',
        amountMicroUsd: '2000000',
        toAddress: '0x' + 'b'.repeat(40),
      });
      assert.strictEqual(result.valid, true);
    });

    it('validates a correct protocol_fee split', () => {
      const result = validatePaymentSplit({
        purpose: 'protocol_fee',
        amountMicroUsd: '3000000',
        toAddress: '0x' + 'c'.repeat(40),
      });
      assert.strictEqual(result.valid, true);
    });

    it('validates zero amount', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        amountMicroUsd: '0',
        toAddress: '0x' + 'd'.repeat(40),
      });
      assert.strictEqual(result.valid, true);
    });
  });

  describe('invalid splits', () => {
    it('rejects null', () => {
      const result = validatePaymentSplit(null);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('rejects undefined', () => {
      const result = validatePaymentSplit(undefined);
      assert.strictEqual(result.valid, false);
    });

    it('rejects missing purpose', () => {
      const result = validatePaymentSplit({
        amountMicroUsd: '1000000',
        toAddress: '0x' + 'a'.repeat(40),
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('purpose')));
    });

    it('rejects invalid purpose', () => {
      const result = validatePaymentSplit({
        purpose: 'invalid_purpose',
        amountMicroUsd: '1000000',
        toAddress: '0x' + 'a'.repeat(40),
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('purpose')));
    });

    it('rejects missing amountMicroUsd', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        toAddress: '0x' + 'a'.repeat(40),
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('amountMicroUsd')));
    });

    it('rejects invalid amountMicroUsd (negative)', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        amountMicroUsd: '-100',
        toAddress: '0x' + 'a'.repeat(40),
      });
      assert.strictEqual(result.valid, false);
    });

    it('rejects invalid amountMicroUsd (decimal)', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        amountMicroUsd: '100.50',
        toAddress: '0x' + 'a'.repeat(40),
      });
      assert.strictEqual(result.valid, false);
    });

    it('rejects missing toAddress', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        amountMicroUsd: '1000000',
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('toAddress')));
    });

    it('rejects invalid toAddress (wrong length)', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        amountMicroUsd: '1000000',
        toAddress: '0xdead',
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('toAddress')));
    });

    it('rejects invalid toAddress (no 0x prefix)', () => {
      const result = validatePaymentSplit({
        purpose: 'worker_payout',
        amountMicroUsd: '1000000',
        toAddress: 'a'.repeat(40),
      });
      assert.strictEqual(result.valid, false);
    });

    it('reports multiple errors at once', () => {
      const result = validatePaymentSplit({});
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length >= 3, `expected 3+ errors, got ${result.errors.length}`);
    });
  });
});

// ---------------------------------------------------------------------------
// validateSignedSplit
// ---------------------------------------------------------------------------

describe('validateSignedSplit', () => {
  const validSig = {
    from: '0x' + 'a'.repeat(40),
    v: 27,
    r: '0x' + 'b'.repeat(64),
    s: '0x' + 'c'.repeat(64),
    nonce: 0,
    purpose: 'worker_payout',
  };

  it('validates a correct signed split', () => {
    const result = validateSignedSplit(validSig);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('rejects missing signature fields', () => {
    const result = validateSignedSplit({
      purpose: 'worker_payout',
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects invalid purpose', () => {
    const result = validateSignedSplit({ ...validSig, purpose: 'bad' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('purpose')));
  });

  it('rejects non-integer v', () => {
    const result = validateSignedSplit({ ...validSig, v: 27.5 });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('v')));
  });

  it('rejects invalid r (wrong length)', () => {
    const result = validateSignedSplit({ ...validSig, r: '0xabc' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('r')));
  });

  it('rejects negative nonce', () => {
    const result = validateSignedSplit({ ...validSig, nonce: -1 });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('nonce')));
  });
});

// ---------------------------------------------------------------------------
// validateReceipt
// ---------------------------------------------------------------------------

describe('validateReceipt', () => {
  describe('valid receipts', () => {
    it('validates a complete job_completion receipt', () => {
      const receipt = makeValidReceipt();
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, true, `Unexpected errors: ${result.errors.join('; ')}`);
      assert.deepStrictEqual(result.errors, []);
    });

    it('validates a delegation receipt', () => {
      const receipt = makeValidReceipt({
        receiptType: 'delegation',
      });
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, true);
    });

    it('validates receipt with viem rail', () => {
      const receipt = makeValidReceipt({
        payment: {
          rail: 'viem',
          amountMicroUsd: '50000000',
        },
      });
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, true);
    });

    it('validates timestamps with timezone offset', () => {
      const receipt = makeValidReceipt({
        timestamps: {
          createdAt: '2026-05-04T12:00:00+02:00',
          completedAt: '2026-05-04T12:05:00+02:00',
        },
      });
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, true);
    });

    it('validates timestamps without milliseconds', () => {
      const receipt = makeValidReceipt({
        timestamps: {
          createdAt: '2026-05-04T12:00:00Z',
          completedAt: '2026-05-04T12:05:00Z',
        },
      });
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('invalid receipts', () => {
    it('rejects null', () => {
      const result = validateReceipt(null);
      assert.strictEqual(result.valid, false);
    });

    it('rejects wrong version', () => {
      const receipt = makeValidReceipt({ version: '3.0' });
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('version')));
    });

    it('rejects missing version', () => {
      const receipt = makeValidReceipt();
      delete receipt.version;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('version')));
    });

    it('rejects invalid receiptType', () => {
      const receipt = makeValidReceipt({ receiptType: 'unknown_type' });
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('receiptType')));
    });

    it('rejects missing ids.jobId', () => {
      const receipt = makeValidReceipt();
      delete receipt.ids.jobId;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('ids.jobId')));
    });

    it('rejects missing ids.workerId', () => {
      const receipt = makeValidReceipt();
      delete receipt.ids.workerId;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('ids.workerId')));
    });

    it('rejects missing ids.buyerId', () => {
      const receipt = makeValidReceipt();
      delete receipt.ids.buyerId;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('ids.buyerId')));
    });

    it('rejects invalid payment.rail', () => {
      const receipt = makeValidReceipt();
      receipt.payment.rail = 'paypal';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('payment.rail')));
    });

    it('rejects invalid payment.amountMicroUsd', () => {
      const receipt = makeValidReceipt();
      receipt.payment.amountMicroUsd = 'not-a-number';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('payment.amountMicroUsd')));
    });

    it('rejects invalid economics.buyerPrice', () => {
      const receipt = makeValidReceipt();
      receipt.economics.buyerPrice = '-100';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('economics.buyerPrice')));
    });

    it('rejects invalid economics.workerPayout', () => {
      const receipt = makeValidReceipt();
      receipt.economics.workerPayout = 'abc';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
    });

    it('rejects invalid economics.aiCost', () => {
      const receipt = makeValidReceipt();
      receipt.economics.aiCost = '1.5';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
    });

    it('rejects invalid economics.protocolFee', () => {
      const receipt = makeValidReceipt();
      receipt.economics.protocolFee = '';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
    });

    it('rejects negative feeBps', () => {
      const receipt = makeValidReceipt();
      receipt.economics.feeBps = -1;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('feeBps')));
    });

    it('rejects float feeBps', () => {
      const receipt = makeValidReceipt();
      receipt.economics.feeBps = 3.5;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
    });

    it('rejects missing execution.inputHash', () => {
      const receipt = makeValidReceipt();
      delete receipt.execution.inputHash;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('execution.inputHash')));
    });

    it('rejects missing hashes.receiptHash', () => {
      const receipt = makeValidReceipt();
      delete receipt.hashes.receiptHash;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('hashes.receiptHash')));
    });

    it('rejects invalid timestamps.createdAt', () => {
      const receipt = makeValidReceipt();
      receipt.timestamps.createdAt = 'not-a-date';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('timestamps.createdAt')));
    });

    it('rejects invalid timestamps.completedAt', () => {
      const receipt = makeValidReceipt();
      receipt.timestamps.completedAt = '2026/05/04';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('timestamps.completedAt')));
    });

    it('rejects missing signature', () => {
      const receipt = makeValidReceipt();
      delete receipt.signature;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
    });

    it('rejects wrong signature algorithm', () => {
      const receipt = makeValidReceipt();
      receipt.signature.algorithm = 'ecdsa';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('algorithm')));
    });

    it('rejects missing signingKeyId', () => {
      const receipt = makeValidReceipt();
      delete receipt.signature.signingKeyId;
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('signingKeyId')));
    });

    it('rejects invalid signatureBase64', () => {
      const receipt = makeValidReceipt();
      receipt.signature.signatureBase64 = '!!!not-valid-base64!!!';
      const result = validateReceipt(receipt);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('signatureBase64')));
    });

    it('rejects completely empty object', () => {
      const result = validateReceipt({});
      assert.strictEqual(result.valid, false);
      // Should have many errors for a completely empty object
      assert.ok(result.errors.length >= 9, `expected 9+ errors, got ${result.errors.length}: ${result.errors.join('; ')}`);
    });
  });
});

// ---------------------------------------------------------------------------
// validateWorkerIdentity
// ---------------------------------------------------------------------------

describe('validateWorkerIdentity', () => {
  const validWorker = {
    workerId: 'worker_abc123',
    name: 'CodeReviewBot',
    publicKey: 'a'.repeat(64),
    withdrawalAddress: '0x' + 'a'.repeat(40),
    guardrails: {
      maxExposureMicroUsd: '1000000000', // $1,000
      minPriceMicroUsd: '1000000',       // $1.00
      maxDelegationDepth: 3,
    },
  };

  it('validates a complete worker identity', () => {
    const result = validateWorkerIdentity(validWorker);
    assert.strictEqual(result.valid, true, `Errors: ${result.errors.join('; ')}`);
  });

  it('rejects missing workerId', () => {
    const { workerId, ...rest } = validWorker;
    const result = validateWorkerIdentity(rest);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('workerId')));
  });

  it('rejects missing name', () => {
    const { name, ...rest } = validWorker;
    const result = validateWorkerIdentity(rest);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('name')));
  });

  it('rejects invalid publicKey (wrong length)', () => {
    const result = validateWorkerIdentity({ ...validWorker, publicKey: 'abc' });
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid withdrawalAddress', () => {
    const result = validateWorkerIdentity({ ...validWorker, withdrawalAddress: 'invalid' });
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid guardrails.maxExposureMicroUsd', () => {
    const result = validateWorkerIdentity({
      ...validWorker,
      guardrails: { ...validWorker.guardrails, maxExposureMicroUsd: '-100' },
    });
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid guardrails.minPriceMicroUsd', () => {
    const result = validateWorkerIdentity({
      ...validWorker,
      guardrails: { ...validWorker.guardrails, minPriceMicroUsd: 'free' },
    });
    assert.strictEqual(result.valid, false);
  });

  it('rejects negative maxDelegationDepth', () => {
    const result = validateWorkerIdentity({
      ...validWorker,
      guardrails: { ...validWorker.guardrails, maxDelegationDepth: -1 },
    });
    assert.strictEqual(result.valid, false);
  });

  it('rejects missing guardrails', () => {
    const { guardrails, ...rest } = validWorker;
    const result = validateWorkerIdentity(rest);
    assert.strictEqual(result.valid, false);
  });
});

// ---------------------------------------------------------------------------
// validateBuyerIdentity
// ---------------------------------------------------------------------------

describe('validateBuyerIdentity', () => {
  const validBuyer = {
    buyerId: 'buyer_abc123',
    address: '0x' + 'a'.repeat(40),
    publicKey: 'b'.repeat(64),
  };

  it('validates a complete buyer identity', () => {
    const result = validateBuyerIdentity(validBuyer);
    assert.strictEqual(result.valid, true);
  });

  it('rejects missing buyerId', () => {
    const { buyerId, ...rest } = validBuyer;
    const result = validateBuyerIdentity(rest);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('buyerId')));
  });

  it('rejects invalid address', () => {
    const result = validateBuyerIdentity({ ...validBuyer, address: 'not-an-address' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('address')));
  });

  it('rejects missing publicKey', () => {
    const { publicKey, ...rest } = validBuyer;
    const result = validateBuyerIdentity(rest);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('publicKey')));
  });

  it('rejects invalid publicKey format', () => {
    const result = validateBuyerIdentity({ ...validBuyer, publicKey: '0xabc' });
    assert.strictEqual(result.valid, false);
  });

  it('rejects null', () => {
    const result = validateBuyerIdentity(null);
    assert.strictEqual(result.valid, false);
  });
});
