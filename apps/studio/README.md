# aefi Evidence Studio (demo.aefi.io)

**Status**: Draft
**Last updated**: 2026-08-08

Hackathon / showcase UI for **provider counterparty intelligence** (flagship) plus settlement explain/verify. **Not** the durable product webapp — that may look different. Brand apex is `aefi.io` (`@aefi/www`).

Brand assets: `public/brand/*` symlinks to repo `assets/`. Favicon/topbar use the icon; hero uses the wordmark. Base background is `#0A0A0A`.

## Run

```bash
# recommended: Neo4j + seeded providers for live mode
docker compose --profile graph up -d neo4j
pnpm --filter @aefi/api seed:demo
pnpm --filter @aefi/api dev

cp apps/studio/.env.example apps/studio/.env   # if needed
pnpm --filter @aefi/studio dev
# → http://localhost:5173
```

Without the API, curated **provider search fixtures** (including NL intent heuristics) still power the flagship demo.

## Deploy

| Host | App |
| --- | --- |
| `demo.aefi.io` | this package (`dist/`) |
| `hackathon.aefi.io` | CNAME → `demo.aefi.io` (optional) |
| `aefi.io` | `@aefi/www` |

Set `VITE_AEFI_API_URL` to the public API origin at build time. CORS allowlist on the API includes `https://demo.aefi.io`.

## Live vs fixture

- **Fixture**: NovaFeed / PulseOracle / CheapTicks / HelixResearch with semantic intent heuristics
- **Live**: `seed:demo` embeds MiniLM vectors into Neo4j; search uses `query` → vector recall → graph re-rank
