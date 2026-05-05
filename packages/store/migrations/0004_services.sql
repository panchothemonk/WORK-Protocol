-- 0004_services.sql — Worker service listings
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  name TEXT NOT NULL,
  description TEXT,
  price_micro_usd TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_worker ON services(worker_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
