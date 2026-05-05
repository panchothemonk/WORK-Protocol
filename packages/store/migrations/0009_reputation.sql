CREATE TABLE IF NOT EXISTS reputation_scores (
  worker_id TEXT NOT NULL REFERENCES workers(id),
  dimension TEXT NOT NULL,
  score REAL DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (worker_id, dimension)
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  job_id TEXT REFERENCES jobs(id),
  event_type TEXT NOT NULL,
  value REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rep_events_worker ON reputation_events(worker_id);
