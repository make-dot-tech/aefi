# aefi Agent Notes

**Status**: Draft
**Last updated**: 2026-08-08

Project conventions for agents working in this repo.

## Brand

- Product name is **aefi** — always lowercase (`aefi.io`, "aefi API", "built by aefi")
- Never write `Aefi` or `AEFI` in brand/prose contexts
- Enforced by Cursor rule: `.cursor/rules/brand-aefi-lowercase.mdc`

## Documentation

- All project `.md` files must include **Status** and **Last updated** directly under the H1
- Allowed statuses: `Draft`, `Active`, `Deprecated`
- Date format: `YYYY-MM-DD`
- Enforced by Cursor rule: `.cursor/rules/markdown-doc-headers.mdc`

## Product context

- aefi is the evidence and financial-intelligence layer for agent commerce
- Spec: `docs/ideation/spec/v1.md`
- Arc learning notes: `docs/arc/learning/`

## Monorepo map

| Path | Role |
| --- | --- |
| `services/indexer` | Go — Arc allowlist ingest → Postgres |
| `services/matcher` | TS — event correlators → Neo4j projection |
| `services/rules` | Drools disposition (stub until #5) |
| `services/api` | TS — HTTP + MCP; TS confidence composer until Drools |
| `packages/contracts` | OpenAPI, JSON Schema, graph model, enums |

Hard rule: indexer writes **Postgres only**; matcher projects **Neo4j**; API serves graph + raw events.
