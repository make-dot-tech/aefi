# aefi www (aefi.io)

**Status**: Draft
**Last updated**: 2026-08-08

Minimal brand apex for **aefi.io**. Product UI lives elsewhere; hackathon demo is `demo.aefi.io`.

## Run

```bash
pnpm --filter @aefi/www dev
# → http://localhost:5174
```

Brand assets: `public/brand/*` symlinks to repo [`assets/`](../../assets). Favicon uses `aefi-icon.png`; hero uses `aefi-logo.png`. Base background is `#0A0A0A` to match the marks.

## Deploy

| Host | App |
| --- | --- |
| `aefi.io` / `www.aefi.io` | this package (`dist/`) |
| `demo.aefi.io` | `@aefi/studio` |
| `hackathon.aefi.io` | CNAME → `demo.aefi.io` (optional) |
