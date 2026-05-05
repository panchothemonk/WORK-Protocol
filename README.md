# WORK Protocol v4 — Deployment

## Quick Start

```bash
# Clone
git clone https://github.com/panchothemonk/WORK-Protocol.git
cd WORK-Protocol
pnpm install

# Database
createdb work_protocol_v4
DATABASE_URL=postgresql://localhost:5432/work_protocol_v4

# Start
node apps/api/src/server.mjs
# → WORK Protocol API v4.0 listening on 3100

# Verify
curl http://localhost:3100/health
# → {"ok":true,"protocol":"WORK Protocol","version":"4.0"}
```

## Systemd (Production)

```bash
sudo cp deploy/work-protocol.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now work-protocol
```

## Tests

```bash
# Unit tests
node --test packages/core/tests/*.test.mjs    # 206 tests
npm test  # all tests

# E2E (requires running API)
WORK_API_URL=http://localhost:3100 node --test tests/e2e/happy-path.test.mjs
```

## Env Vars

| Variable | Required | Default |
|----------|----------|---------|
| DATABASE_URL | Yes | — |
| PORT | No | 3100 |
| WORK_PROTOCOL_FEE_BPS | No | 300 |
| CDP_API_KEY_NAME | No | — |
| CDP_API_KEY_PRIVATE_KEY | No | — |
| BASE_VAULT_ADDRESS | No | 0xf6D... |
