// reputation.test.mjs — Tests for reputation engine
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeScores, shouldAcceptJob, eventValue } from '../src/reputation.mjs';

describe('computeScores', () => {
  it('returns zero for no events', () => {
    const result = computeScores([]);
    assert.equal(result.overall, 0);
    assert.equal(result.totalEvents, 0);
  });

  it('scores recent completions higher than old ones', () => {
    const now = Date.now();
    const recent = computeScores([
      { event_type: 'job_completed', value: 10, created_at: new Date(now).toISOString() },
    ]);
    const old = computeScores([
      { event_type: 'job_completed', value: 10, created_at: new Date(now - 90 * 86_400_000).toISOString() },
    ]);
    assert.ok(recent.overall > old.overall, 'recent should score higher');
  });

  it('multi-dimensional scoring distributes correctly', () => {
    const events = [
      { event_type: 'job_completed', value: 10, created_at: new Date().toISOString() },
      { event_type: 'job_completed_on_time', value: 15, created_at: new Date().toISOString() },
      { event_type: 'payment_received', value: 8, created_at: new Date().toISOString() },
      { event_type: 'delegation_completed', value: 12, created_at: new Date().toISOString() },
    ];

    const result = computeScores(events);
    assert.ok(result.dimensions.reliability.score > 0);
    assert.ok(result.dimensions.economic.score > 0);
    assert.ok(result.dimensions.composability.score > 0);
    assert.ok(result.overall > 0);
  });

  it('negative events reduce scores', () => {
    const bad = computeScores([
      { event_type: 'job_failed', value: -20, created_at: new Date().toISOString() },
    ]);
    assert.ok(bad.overall <= 0);
  });
});

describe('shouldAcceptJob', () => {
  it('accepts when buyer score is above threshold', () => {
    const result = shouldAcceptJob({ overall: 5.0 }, 3.0);
    assert.equal(result.accept, true);
  });

  it('rejects when buyer score is below threshold', () => {
    const result = shouldAcceptJob({ overall: 1.0 }, 3.0);
    assert.equal(result.accept, false);
    assert.ok(result.reason.includes('below threshold'));
  });

  it('rejects unknown buyers', () => {
    const result = shouldAcceptJob(null, 3.0);
    assert.equal(result.accept, false);
    assert.ok(result.reason.includes('unknown'));
  });
});

describe('eventValue', () => {
  it('returns positive for good events', () => {
    assert.ok(eventValue('job_completed') > 0);
    assert.ok(eventValue('job_completed_on_time') > 0);
    assert.ok(eventValue('delegation_completed') > 0);
  });

  it('returns negative for bad events', () => {
    assert.ok(eventValue('job_failed') < 0);
    assert.ok(eventValue('dispute_lost') < 0);
  });

  it('returns 0 for unknown events', () => {
    assert.equal(eventValue('unknown_event'), 0);
  });
});
