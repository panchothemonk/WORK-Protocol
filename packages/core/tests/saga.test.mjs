// saga.test.mjs — Tests for settlement saga
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeSettlement, simpleSettle } from '../src/saga.mjs';

// Mock client that always succeeds
function mockSuccessClient() {
  return {
    settle: async (st) => ({ txHash: `tx_${st.purpose}` }),
  };
}

// Mock client that always fails
function mockFailClient() {
  return {
    settle: async () => { throw new Error('settlement failed'); },
  };
}

// Mock client that succeeds for some, fails for others
function mockPartialClient(failPurposes = []) {
  return {
    settle: async (st) => {
      if (failPurposes.includes(st.purpose)) {
        throw new Error(`failed: ${st.purpose}`);
      }
      return { txHash: `tx_${st.purpose}` };
    },
  };
}

const signedTransfers = [
  { purpose: 'worker_payout', signature: {}, transfer: { to: '0xW' } },
  { purpose: 'ai_cost', signature: {}, transfer: { to: '0xA' } },
  { purpose: 'protocol_fee', signature: {}, transfer: { to: '0xV' } },
];

describe('executeSettlement', () => {
  it('succeeds when CDP settles all 3 transfers', async () => {
    const result = await executeSettlement({
      cdpClient: mockSuccessClient(),
      onchainClient: null,
      signedTransfers,
    });
    assert.equal(result.success, true);
    assert.equal(result.txHashes.length, 3);
    assert.equal(result.settledPurposes.length, 3);
  });

  it('falls back to onchain when CDP fails', async () => {
    const result = await executeSettlement({
      cdpClient: mockFailClient(),
      onchainClient: mockSuccessClient(),
      signedTransfers,
    });
    assert.equal(result.success, true);
    assert.equal(result.txHashes.length, 3);
  });

  it('reports partial settlement', async () => {
    const result = await executeSettlement({
      cdpClient: mockPartialClient(['protocol_fee']),
      onchainClient: null,
      signedTransfers,
    });
    assert.equal(result.success, false);
    assert.equal(result.settledPurposes.length, 2);
    assert.equal(result.failedPurposes.length, 1);
    assert.ok(result.error.includes('protocol_fee'));
  });

  it('returns empty when no client is configured', async () => {
    const result = await executeSettlement({
      cdpClient: null,
      onchainClient: null,
      signedTransfers,
    });
    assert.equal(result.success, false);
    assert.equal(result.settledPurposes.length, 0);
  });

  it('onchain compensates for CDP partial failure', async () => {
    const result = await executeSettlement({
      cdpClient: mockPartialClient(['worker_payout', 'ai_cost']),
      onchainClient: mockSuccessClient(),
      signedTransfers,
    });
    assert.equal(result.success, true);
    assert.equal(result.txHashes.length, 3);
  });
});

describe('simpleSettle', () => {
  it('settles all via single client', async () => {
    const result = await simpleSettle(mockSuccessClient(), signedTransfers);
    assert.equal(result.success, true);
    assert.equal(result.txHashes.length, 3);
  });

  it('fails when client is null', async () => {
    const result = await simpleSettle(null, signedTransfers);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No settlement client'));
  });
});
