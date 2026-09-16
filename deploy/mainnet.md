# Arc mainnet cutover playbook

**Status**: Draft
**Last updated**: 2026-09-15

How to start indexing Arc **mainnet** without wiping testnet, and how to point
studio/API at it. Do **not** treat this as “pause jobs, truncate both DBs, flip
the RPC.” That is the wrong model for this stack.

Related: [README.md](./README.md) (prod layout), stub
[`deploy-api-mainnet.sh`](./deploy-api-mainnet.sh).

## Current production (2026-09-15)

| Store | Contents |
| --- | --- |
| Cloud SQL `aefi-postgres` | Arc **testnet** events (`chain_id = 5042002`) |
| Neo4j Aura | Rebuilding **testnet** graph from that Postgres stream |
| Cloud Run `aefi-api` / `aefi-indexer` / `aefi-matcher` | `ARC_CHAIN_ID=5042002`, RPC `https://rpc.testnet.arc.io` |
| ABI pack | `services/indexer/abi/5042002/` only |

There is **no** mainnet ABI pack, chain id, or RPC in-repo yet. The regional
Cloud Build trigger on `main` still deploys the **testnet** stack
(`deploy/cloudbuild.yaml` substitution `_CHAIN_ID=5042002`).

## Rules

1. **Do not wipe Postgres or Neo4j** to “switch networks.” Rows, graph ids,
   indexer cursor, and matcher cursor are all `chain_id`-scoped.
2. **Do not** point the existing `aefi-indexer` at mainnet RPC while leaving
   `ARC_CHAIN_ID=5042002`. You would write mainnet logs into the testnet cursor.
3. **Do not** change `_CHAIN_ID` on the existing Cloud Build trigger until mainnet
   workers and ABI exist — that would redeploy testnet services as mainnet by
   accident.
4. Mainnet is a **second ingest plane**. Testnet can keep running, or scale to 0,
   without a truncate.

```
testnet indexer  --ARC_CHAIN_ID=5042002-->  evt_* (5042002)  --> matcher cursor neo4j:5042002
mainnet indexer  --ARC_CHAIN_ID=<mn>----->  evt_* (<mn>)     --> matcher cursor neo4j:<mn>
                         \                      /
                          \---- shared Postgres + Aura ----/
API / studio serve whichever ARC_CHAIN_ID they are configured with.
```

## Gate — wait for Arc to publish

Fill this table from official Arc mainnet docs (not guesswork):

| Item | Value | Notes |
| --- | --- | --- |
| Chain id | _TBD_ | EVM id, not “arc-mainnet” string |
| RPC | _TBD_ | Likely `https://rpc.arc.io` or similar — confirm |
| Explorer | `https://arcscan.app` (studio already falls back here) | Confirm |
| System USDC emitter | often `0xff…fe` | Confirm EIP-7708 emitter |
| Memo | _TBD_ | Testnet was `0x5294…e505` |
| ERC-8004 identity / reputation / validation | _TBD_ | Testnet `0x8004…` may or may not reuse |
| ERC-8183 | _TBD_ | Testnet `0x0747…4583` will likely change |
| Genesis / start block | `0` or first agent-commerce block | Set `INDEXER_START_BLOCK` if they say “start here” |

Until this table is real, **stop**. Shipping a guessed allowlist will index the
wrong contracts.

## Path A (preferred): dual workers, then flip the API

Keep testnet data. Add mainnet next to it. Point public API/studio at mainnet
when the graph has something useful.

### 1. ABI pack in git

```bash
cp -r services/indexer/abi/5042002 services/indexer/abi/<CHAIN_ID>
```

Edit `allowlist.json`:

- `chain_id`, `name` (`arc-mainnet`), `rpc_url_default`
- **every contract address** from the gate table
- ABI JSON files can stay if the event signatures did not change

Commit that pack. Dockerfile copies `services/indexer/abi` to `/abi`; mainnet
workers must set `INDEXER_ABI_DIR=/abi/<CHAIN_ID>` (image default is still
`/abi/5042002`).

Update [`docs/arc/learning/contract-addresses.md`](../docs/arc/learning/contract-addresses.md)
with a mainnet section when addresses are public.

### 2. Do **not** reuse testnet Cloud Run services

Create **new** services (same images the trigger already builds):

| Service | Env (delta vs testnet) |
| --- | --- |
| `aefi-indexer-mainnet` | `ARC_CHAIN_ID=<mn>`, `ARC_RPC_URL=<mainnet rpc>`, `INDEXER_ABI_DIR=/abi/<mn>`, same `DATABASE_URL` secret, `min-instances=1`, no CPU throttle, Cloud SQL + VPC as today |
| `aefi-matcher-mainnet` | `ARC_CHAIN_ID=<mn>`, same Postgres + `AEFI-NEO4J-*`, `min-instances=1` |
| `aefi-api` **or** `aefi-api-mainnet` | See step 4 |

Matcher cursor id is `neo4j:<ARC_CHAIN_ID>` — a new chain id starts at block 0
automatically (`ensureCursor` insert). **Never** reset `neo4j:5042002` as part
of mainnet cutover.

Indexer cursor is keyed by `chain_id` in `indexer_cursor` — same: new row, do
not wipe the testnet row.

### 3. Deploy mainnet workers (manual until a second trigger exists)

After a `main` image build (or the regional trigger) has pushed
`us-central1-docker.pkg.dev/aefi-io/aefi/indexer:latest` and `matcher:latest`:

```bash
REGION=us-central1
PROJECT=aefi-io
CHAIN=<CHAIN_ID>
RPC=<MAINNET_RPC>
IMG_I=us-central1-docker.pkg.dev/aefi-io/aefi/indexer:latest
IMG_M=us-central1-docker.pkg.dev/aefi-io/aefi/matcher:latest

gcloud run deploy aefi-indexer-mainnet \
  --project=$PROJECT --region=$REGION \
  --image=$IMG_I \
  --ingress=internal --no-allow-unauthenticated \
  --port=8080 --memory=512Mi --cpu=1 \
  --min-instances=1 --max-instances=1 --timeout=3600 --no-cpu-throttling \
  --vpc-connector=aefi-connector --vpc-egress=private-ranges-only \
  --add-cloudsql-instances=aefi-io:us-central1:aefi-postgres \
  --set-env-vars=ARC_CHAIN_ID=$CHAIN,ARC_RPC_URL=$RPC,INDEXER_ABI_DIR=/abi/$CHAIN,INDEXER_POLL_MS=2000,INDEXER_BATCH_SIZE=40 \
  --update-secrets=DATABASE_URL=AEFI-DATABASE-URL:latest

gcloud run deploy aefi-matcher-mainnet \
  --project=$PROJECT --region=$REGION \
  --image=$IMG_M \
  --ingress=internal --no-allow-unauthenticated \
  --port=8080 --memory=512Mi --cpu=1 \
  --min-instances=1 --max-instances=1 --timeout=3600 --no-cpu-throttling \
  --vpc-connector=aefi-connector --vpc-egress=private-ranges-only \
  --add-cloudsql-instances=aefi-io:us-central1:aefi-postgres \
  --set-env-vars=ARC_CHAIN_ID=$CHAIN,NODE_ENV=production,MATCHER_BATCH_SIZE=500,MATCHER_POLL_MS=250 \
  --update-secrets=DATABASE_URL=AEFI-DATABASE-URL:latest,NEO4J_URI=AEFI-NEO4J-URI:latest,NEO4J_USER=AEFI-NEO4J-USER:latest,NEO4J_PASSWORD=AEFI-NEO4J-PASSWORD:latest
```

Watch logs: indexer should advance `indexer_cursor` for `$CHAIN`; matcher should
`projected { advanced: true, cursor: { lastBlock: … } }` with
`neo4j:<CHAIN>` in Postgres.

Optional later: `deploy/cloudbuild-mainnet.yaml` + a second trigger so mainnet
workers update on every `main` push. Do not fold mainnet into the testnet
trigger’s `_CHAIN_ID` until you intend to **retire** testnet workers.

### 4. Point the public product at mainnet

Studio bakes `VITE_ARC_CHAIN_ID` at **image build**. API reads `ARC_CHAIN_ID`
at runtime.

**Smallest cutover (one public API):**

1. Confirm matcher has mainnet agents/jobs you care about.
2. `gcloud run services update aefi-api --update-env-vars=ARC_CHAIN_ID=<mn>`
   (region `us-central1`, project `aefi-io`).
3. Rebuild studio with `VITE_ARC_CHAIN_ID=<mn>` (next `main` push after
   `cloudbuild.yaml` `_CHAIN_ID` is updated **or** a one-off studio deploy
   with `--build-arg VITE_ARC_CHAIN_ID=<mn>`). Until studio is rebuilt,
   explorer links may still assume testnet id `5042002` for the default,
   but `arcscan.app` is already the fallback for unknown ids.
4. Scale testnet indexer/matcher to `min-instances=0` if you want to stop
   paying for testnet ingest. **Leave the data.**

**Safer cutover:** deploy `aefi-api-mainnet` with mainnet chain id, point a
host (`api.aefi.io` or `api-mainnet.aefi.io`) at it, keep `aefi-api` on
testnet until you are sure.

### 5. Embeddings

Semantic provider search stores vectors **in Neo4j**. After mainnet agents
exist:

```bash
# from a machine/job that can reach Aura + the API’s Neo4j secrets
pnpm --filter @aefi/api embed:providers
```

Needs `ARC_CHAIN_ID` set to mainnet in that process. Re-run when identity
enrichment lands.

### 6. Copy / docs

When the public API is on mainnet, update www chips (“Arc testnet” → mainnet)
and [`apps/www/docs/arc.html`](../apps/www/docs/arc.html). That is a product
commit, not a DB wipe.

## Path B: mainnet-only demo (still no wipe required)

If you do not want testnet in studio at all:

1. Still add a **new** ABI pack + **new** workers (Path A steps 1–3).
2. Flip API (+ studio build) to mainnet.
3. Scale testnet workers to 0.

Postgres/Neo4j testnet rows can remain unused. Truncate only if you need disk
back and you are sure you will never re-serve testnet.

## What “pause, wipe, flip RPC” would break

| Action | Result |
| --- | --- |
| Flip `ARC_RPC_URL` on `aefi-indexer` only | Mainnet logs decoded as chain `5042002` |
| Truncate `evt_*` | Lose testnet; matcher/API empty until full re-ingest |
| Reset `matcher_cursor` `neo4j:5042002` | Rebuilds testnet into Neo4j again, not mainnet |
| Wipe Aura | Drops both networks if you already dual-wrote |

## Verify

```bash
curl -sS https://api.aefi.io/health
# neo4j should be "ok"

curl -sS -X POST https://api.aefi.io/v1/providers/search \
  -H 'content-type: application/json' \
  -d '{"limit":5}'
```

Provider ids should look like `agent:wallet:<CHAIN_ID>:0x…` / `agent:erc8004:<CHAIN_ID>:…`.
Explain a **mainnet** tx on `GET /v1/transactions/0x…`.
Studio: `demo.aefi.io` live pill, search, explain, explorer host is arcscan (not testnet) once default chain id is mainnet.

## Rollback

Set `aefi-api` `ARC_CHAIN_ID=5042002` again (and studio `_CHAIN_ID` on next
build). Testnet workers still have their cursors if you did not wipe.

## Aura / cost

Mainnet ingest is extra write load on the same Aura instance. Watch storage
(8GB was the floor after testnet filled 2GB). Agent-only payment projection
still applies. Pause Aura only if **both** matchers are scaled to 0.
