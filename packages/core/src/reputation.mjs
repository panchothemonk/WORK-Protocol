/**
 * WORK Protocol v4 — Reputation Engine
 * Multi-dimensional scoring with value weighting and time decay.
 *
 * Dimensions:
 *   - reliability: completion rate, response time
 *   - quality: dispute rate, buyer satisfaction
 *   - economic: total earnings, avg job value
 *   - composability: delegation success rate
 */

/**
 * Compute weighted reputation score from events.
 * score = Σ (valueWeight × timeDecay × eventValue)
 *
 * @param {Array<{event_type:string, value:number, created_at:string}>} events
 * @param {object} [opts]
 * @param {number} [opts.decayLambda] - decay factor (default 0.01)
 * @returns {object} per-dimension scores + overall
 */
export function computeScores(events, { decayLambda = 0.01 } = {}) {
  const now = Date.now();
  const dimensions = {
    reliability: { score: 0, count: 0 },
    quality: { score: 0, count: 0 },
    economic: { score: 0, count: 0 },
    composability: { score: 0, count: 0 },
  };

  for (const event of events) {
    const dim = dimensionForEvent(event.event_type);
    if (!dim || !dimensions[dim]) continue;

    const daysSince = (now - new Date(event.created_at).getTime()) / 86_400_000;
    const timeDecay = Math.exp(-decayLambda * daysSince);
    const valueWeight = Math.log10(Math.max(event.value, 1));

    dimensions[dim].score += valueWeight * timeDecay;
    dimensions[dim].count++;
  }

  // Calculate overall score (average of dimension scores)
  const activeDimensions = Object.values(dimensions).filter(d => d.count > 0);
  const overall = activeDimensions.length > 0
    ? activeDimensions.reduce((sum, d) => sum + d.score, 0) / activeDimensions.length
    : 0;

  return {
    dimensions: Object.fromEntries(
      Object.entries(dimensions).map(([k, v]) => [k, { score: Math.round(v.score * 100) / 100, eventCount: v.count }])
    ),
    overall: Math.round(overall * 100) / 100,
    totalEvents: events.length,
  };
}

/**
 * Map event type to reputation dimension.
 */
function dimensionForEvent(eventType) {
  const map = {
    'job_completed': 'reliability',
    'job_failed': 'reliability',
    'job_completed_on_time': 'reliability',
    'job_completed_late': 'reliability',
    'dispute_filed': 'quality',
    'dispute_won': 'quality',
    'dispute_lost': 'quality',
    'buyer_rated': 'quality',
    'payment_received': 'economic',
    'premium_job': 'economic',
    'delegation_completed': 'composability',
    'delegation_failed': 'composability',
  };
  return map[eventType] || null;
}

/**
 * Check if a worker should accept a job from this buyer.
 * @param {object} buyerRep - buyer reputation scores
 * @param {number} [riskThreshold] - minimum acceptable overall score (default 0)
 * @returns {{ accept: boolean, reason?: string }}
 */
export function shouldAcceptJob(buyerRep, riskThreshold = 0) {
  if (!buyerRep || buyerRep.overall < riskThreshold) {
    return { accept: false, reason: `Buyer reputation ${buyerRep?.overall || 'unknown'} below threshold ${riskThreshold}` };
  }
  return { accept: true };
}

/**
 * Record a reputation event value.
 * Positive events add value, negative events subtract.
 *
 * @param {string} eventType
 * @returns {number} value for this event
 */
export function eventValue(eventType) {
  const values = {
    'job_completed': 10,
    'job_completed_on_time': 15,
    'job_completed_late': 5,
    'job_failed': -20,
    'dispute_won': 5,
    'dispute_lost': -30,
    'buyer_rated': 2,
    'payment_received': 8,
    'premium_job': 20,
    'delegation_completed': 12,
    'delegation_failed': -15,
  };
  return values[eventType] || 0;
}
