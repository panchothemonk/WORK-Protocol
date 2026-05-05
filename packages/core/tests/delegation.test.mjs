// delegation.test.mjs — Tests for delegation module
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { delegate, releaseExpiredDelegations } from '../src/delegation.mjs';

function mockStore() {
  const data = {
    workers: { 'wrk_parent': { id: 'wrk_parent', guardrails: { maxDelegationDepth: 3 } } },
    jobs: {
      'job_parent': { id: 'job_parent', worker_id: 'wrk_parent', buyer_id: 'buy_1', status: 'in_progress' },
    },
    delegations: {},
    expired: [],
  };

  return {
    workers: { getWorker: async (id) => data.workers[id] || null },
    jobs: {
      getJob: async (id) => data.jobs[id] || null,
      createJob: async (job) => { data.jobs[job.id] = job; return job; },
      updateStatus: async (id, status) => { if (data.jobs[id]) data.jobs[id].status = status; return data.jobs[id]; },
    },
    delegations: {
      listByParent: async (parentId) => Object.values(data.delegations).filter(d => d.parent_job_id === parentId),
      createDelegation: async (d) => { data.delegations[d.id] = d; return d; },
      getExpired: async () => data.expired,
      updateStatus: async (id, status) => { if (data.delegations[id]) data.delegations[id].status = status; return data.delegations[id]; },
    },
    receipts: {
      getReceipt: async (id) => null,
      listByWorker: async (id) => [],
    },
  };
}

describe('delegate', () => {
  it('creates child job and delegation link', async () => {
    const store = mockStore();
    const result = await delegate({
      store, parentJobId: 'job_parent', childWorkerId: 'wrk_child',
      budgetMicroUsd: '1000000', input: { task: 'subtask' },
    });

    assert.ok(result.delegation.id.startsWith('del_'));
    assert.ok(result.childJob.id.startsWith('job_'));
    assert.equal(result.delegation.parent_job_id, 'job_parent');
    assert.equal(result.delegation.budget_micro_usd, '1000000');
    assert.equal(result.childJob.status, 'created');
  });

  it('rejects delegation when parent job is final', async () => {
    const store = mockStore();
    store.jobs.getJob = async () => ({ id: 'job_parent', status: 'completed' });

    await assert.rejects(
      () => delegate({ store, parentJobId: 'job_parent', childWorkerId: 'x', budgetMicroUsd: '100', input: {} }),
      /PARENT_JOB_ALREADY_FINAL/
    );
  });

  it('rejects when parent job not found', async () => {
    const store = mockStore();
    await assert.rejects(
      () => delegate({ store, parentJobId: 'bad', childWorkerId: 'x', budgetMicroUsd: '100', input: {} }),
      /PARENT_JOB_NOT_FOUND/
    );
  });
});

describe('releaseExpiredDelegations', () => {
  it('releases expired pending delegations', async () => {
    const store = mockStore();
    store.delegations.getExpired = async () => [
      { id: 'del_exp1', child_job_id: 'job_c1', status: 'pending' },
      { id: 'del_exp2', child_job_id: 'job_c2', status: 'pending' },
    ];

    const released = await releaseExpiredDelegations({ store });
    assert.equal(released.length, 2);
    assert.ok(released.includes('del_exp1'));
    assert.ok(released.includes('del_exp2'));
  });

  it('skips already-completed delegations', async () => {
    const store = mockStore();
    store.delegations.getExpired = async () => [
      { id: 'del_1', child_job_id: 'c1', status: 'completed' },
    ];

    const released = await releaseExpiredDelegations({ store });
    assert.equal(released.length, 0);
  });
});
