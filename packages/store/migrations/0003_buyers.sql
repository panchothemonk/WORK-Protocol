-- 0003_buyers.sql — Buyer registration
CREATE TABLE IF NOT EXISTS buyers (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buyers_address ON buyers(address);
