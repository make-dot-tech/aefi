# aefi Agent Notes

**Status**: Draft
**Last updated**: 2026-08-08

Project conventions for agents working in this repo.

## Brand

- Product name is **aefi** — always lowercase (`aefi.io`, "aefi API", "built by aefi")
- Never write `Aefi` or `AEFI` in brand/prose contexts
- Enforced by Cursor rule: `.cursor/rules/brand-aefi-lowercase.mdc`

## Documentation

- Project Markdown docs must include **Status** and **Last updated** directly under the H1
- Allowed statuses: `Draft`, `Active`, or `Deprecated`
- Date format: `YYYY-MM-DD`
- **Exceptions** (no status headers): root `README.md`, `run_locally.md` — see ignore list in `.cursor/rules/markdown-doc-headers.mdc`
- Enforced by Cursor rule: `.cursor/rules/markdown-doc-headers.mdc`
- Local setup: [`run_locally.md`](run_locally.md)

## Product context

- aefi is the evidence and financial-intelligence layer for agent commerce
- Spec: `docs/ideation/spec/v1.md`
- Arc learning notes: `docs/arc/learning/`

## Monorepo map

| Path | Role |
| --- | --- |
| `apps/www` | Brand apex for aefi.io (coming soon) |
| `apps/studio` | Hackathon Evidence Studio for demo.aefi.io |
| `services/indexer` | Go — Arc allowlist ingest → Postgres |
| `services/matcher` | TS — event correlators → Neo4j projection |
| `services/rules` | Drools disposition (stub until #5) |
| `services/api` | TS — HTTP + MCP; TS confidence composer until Drools |
| `packages/contracts` | OpenAPI, JSON Schema, graph model, enums |

Hard rule: indexer writes **Postgres only**; matcher projects **Neo4j**; API serves graph + raw events.
