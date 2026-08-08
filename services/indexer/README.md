# aefi indexer (Go)

**Status**: Draft
**Last updated**: 2026-08-08

Arc P0 event ingest → Postgres. Does **not** write Neo4j.

## P0 contracts (allowlist)

| Family | Address | Typed table |
| --- | --- | --- |
| System USDC `Transfer` | `0xff…fe` | `evt_transfer` (18 decimals) |
| Memo / BeforeMemo | `0x5294…e505` | `evt_memo` (Memo); BeforeMemo → `evt_base` |
| ERC-8004 identity/reputation/validation | `0x8004…` | `evt_erc8004` |
| ERC-8183 AgenticCommerce | `0x0747…4583` | `evt_erc8183` |

## Layout

```text
cmd/indexer/     live poll loop
cmd/backfill/    range replay
pkg/rpc|abi|decode|store|indexer|models|config
abi/5042002/     allowlist + ABIs
migrations/      Postgres DDL
```

## Run

```bash
# from repo root
docker compose up -d postgres
# apply 002 if DB already existed from scaffold:
docker compose exec -T postgres psql -U aefi -d aefi < services/indexer/migrations/002_indexes.sql

cd services/indexer
export INDEXER_ABI_DIR=$PWD/abi/5042002
# optional: INDEXER_START_BLOCK=<n>  (default: tip on first run)
go run ./cmd/indexer
```

Backfill a range:

```bash
go run ./cmd/backfill -from 55963690 -to 55963695
```

## Tests

```bash
go test ./pkg/decode/ ./pkg/abi/ ...
```

## Notes

- Allowlist-driven `eth_getLogs` only (no full-chain scrape)
- Cursor advanced in the same transaction as event upserts
- Same-tx Memo↔Transfer correlation lands in matcher (#3)
