# aefi

**aefi** is the financial intelligence layer for the agent economy.

Agent commerce spreads identity, jobs, payments, outcomes, and authorization across
many systems. A settlement can prove that funds moved without answering who acted,
under what mandate, for which job, or with what confidence. aefi indexes onchain
evidence (starting on Arc), correlates it into a queryable graph, and returns
disposition — confidence and known gaps — so agents and marketplaces can evaluate
counterparties and verify economic activity without becoming a wallet, registry,
escrow, or marketplace themselves.

Spec: [`docs/ideation/spec/v1.md`](docs/ideation/spec/v1.md).

## Components

| Path | Responsibility |
| --- | --- |
| `services/indexer` | Poll Arc allowlisted contracts → decode → **Postgres** only |
| `services/matcher` | Read Postgres events → correlators → project **Neo4j** graph |
| `services/rules` | Drools disposition (`POST /v1/disposition`) — confidence from facts |
| `services/api` | HTTP `/v1` + MCP; reads Neo4j; optional x402; calls rules (TS fallback) |
| `apps/www` | Brand apex — [`aefi.io`](https://aefi.io) |
| `apps/studio` | Evidence Studio demo — [`demo.aefi.io`](https://demo.aefi.io) |
| `packages/contracts` | OpenAPI, JSON Schema, graph model, enums |
| `packages/sdk-js` | Client SDK (planned) |
| `deploy/` | Cloud Run / Cloud Build / Cloudflare tunnel docs |

Hard rule: indexer writes **Postgres only**; matcher projects **Neo4j**; API serves
graph + tools.

## Domains

| Host | App |
| --- | --- |
| `aefi.io` | `@aefi/www` |
| `demo.aefi.io` | `@aefi/studio` |
| `hackathon.aefi.io` | optional CNAME → `demo.aefi.io` |
| `api.aefi.io` | `@aefi/api` (Cloud Run, Cloudflare Tunnel) |

Production layout: [`deploy/README.md`](deploy/README.md).

## Status

### Complete

- Arc testnet indexer (P0 allowlist) → Postgres  
- Matcher correlators → Neo4j (shared Aura)  
- Wave A API on graph evidence (provider search, explain, verify, MCP)  
- Drools confidence disposition service  
- x402 paywall gate (off by default in prod)  
- Evidence Studio + brand www  
- GCP deploy (`aefi-io`): Cloud Run, Cloud SQL, Cloudflare Tunnel, Cloud Build on `main`

### Planned

- Deeper Wave B/C evidence (mandates, richer auth disposition)  
- Mainnet dual Cloud Run (shared data layer already chain-scoped)  
- `packages/sdk-js`  
- GraphRAG / richer retrieval  
- Cloudflare adapters and further prod hardening  

## Quick start

Full local walkthrough: **[run_locally.md](./run_locally.md)**.

```bash
cp .env.example .env
docker compose up -d postgres
docker compose --profile graph up -d neo4j
pnpm install
# run indexer + matcher against Arc (or use existing projected graph)
pnpm --filter @aefi/api embed:providers   # optional NL recall
pnpm --filter @aefi/api dev
# → http://localhost:8787/health

pnpm --filter @aefi/studio dev
# → http://localhost:5173
```
