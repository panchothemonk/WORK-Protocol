CREATE TABLE IF NOT EXISTS delegations (
  id TEXT PRIMARY KEY,
  parent_job_id TEXT NOT NULL REFERENCES jobs(id),
  child_job_id TEXT NOT NULL REFERENCES jobs(id),
  budget_micro_usd TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  timeout_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(parent_job_id, child_job_id)
);
CREATE INDEX IF NOT EXISTS idx_delegations_parent ON delegations(parent_job_id);
