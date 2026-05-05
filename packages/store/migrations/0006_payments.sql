CREATE TABLE IF NOT EXISTS payment_authorizations (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  rail TEXT NOT NULL DEFAULT 'x402',
  status TEXT DEFAULT 'secured',
  splits JSONB NOT NULL,
  settlement_id TEXT,
  tx_hashes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pa_job ON payment_authorizations(job_id);
