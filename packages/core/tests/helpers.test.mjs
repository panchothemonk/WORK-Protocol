// helpers.test.mjs — Tests for payment helpers
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { serializeForCdp, microUsdToHuman, humanToMicroUsd, buildSettlementRequest } from '../src/helpers.mjs';

describe('serializeForCdp', () => {
  it('converts BigInt to string', () => {
    assert.equal(serializeForCdp(BigInt(123)), '123');
  });

  it('converts nested BigInts', () => {
    const obj = { a: BigInt(1), b: { c: BigInt(2) } };
    const result = serializeForCdp(obj);
    assert.equal(result.a, '1');
    assert.equal(result.b.c, '2');
  });

  it('converts BigInts in arrays', () => {
    const arr = [BigInt(1), BigInt(2), 3];
    const result = serializeForCdp(arr);
    assert.deepEqual(result, ['1', '2', 3]);
  });

  it('passes through non-BigInt values', () => {
    assert.equal(serializeForCdp('hello'), 'hello');
    assert.equal(serializeForCdp(42), 42);
    assert.equal(serializeForCdp(null), null);
    assert.equal(serializeForCdp(true), true);
  });

  it('produces JSON-safe output', () => {
    const obj = { nonce: BigInt(42), validAfter: BigInt(0) };
    const serialized = serializeForCdp(obj);
    assert.doesNotThrow(() => JSON.stringify(serialized));
    const parsed = JSON.parse(JSON.stringify(serialized));
    assert.equal(parsed.nonce, '42');
  });
});

describe('unit conversion', () => {
  it('microUsdToHuman: 1000000 = $1.00', () => {
    assert.equal(microUsdToHuman('1000000'), 1.0);
  });

  it('microUsdToHuman: 50000000 = $50.00', () => {
    assert.equal(microUsdToHuman('50000000'), 50.0);
  });

  it('humanToMicroUsd: $1.00 = 1000000', () => {
    assert.equal(humanToMicroUsd(1.0), '1000000');
  });

  it('roundtrip: human → microUsd → human', () => {
    assert.equal(microUsdToHuman(humanToMicroUsd(3.14)), 3.14);
  });
});

describe('buildSettlementRequest', () => {
  it('serializes BigInt values in settlement request', () => {
    const req = buildSettlementRequest({
      splits: [{ purpose: 'worker_payout', amountMicroUsd: '1000000' }],
      signatures: [{ v: 27, r: '0xaa', s: '0xbb', nonce: BigInt(12345) }],
    });
    const json = JSON.stringify(req);
    const parsed = JSON.parse(json);
    assert.equal(parsed.signatures[0].nonce, '12345');
  });
});
