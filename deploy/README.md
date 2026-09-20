# Production deployment

**Status**: Draft  
**Last updated**: 2026-09-20

Cloud Run services use **`--ingress=internal`**. Public traffic reaches them only
through a **Cloudflare Tunnel** on a GCE `cloudflared` VM.

GCP project: **`aefi-io`** (`us-central1`) — chosen to burn make.tech Cloud SQL +
Compute Flexible CUDs.

**Phase 1 target:** Arc **testnet** (`5042002`) only. Shared Neo4j Aura + Cloud SQL
are dual-network ready (graph IDs / matcher cursors include `chain_id`). Mainnet
workers are **not** created by the default trigger — follow
[`mainnet.md`](./mainnet.md).

## Architecture

```
Browser → Cloudflare (DNS + WAF + Tunnel)
            │
            ├─ aefi.io / www.aefi.io     → Cloud Run aefi-www
            ├─ demo.aefi.io              → Cloud Run aefi-studio
            └─ api.aefi.io               → Cloud Run aefi-api
                                              │
                                              ▼
                                         Neo4j Aura (paused 2026-09-16)
Indexer / matcher Cloud Run — deleted until mainnet 8004/8183
  └─ Cloud SQL aefi-postgres (us-central1)
       └─ also: Beekeeper via authorized network 108.65.165.248/32
```

| Service | Platform | Notes |
| --- | --- | --- |
| `aefi-www` | Cloud Run | Vite MPA (landing + docs) + nginx, internal ingress |
| `aefi-studio` | Cloud Run | Vite static + nginx, baked `VITE_AEFI_API_URL` |
| `aefi-api` | Cloud Run | Hono API, internal ingress |
| `aefi-indexer` / `aefi-matcher` | — | Deleted 2026-09-16 (cost pause). Recreate as `*-mainnet` — [`mainnet.md`](./mainnet.md) |
| `aefi-rules` | Cloud Run | Drools disposition (`min=1`), internal only |
| `aefi-migrate` | Cloud Run Job | Applies `services/indexer/migrations` |
| `cloudflared-tunnel` | GCE e2-micro | Tunnel connector (provision separately) |

**Critical:** each tunnel route must set **HTTP Host Header** to the Cloud Run
`*.run.app` hostname. Without it, internal ingress returns 404.

Also grant **`roles/run.invoker` to `allUsers`** on www/studio/api. With org
policies, `--allow-unauthenticated` on deploy can leave an empty IAM policy and
Cloud Run returns **403**; the tunnel Host header alone is not enough.

| Public hostname | Origin service | Host header override |
| --- | --- | --- |
| `aefi.io` | `aefi-www` | `aefi-www-sddurzmdea-uc.a.run.app` |
| `www.aefi.io` | `aefi-www` | `aefi-www-sddurzmdea-uc.a.run.app` |
| `demo.aefi.io` | `aefi-studio` | `aefi-studio-sddurzmdea-uc.a.run.app` |
| `api.aefi.io` | `aefi-api` | `aefi-api-sddurzmdea-uc.a.run.app` |

(Confirm current hostnames with `gcloud run services list --project=aefi-io --region=us-central1`.)

Tunnel: Cloudflare tunnel **`aefi`** (`65012ece-b76e-49b3-8213-ca1d8f294147`),
connector VM `cloudflared-tunnel` (`us-central1-a`, **no external IP** — SSH via
IAP; outbound via Cloud NAT `aefi-nat`). Create/recreate VM via
[`deploy/create-tunnel-vm.sh`](./create-tunnel-vm.sh).

```bash
gcloud compute ssh cloudflared-tunnel --zone=us-central1-a --project=aefi-io --tunnel-through-iap
```

## Cloudflare WAF (`aefi.io` zone)

### Custom rule — Block sanctioned countries

- **Name:** `Block sanctioned countries`
- **Expression:** `(ip.geoip.country in {"KP" "IR" "CU" "SY" "RU" "MM"})`
- **Action:** Block

### Rate limiting — API

- Match host `api.aefi.io`, path starts with `/v1/`
- Threshold: **30 requests / 10 seconds** (tune as needed)

## Cloud SQL + Beekeeper

Instance: `aefi-postgres` in `us-central1` (public IP, **not** open to the world).

Authorized network (phase 1):

| Name | CIDR |
| --- | --- |
| beekeeper-home | `108.65.165.248/32` |

Connect from Beekeeper:

1. Host = `35.193.238.76` (Cloud SQL public IP; confirm with `gcloud sql instances describe aefi-postgres --format='value(ipAddresses[0].ipAddress)'`)
2. Port `5432`, DB `aefi`, user `aefi`
3. Prefer SSL mode **require** (instance currently allows unencrypted; tighten later)
4. Password: same as `aefi` SQL user (in ops secret store / `AEFI-DATABASE-URL` — do not commit)

If your home IP changes, update authorized networks:

```bash
gcloud sql instances patch aefi-postgres \
  --project=aefi-io \
  --authorized-networks=NEW_IP/32 \
  --quiet
```

Never authorize `0.0.0.0/0`.

Cloud Run workers use the Cloud SQL Auth proxy socket via `--add-cloudsql-instances`
and VPC connector `aefi-connector` (private ranges only).

## Shared Neo4j Aura

Aura credentials live in Secret Manager (`AEFI-NEO4J-*`). Isolation is by
`chain_id` on nodes + `ARC_CHAIN_ID` on API/matcher. Do not wipe the instance to
cut over — see [`mainnet.md`](./mainnet.md).

## Dual network

See **[`mainnet.md`](./mainnet.md)** for the cutover playbook. Short version:
new ABI pack + **new** indexer/matcher services; shared Postgres/Aura; flip
`ARC_CHAIN_ID` on the API when the mainnet graph is ready. Do not truncate DBs.

| Dimension | Testnet (phase 1) | Mainnet |
| --- | --- | --- |
| Cloud Run API | `aefi-api` | flip `ARC_CHAIN_ID` **or** `aefi-api-mainnet` |
| Workers | deleted (testnet) | `aefi-indexer-mainnet` / `aefi-matcher-mainnet` |
| `ARC_CHAIN_ID` | `5042002` | published mainnet id |
| Matcher cursor | `neo4j:5042002` | `neo4j:<mainnet>` |
| ABI dir | `/abi/5042002` | `/abi/<mainnet>` |
| Postgres / Aura | shared | shared |

## Deploy

Push to **`main`** triggers Cloud Build (`deploy-aefi` → `deploy/cloudbuild.yaml`).

Manual:

```bash
gcloud builds submit --project=aefi-io --config=deploy/cloudbuild.yaml .
```

Rules-only (faster):

```bash
gcloud builds submit --project=aefi-io --config=deploy/cloudbuild-rules.yaml .
```

Schema migrate runs automatically on each full Cloud Build deploy (`aefi-migrate` job).
Secrets required before first deploy:

| Secret | Purpose |
| --- | --- |
| `AEFI-DATABASE-URL` | Postgres URL (Cloud SQL socket or TCP) |
| `AEFI-NEO4J-URI` | Aura URI (`neo4j+s://…`) |
| `AEFI-NEO4J-USER` | Aura username |
| `AEFI-NEO4J-PASSWORD` | Aura password |
| `AEFI-API-KEY` | Studio / MCP API key (also baked into the studio image at build) |

x402 seller `payTo` is public (it appears in every 402 `accepts[]`), so it is a Cloud Run env var, not a secret:

`0xaEF1f897140C9a01a291d9e09865B519c997691B`

Keep the **private key** only in the wallet that controls that address. Cloud Build still needs Secret Manager access to bake `AEFI-API-KEY` into studio:

```bash
PROJECT_NUMBER="$(gcloud projects describe aefi-io --format='value(projectNumber)')"
gcloud secrets add-iam-policy-binding AEFI-API-KEY --project=aefi-io \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

## Cloudflare Tunnel VM (checklist)

1. VM already created: `cloudflared-tunnel` in `us-central1-a` (or run [`create-tunnel-vm.sh`](./create-tunnel-vm.sh))
2. SSH: `gcloud compute ssh cloudflared-tunnel --zone=us-central1-a --project=aefi-io`
3. Install `cloudflared`, authenticate to the `aefi.io` Cloudflare account
4. Route hostnames above with Host header overrides to the `*.run.app` values
5. Confirm Cloud Run remains `--ingress=internal` (direct `.run.app` access returns 404 from the public internet)
