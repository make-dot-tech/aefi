# aefi matcher

**Status**: Draft
**Last updated**: 2026-08-08

Projects Postgres canonical events into the Neo4j evidence graph.

## Correlators (#3)

| Name | Effect |
| --- | --- |
| `transfers_payments` | System USDC → `Payment`/`TransferEvent`/`Wallet` + `SETTLED_BY` |
| `memo_transfer_same_tx` | Same `tx_hash` Memo → `ANNOTATED_BY` (+ `FOR_JOB` if job id in memo) |
| `erc8183_job_lifecycle` | Job nodes, party agents, outcomes |
| `erc8004_identity` | Agent nodes + reputation/identity evidence |

## Run

```bash
# from repo root
docker compose --profile graph up -d neo4j
docker compose exec -T postgres psql -U aefi -d aefi < services/indexer/migrations/003_matcher_cursor.sql

pnpm --filter @aefi/matcher test
pnpm --filter @aefi/matcher project:once   # one batch
pnpm --filter @aefi/matcher dev           # poll loop
```

Browser: [http://localhost:7474](http://localhost:7474) — user `neo4j` / password `aefi-dev-password`.

## Watermark

`matcher_cursor` in Postgres tracks `(last_block, last_log_index)` over unified `evt_base` order so families cannot skip ahead of each other.
