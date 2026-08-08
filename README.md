# aefi

**Status**: Draft
**Last updated**: 2026-08-08

Evidence and financial-intelligence layer for agent commerce.

## Monorepo

```text
services/indexer   Go — Arc events → Postgres
services/matcher   TS — correlators → Neo4j (stub in #1)
services/rules     Drools disposition (stub in #1)
services/api       TS — HTTP /v1 + MCP
packages/contracts Shared OpenAPI / JSON Schema / enums
packages/sdk-js    Placeholder
docs/              Spec + Arc learning notes
```

## Quick start (scaffold #1)

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm --filter @aefi/api dev
# → http://localhost:8787/health
```

Indexer (needs Postgres up):

```bash
cd services/indexer
export INDEXER_ABI_DIR=$PWD/abi/5042002
go run ./cmd/indexer
```

Optional Neo4j (for later matcher work):

```bash
docker compose --profile graph up -d neo4j
```

## Delivery sequence

1. Scaffold — done  
2. Indexer live (P0 decode) — done (`services/indexer`)  
3. Matcher + graph — done (`services/matcher` → Neo4j)  
4. Wave A API on real evidence — done (`services/api`)  
5. Drools disposition service — done (`services/rules`)  
6. x402 agent paywall — done (`services/api` x402 gate)  

Foundations delivery sequence complete. Later: Wave B/C depth, Cloudflare adapters, sdk-js, GraphRAG, Aura/prod hardening.
