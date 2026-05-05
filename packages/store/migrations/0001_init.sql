-- 0001_init.sql — Core protocol tables

CREATE TABLE IF NOT EXISTS signing_keys (
  id TEXT PRIMARY KEY DEFAULT 'protocol',
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
