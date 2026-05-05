-- 0005_jobs.sql — Job lifecycle tracking
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  buyer_id TEXT REFERENCES buyers(id),
  service_id TEXT REFERENCES services(id),
  payment_auth_id TEXT,
  input_hash TEXT NOT NULL,
  result_hash TEXT,
  status TEXT DEFAULT 'created',
  model TEXT,
  model_provider TEXT,
  timeout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_worker ON jobs(worker_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
