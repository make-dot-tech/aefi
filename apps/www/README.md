# aefi www (aefi.io)

**Status**: Active
**Last updated**: 2026-09-15

Brand apex for **aefi.io**: landing, product docs, legal. Evidence Studio stays on `demo.aefi.io`.

## Run

```bash
pnpm --filter @aefi/www dev
# → http://localhost:5174
```

Brand assets: `public/brand/*` symlinks to repo [`assets/`](../../assets). Favicon uses `aefi-icon.png`; wordmark uses `aefi-logo.png`. Base background is `#0A0A0A`.

## Pages

| Path | Content |
| --- | --- |
| `/` | Landing |
| `/docs/` | Docs hub |
| `/docs/*.html` | Quickstart, product, evidence, API, MCP, studio, Arc, architecture, limits |
| `/legal/` | Privacy, terms |
| `/404.html` | Missing path |

Shared chrome is injected at build via `src/chrome.ts`.

## Deploy

| Host | App |
| --- | --- |
| `aefi.io` / `www.aefi.io` | this package (`dist/`) via `deploy/Dockerfile.www` |
| `demo.aefi.io` | `@aefi/studio` |
