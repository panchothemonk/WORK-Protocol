// payment.test.mjs — Tests for payment module
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCdpConfigured,
  buildTransferAuthorization,
  buildThreeWayTransfers,
} from '../src/payment.mjs';

describe('isCdpConfigured', () => {
  it('returns false when keys are not set', () => {
    delete process.env.CDP_API_KEY_NAME;
    delete process.env.CDP_API_KEY_PRIVATE_KEY;
    assert.equal(isCdpConfigured(), false);
  });

  it('returns true when both keys are set', () => {
    process.env.CDP_API_KEY_NAME = 'test-key';
    process.env.CDP_API_KEY_PRIVATE_KEY = 'test-private';
    assert.equal(isCdpConfigured(), true);
    delete process.env.CDP_API_KEY_NAME;
    delete process.env.CDP_API_KEY_PRIVATE_KEY;
  });

  it('returns false when only one key is set', () => {
    process.env.CDP_API_KEY_NAME = 'test-key';
    delete process.env.CDP_API_KEY_PRIVATE_KEY;
    assert.equal(isCdpConfigured(), false);
    delete process.env.CDP_API_KEY_NAME;
  });
});

describe('buildTransferAuthorization', () => {
  it('builds valid transfer authorization', () => {
    const transfer = buildTransferAuthorization({
      from: '0xBuyer',
      to: '0xWorker',
      value: '1000000',
      nonce: '0xdeadbeef',
      validAfter: 0,
      validBefore: 9999999999,
    });
    assert.equal(transfer.from, '0xBuyer');
    assert.equal(transfer.to, '0xWorker');
    assert.equal(transfer.value, '1000000');
    assert.equal(transfer.nonce, '0xdeadbeef');
    assert.equal(typeof transfer.validAfter, 'string');
    assert.equal(typeof transfer.validBefore, 'string');
  });

  it('all values are strings (JSON-safe)', () => {
    const transfer = buildTransferAuthorization({
      from: '0xBuyer', to: '0xWorker', value: 500000n,
      nonce: 12345n, validAfter: 0, validBefore: 9999999999,
    });
    assert.doesNotThrow(() => JSON.stringify(transfer));
  });
});

describe('buildThreeWayTransfers', () => {
  it('builds 3 transfers for the protocol split', () => {
    const transfers = buildThreeWayTransfers({
      buyerAddress: '0xBuyer',
      splits: [
        { purpose: 'worker_payout', amountMicroUsd: '100000000', toAddress: '0xWorker' },
        { purpose: 'ai_cost', amountMicroUsd: '2000000', toAddress: '0xAI' },
        { purpose: 'protocol_fee', amountMicroUsd: '3000000', toAddress: '0xVault' },
      ],
      nonces: {
        worker_payout: '0x01',
        ai_cost: '0x02',
        protocol_fee: '0x03',
      },
    });

    assert.equal(transfers.length, 3);
    assert.equal(transfers[0].purpose, 'worker_payout');
    assert.equal(transfers[0].transfer.to, '0xWorker');
    assert.equal(transfers[0].transfer.value, '100000000');
    assert.equal(transfers[1].purpose, 'ai_cost');
    assert.equal(transfers[2].purpose, 'protocol_fee');
    assert.equal(transfers[2].transfer.to, '0xVault');
    assert.equal(transfers[2].transfer.value, '3000000');
  });

  it('each transfer has the same buyer address', () => {
    const transfers = buildThreeWayTransfers({
      buyerAddress: '0xBuyerX',
      splits: [
        { purpose: 'worker_payout', amountMicroUsd: '1000', toAddress: '0xA' },
        { purpose: 'ai_cost', amountMicroUsd: '100', toAddress: '0xB' },
        { purpose: 'protocol_fee', amountMicroUsd: '30', toAddress: '0xC' },
      ],
      nonces: { worker_payout: '1', ai_cost: '2', protocol_fee: '3' },
    });
    transfers.forEach(t => assert.equal(t.transfer.from, '0xBuyerX'));
  });
});
