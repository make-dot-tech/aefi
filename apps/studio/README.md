# aefi Evidence Studio (demo.aefi.io)

**Status**: Draft
**Last updated**: 2026-08-08

Showcase UI for **provider counterparty intelligence** plus settlement explain/verify against the **live** Arc evidence graph. Brand apex is `aefi.io` (`@aefi/www`).

Brand assets: `public/brand/*` symlinks to repo `assets/`. Favicon/topbar use the icon; hero uses the wordmark. Base background is `#0A0A0A`.

## Run

```bash
# Requires API + Neo4j with matcher-projected agents/jobs
docker compose --profile graph up -d neo4j
pnpm --filter @aefi/matcher project:once   # or run matcher continuously
pnpm --filter @aefi/api embed:providers    # optional semantic recall
pnpm --filter @aefi/api dev

cp apps/studio/.env.example apps/studio/.env   # if needed
pnpm --filter @aefi/studio dev
# → http://localhost:5173
```

Studio is live-only: no client fixtures or demo seed. If the API/graph is down, search is disabled.

## Deploy

| Host | App |
| --- | --- |
| `demo.aefi.io` | this package (`dist/`) |
| `hackathon.aefi.io` | CNAME → `demo.aefi.io` (optional) |
| `aefi.io` | `@aefi/www` |

Set `VITE_AEFI_API_URL` to the public API origin at build time. CORS allowlist on the API includes `https://demo.aefi.io`.

## Data path

Indexer → Postgres → matcher → Neo4j → `POST /v1/providers/search` (optional MiniLM vector recall + graph re-rank).
