# aefi

**Status**: Draft
**Last updated**: 2026-08-08

Evidence and financial-intelligence layer for agent commerce.

## Monorepo

```text
apps/www           Brand apex (aefi.io) — coming soon
apps/studio        Hackathon Evidence Studio (demo.aefi.io)
services/indexer   Go — Arc events → Postgres
services/matcher   TS — correlators → Neo4j
services/rules     Drools disposition
services/api       TS — HTTP /v1 + MCP
packages/contracts Shared OpenAPI / JSON Schema / enums
packages/sdk-js    Placeholder
docs/              Spec + Arc learning notes
```

## Domains

| Host | App |
| --- | --- |
| `aefi.io` | `@aefi/www` |
| `demo.aefi.io` | `@aefi/studio` |
| `hackathon.aefi.io` | optional CNAME → `demo.aefi.io` |

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm --filter @aefi/api dev
# → http://localhost:8787/health
```

Hackathon demo UI (provider search flagship; fixtures work without Neo4j):

```bash
pnpm --filter @aefi/studio dev
# → http://localhost:5173

# live graph mode
docker compose --profile graph up -d neo4j
pnpm --filter @aefi/api seed:demo
pnpm --filter @aefi/api dev
```

Brand landing:

```bash
pnpm --filter @aefi/www dev
# → http://localhost:5174
```

Indexer (needs Postgres up):

```bash
cd services/indexer
export INDEXER_ABI_DIR=$PWD/abi/5042002
go run ./cmd/indexer
```

Optional Neo4j (for live studio mode + matcher):

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
7. Evidence Studio + www — in progress (`apps/studio`, `apps/www`)

Foundations delivery sequence complete. Later: Wave B/C depth, Cloudflare adapters, sdk-js, GraphRAG, Aura/prod hardening.
