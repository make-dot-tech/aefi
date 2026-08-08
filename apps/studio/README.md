# aefi Evidence Studio (demo.aefi.io)

**Status**: Draft
**Last updated**: 2026-08-08

Hackathon / showcase UI for explaining Arc settlements. **Not** the durable product webapp — that may look different. Brand apex is `aefi.io` (`@aefi/www`).

## Run

```bash
# optional: API + Neo4j for live mode
docker compose --profile graph up -d neo4j
pnpm --filter @aefi/api dev

cp apps/studio/.env.example apps/studio/.env   # if needed
pnpm --filter @aefi/studio dev
# → http://localhost:5173
```

Without the API, curated fixtures still power Explain / Verify for the three demo hashes.

Brand assets: `public/brand/*` symlinks to repo `assets/`. Favicon/topbar use the icon; hero uses the wordmark. Base background is `#0A0A0A`.

## Deploy

| Host | App |
| --- | --- |
| `demo.aefi.io` | this package (`dist/`) |
| `hackathon.aefi.io` | CNAME → `demo.aefi.io` (optional) |
| `aefi.io` | `@aefi/www` |

Set `VITE_AEFI_API_URL` to the public API origin at build time. CORS allowlist on the API includes `https://demo.aefi.io`.

## Live vs fixture

- **Fixture** (default when Neo4j is down): demo `0xdemo…001/002/003` envelopes
- **Live**: toggle when `/health` reports `neo4j: ok`; real indexed txs work if present in the graph
