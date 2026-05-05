/**
 * WORK Protocol v4 — Economics unit tests
 *
 * Usage: node --test packages/core/tests/economics.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSplits,
  microUsdToHuman,
  humanToMicroUsd,
  validateSplits,
  FEE_BPS,
} from '../src/economics.mjs';

// ---- calculateSplits ------------------------------------------------------

describe('calculateSplits', () => {
  it('$100 job: workerPayout=100000000, aiCost=2000000 → fee=3000000 (3%)', () => {
    const splits = calculateSplits('100000000', '2000000', 300);
    assert.deepStrictEqual(splits, [
      { purpose: 'worker_payout', amountMicroUsd: '100000000' },
      { purpose: 'ai_cost', amountMicroUsd: '2000000' },
      { purpose: 'protocol_fee', amountMicroUsd: '3000000' },
    ]);
  });

  it('$0.50 job: workerPayout=500000, aiCost=0 → fee=15000', () => {
    const splits = calculateSplits('500000', '0');
    assert.deepStrictEqual(splits, [
      { purpose: 'worker_payout', amountMicroUsd: '500000' },
      { purpose: 'ai_cost', amountMicroUsd: '0' },
      { purpose: 'protocol_fee', amountMicroUsd: '15000' },
    ]);
  });

  it('fee is never applied to aiCost — changing aiCost does not change fee', () => {
    const splits1 = calculateSplits('100000000', '2000000');
    const splits2 = calculateSplits('100000000', '999999999');
    // Fee must be identical since workerPayout is the same
    assert.strictEqual(splits1[2].amountMicroUsd, splits2[2].amountMicroUsd);
    // AI cost is different
    assert.strictEqual(splits1[1].amountMicroUsd, '2000000');
    assert.strictEqual(splits2[1].amountMicroUsd, '999999999');
  });

  it('fee floors (integer math) — workerPayout=333333 → fee=9999', () => {
    // 333333 * 300 / 10000 = 9999.99 → floor = 9999
    const splits = calculateSplits('333333', '0');
    assert.strictEqual(splits[2].amountMicroUsd, '9999');
  });

  it('custom feeBps — 500 bps on 1000000 → fee=50000', () => {
    const splits = calculateSplits('1000000', '0', 500);
    assert.strictEqual(splits[2].amountMicroUsd, '50000');
  });

  it('always returns exactly 3 splits', () => {
    const splits = calculateSplits('1', '1');
    assert.strictEqual(splits.length, 3);
  });
});

// ---- Unit conversion ------------------------------------------------------

describe('microUsdToHuman', () => {
  it('1000000 → 1.00', () => {
    assert.strictEqual(microUsdToHuman('1000000'), 1.00);
  });

  it('0 → 0', () => {
    assert.strictEqual(microUsdToHuman('0'), 0);
  });

  it('500000 → 0.50', () => {
    assert.strictEqual(microUsdToHuman('500000'), 0.50);
  });

  it('123456789 → 123.456789', () => {
    assert.strictEqual(microUsdToHuman('123456789'), 123.456789);
  });
});

describe('humanToMicroUsd', () => {
  it('1.00 → "1000000"', () => {
    assert.strictEqual(humanToMicroUsd(1.00), '1000000');
  });

  it('0.50 → "500000"', () => {
    assert.strictEqual(humanToMicroUsd(0.50), '500000');
  });

  it('0 → "0"', () => {
    assert.strictEqual(humanToMicroUsd(0), '0');
  });

  it('123.456789 → "123456789"', () => {
    assert.strictEqual(humanToMicroUsd(123.456789), '123456789');
  });
});

describe('microUsdToHuman ↔ humanToMicroUsd roundtrip', () => {
  it('roundtrip: humanToMicroUsd(microUsdToHuman("1000000")) === "1000000"', () => {
    const result = humanToMicroUsd(microUsdToHuman('1000000'));
    assert.strictEqual(result, '1000000');
  });

  it('roundtrip: "500000"', () => {
    const result = humanToMicroUsd(microUsdToHuman('500000'));
    assert.strictEqual(result, '500000');
  });

  it('roundtrip: "123456789"', () => {
    const result = humanToMicroUsd(microUsdToHuman('123456789'));
    assert.strictEqual(result, '123456789');
  });

  it('roundtrip: microUsdToHuman(humanToMicroUsd(42.50)) ≈ 42.50', () => {
    const result = microUsdToHuman(humanToMicroUsd(42.50));
    // Due to Math.floor, may have tiny imprecision; assert close
    assert.ok(Math.abs(result - 42.50) < 0.0001);
  });
});

// ---- validateSplits -------------------------------------------------------

describe('validateSplits', () => {
  const validSplits = calculateSplits('100000000', '2000000');

  it('accepts valid splits', () => {
    const result = validateSplits(validSplits, '100000000', '2000000');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('rejects wrong worker_payout amount', () => {
    const result = validateSplits(validSplits, '99999999', '2000000');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('worker_payout mismatch')));
  });

  it('rejects wrong ai_cost amount', () => {
    const result = validateSplits(validSplits, '100000000', '99999999');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('ai_cost mismatch')));
  });

  it('rejects missing purpose', () => {
    const bad = [{ amountMicroUsd: '100' }, { purpose: 'ai_cost', amountMicroUsd: '0' }, { purpose: 'protocol_fee', amountMicroUsd: '0' }];
    const result = validateSplits(bad, '100', '0');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('missing purpose')));
  });

  it('rejects unexpected purpose', () => {
    const bad = [
      { purpose: 'worker_payout', amountMicroUsd: '100' },
      { purpose: 'ai_cost', amountMicroUsd: '0' },
      { purpose: 'bonus', amountMicroUsd: '0' },
    ];
    const result = validateSplits(bad, '100', '0');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('unexpected purpose')));
  });

  it('rejects duplicate purposes', () => {
    const bad = [
      { purpose: 'worker_payout', amountMicroUsd: '100' },
      { purpose: 'worker_payout', amountMicroUsd: '0' },
      { purpose: 'protocol_fee', amountMicroUsd: '0' },
    ];
    const result = validateSplits(bad, '100', '0');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('duplicate purpose')));
  });

  it('rejects non-array input', () => {
    const result = validateSplits(null, '100', '0');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('must be an array')));
  });

  it('rejects wrong number of splits', () => {
    const result = validateSplits([], '100', '0');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('expected 3')));
  });

  it('rejects non-string amountMicroUsd', () => {
    const bad = [
      { purpose: 'worker_payout', amountMicroUsd: 100 },
      { purpose: 'ai_cost', amountMicroUsd: '0' },
      { purpose: 'protocol_fee', amountMicroUsd: '0' },
    ];
    const result = validateSplits(bad, '100', '0');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('must be a string')));
  });

  it('rejects missing amountMicroUsd', () => {
    const bad = [
      { purpose: 'worker_payout' },
      { purpose: 'ai_cost', amountMicroUsd: '0' },
      { purpose: 'protocol_fee', amountMicroUsd: '0' },
    ];
    const result = validateSplits(bad, '100', '0');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('missing amountMicroUsd')));
  });
});
