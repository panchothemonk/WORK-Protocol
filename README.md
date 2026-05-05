# WORK Protocol v4

**Payment layer for AI agents. Stripe, not Shopify.**

WORK Protocol is infrastructure that lets AI agents get paid in USDC, sign cryptographic receipts, and build portable reputation — regardless of what platform they run on. Agents install our core library + their platform's adapter. They get paid. We don't host them. We don't execute their work. We provide the payment rails and sign the receipts.

## Architecture

```
Paperclip agents ──┐
Hermes agents    ──┤
OpenClaw agents  ──┼── @workprotocol/core ── CDP x402 ── Receipt
Claude Code      ──┤        ▲
Custom agents    ──┘        │
                    Platform adapters
                    (thin wrappers, ~200-600 lines each)
```

## How It Works

1. A worker agent registers with the protocol (Ed25519 keypair + withdrawal address)
2. A buyer pays for a job via CDP x402 (zero gas, USDC on Base)
3. The protocol splits the payment: worker payout + AI cost + 3% protocol fee
4. Every job produces a cryptographic receipt, signed by the protocol
5. Receipts are anchored on Base — portable, verifiable, reconstructable

## Fee Structure

```
$100.00 job:
  Split 1 — Worker gets:    $100.00
  Split 2 — AI cost:          $2.00   (reimburses compute)
  Split 3 — Protocol fee:     $3.00   (3% of worker payout only)
  Buyer pays total:          $105.00
```

Protocol fee = 3% of worker payout only. Not on AI cost. Not on total.

## Tech Stack

- **Runtime:** Node.js 20+ ESM
- **Package manager:** pnpm 9+ workspace
- **Database:** Postgres 16
- **Crypto:** Ed25519 (@noble/ed25519), SHA-256
- **Payments:** EIP-3009 via Coinbase CDP x402, viem fallback
- **Chain:** Base L2 (mainnet + sepolia testnet)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start Postgres
docker compose up -d

# Copy and configure environment
cp .env.example .env

# Run tests
pnpm test
```

## Packages

| Package | Description |
|---------|-------------|
| `@workprotocol/core` | Shared library — types, crypto, receipt signing, economics, identity, payment, jobs |
| `@workprotocol/cli` | `work` CLI — universal, any agent any platform |
| `@workprotocol/store` | Postgres data layer, migrations, CRUD |
| `@workprotocol/sdk` | High-level SDK wrappers for workers and buyers |

## Platform Adapters

| Adapter | Lines | Priority |
|---------|-------|----------|
| agentskills.io SKILL.md | ~100 | 1st (widest reach) |
| Paperclip plugin | ~500 | 2nd |
| Hermes plugin | ~300 | 3rd |
| OpenClaw plugin | ~700 | Later |

## License

MIT
