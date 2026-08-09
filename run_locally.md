# Run aefi locally

Local developer guide for the monorepo: Docker infra, API, Evidence Studio, brand apex, and optional indexer / matcher / Drools.

> **Local path:** Postgres + Neo4j → indexer/matcher (or identity enrich) → API → studio.  
> Studio is live-only against the evidence graph (no client fixtures / demo seed).

## Quick start (studio + API)

**Prereqs once:** Docker Desktop (WSL integration if on Windows), Node 20+, pnpm 9, and `pnpm install` from the repo root.

```bash
cp .env.example .env
# optional studio overrides:
cp apps/studio/.env.example apps/studio/.env

pnpm install

docker compose up -d postgres
docker compose --profile graph up -d neo4j

# terminal A — API
pnpm --filter @aefi/api dev
# → http://localhost:8787/health

# terminal B — project events (or run indexer+matcher for Arc tip)
pnpm --filter @aefi/matcher project:once
# optional NL recall:
pnpm --filter @aefi/api embed:providers

# terminal C — Evidence Studio
pnpm --filter @aefi/studio dev
# → http://localhost:5173
```

Then open [http://localhost:5173](http://localhost:5173). Use an NL scenario (completed jobs / CCTP / treasury). Brand apex (optional): `pnpm --filter @aefi/www dev` → [http://localhost:5174](http://localhost:5174).

| Service | URL |
| --- | --- |
| Evidence Studio | [http://localhost:5173](http://localhost:5173) |
| Brand www | [http://localhost:5174](http://localhost:5174) |
| API health | `curl -s http://localhost:8787/health` |
| Neo4j Browser | [http://localhost:7474](http://localhost:7474) (user `neo4j` / `aefi-dev-password`) |

---

## Prerequisites

- Node **20+** and [pnpm](https://pnpm.io) 9 (`packageManager` in root `package.json`)
- Docker Desktop with WSL integration enabled (Postgres + Neo4j)
- Optional: Go 1.22+ for the indexer; JDK 21+ / Maven wrapper for Drools (`services/rules`)

## Layout

```text
apps/www           Brand apex (aefi.io) — Vite static
apps/studio        Hackathon Evidence Studio (demo.aefi.io)
services/indexer   Go — Arc allowlist ingest → Postgres only
services/matcher   TS — correlators → Neo4j projection
services/rules     Drools disposition (optional; API has TS fallback)
services/api       TS — HTTP /v1 + MCP + x402 gate
packages/contracts OpenAPI, JSON Schema, graph model, enums
docker-compose.yml Postgres + Neo4j (--profile graph)
```

Hard rule: indexer writes **Postgres only**; matcher projects **Neo4j**; API serves graph (+ raw events via tools).

## 1. Start Postgres and Neo4j

From the repo root:

```bash
docker compose up -d postgres
docker compose --profile graph up -d neo4j
docker compose --profile graph ps
```

You should see `aefi-postgres-1` healthy on `5432` and `aefi-neo4j-1` healthy on `7474` / `7687`.

Postgres is initialized from `services/indexer/migrations` on first volume create.

Stop infra:

```bash
docker compose --profile graph down
# wipe volumes (destroys local DB + graph):
# docker compose --profile graph down -v
```

## 2. Configure env

```bash
pnpm install

cp .env.example .env
cp apps/studio/.env.example apps/studio/.env
```

Root `.env` is what the API / indexer / matcher expect when run from the monorepo (export or load as your shell prefers). Important defaults:

| Variable | Local default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://aefi:aefi@localhost:5432/aefi?sslmode=disable` | Indexer + matcher |
| `NEO4J_URI` | `bolt://localhost:7687` | API + matcher |
| `NEO4J_USER` / `NEO4J_PASSWORD` | `neo4j` / `aefi-dev-password` | Matches compose |
| `AEFI_HTTP_PORT` | `8787` | API |
| `AEFI_API_KEY` | `dev-local-key` | Studio sends `x-aefi-api-key` |
| `AEFI_RULES_ENABLED` | `false` | Skip Drools `:8090` noise in demo |
| `AEFI_X402_ENABLED` | `false` | Open `/v1` without payment headers |

### `apps/studio/.env`

```bash
VITE_AEFI_API_URL=http://localhost:8787
VITE_AEFI_API_KEY=dev-local-key
```

Restart Vite after changing `VITE_*`. Restart the API after changing root `.env`.

## 3. Enrich identity + embeddings (optional)

After matcher has projected ERC-8004 registrations, backfill display names / skills from Postgres and (optionally) MiniLM embeddings for NL search:

```bash
pnpm --filter @aefi/matcher enrich:identity
pnpm --filter @aefi/api embed:providers
```

## 4. Start the API

```bash
pnpm --filter @aefi/api dev
# or: pnpm dev:api
```

Smoke:

```bash
curl -s http://localhost:8787/health | jq .
# expect neo4j: "ok" when the graph container is up

curl -s -X POST http://localhost:8787/v1/providers/search \
  -H 'content-type: application/json' \
  -H 'x-aefi-api-key: dev-local-key' \
  -d '{"query":"reliable on-chain price feeds for trading agents","minimum_verified_jobs":10}' | jq .summary
```

MCP stdio mode (separate process):

```bash
AEFI_MODE=mcp pnpm --filter @aefi/api start
```

## 5. Start Evidence Studio and www

```bash
# terminal — studio (demo.aefi.io locally)
pnpm --filter @aefi/studio dev
# → http://localhost:5173

# terminal — brand apex (aefi.io locally)
pnpm --filter @aefi/www dev
# → http://localhost:5174
```

Studio shows **API/graph offline** when `:8787` is down or `/health` reports Neo4j unavailable — start API + Neo4j, refresh.

### Cloud Run note (preview)

Production deploy lives in [`deploy/README.md`](deploy/README.md): Cloudflare Tunnel →
internal Cloud Run (`aefi-www` / `aefi-studio` / `aefi-api` + indexer/matcher workers),
Cloud SQL in `aefi-io`, Neo4j Aura. Point studio’s `VITE_AEFI_API_URL` at the API
origin at build time; CORS includes `demo.aefi.io` / `aefi.io` by default.

## 6. Optional: indexer → matcher → live Arc data

For Arc testnet evidence:

```bash
# Postgres must be up
cd services/indexer
export INDEXER_ABI_DIR=$PWD/abi/5042002
# optional: export INDEXER_START_BLOCK=...
go run ./cmd/indexer
```

Then project into Neo4j:

```bash
# Neo4j must be up; DATABASE_URL + NEO4J_* from .env
pnpm --filter @aefi/matcher dev
# optional: purge leftover demo nodes + backfill agentURI metadata
pnpm --filter @aefi/matcher enrich:identity
```

Indexer never writes Neo4j; matcher projects from Postgres only.

## 7. Optional: Drools rules service

Default local demo uses the API’s TS disposition composer (`AEFI_RULES_ENABLED=false`).

To exercise Drools:

```bash
# set in .env
# AEFI_RULES_ENABLED=true
# AEFI_RULES_URL=http://localhost:8090

cd services/rules
./mvnw spring-boot:run
# → http://localhost:8090/health
```

If rules is down while enabled, the API logs one warning and falls back to the local composer.

## Useful commands

```bash
pnpm install
pnpm typecheck
pnpm --filter @aefi/api test

pnpm dev:api
pnpm dev:studio
pnpm dev:www
pnpm dev:matcher

pnpm --filter @aefi/matcher enrich:identity
pnpm --filter @aefi/api embed:providers

pnpm build:studio
pnpm build:www

docker compose --profile graph ps
docker compose --profile graph restart
docker compose --profile graph down
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Studio: “API/graph offline” | Start `pnpm --filter @aefi/api dev`; ensure Neo4j profile is up; refresh |
| `curl :8787` connection refused | API not running |
| Provider search Neo4j errors | `docker compose --profile graph up -d neo4j`; wait until healthy; run matcher |
| `aefi-rules unavailable` spam | Set `AEFI_RULES_ENABLED=false` or start `services/rules` |
| Empty provider search | Run indexer + matcher until jobs project; then `enrich:identity` / `embed:providers` |
| Semantic recall / vector index errors | Re-run `embed:providers` after Neo4j is healthy |
| CORS in browser | Studio origin must be allowlisted; local Vite ports are built-in |
| Docker / WSL daemon errors | Docker Desktop → Settings → Resources → WSL integration |
| Postgres empty after `down -v` | Expected — re-run indexer migrations via fresh compose up |
| Go indexer build fails | Install Go 1.22+; set `INDEXER_ABI_DIR` to `services/indexer/abi/5042002` |

## Domains (local ↔ prod mapping)

| Host | Local | App |
| --- | --- | --- |
| `aefi.io` | `:5174` | `@aefi/www` |
| `demo.aefi.io` | `:5173` | `@aefi/studio` |
| API | `:8787` | `@aefi/api` |
| `hackathon.aefi.io` | — | CNAME → `demo.aefi.io` (optional) |
