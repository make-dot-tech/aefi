# aefi API (TypeScript)

**Status**: Draft
**Last updated**: 2026-09-20

HTTP `/v1` + MCP server `aefi`. Wave A handlers read the Neo4j evidence graph.

## Run

```bash
# Neo4j must be up (and matcher projected)
docker compose --profile graph up -d neo4j
pnpm --filter @aefi/api dev
# → http://localhost:8787/health
```

```bash
curl -s -X POST localhost:8787/v1/payments/verify \
  -H 'content-type: application/json' \
  -d '{"tx_hash":"<tx>"}' | jq .
```

MCP stdio mode:

```bash
AEFI_MODE=mcp pnpm --filter @aefi/api start
```

## Tools

| Tool | Wave | Behavior |
| --- | --- | --- |
| `verify_payment` | A | Graph-backed settlement verify + coverage gaps |
| `explain_transaction` | A | Steps from transfers/payments/memos/jobs |
| `lookup_job` | A | ERC-8183 job + parties/outcomes/payments |
| `get_agent_activity` | A | Partial: wallet payments + agent evidence/jobs |
| `search_providers` | A | Graph-backed provider performance search + ranking |
| `check_authority` / `trace_task` | B/C | Honest gap envelopes |

Also:

- `GET /v1/scenarios` — curated NL search presets for Evidence Studio  
- `GET /v1/providers/:id` — single provider performance envelope  

```bash
# Re-embed agent capability text for semantic recall (after matcher enrichment):
pnpm --filter @aefi/api embed:providers
```

`search_providers` accepts optional `query` (natural-language semantic recall) fused with graph performance scores. Provider rows resolve ERC-8004 identity onto job providers via shared wallets.

x402 gate (`AEFI_X402_ENABLED`, Circle Gateway via `@circle-fin/x402-batching`):

- **off** (default locally): open `/v1` without payment headers
- **on** (requires a real `AEFI_X402_PAY_TO` wallet): unpaid paid-routes return **HTTP 402** with x402 `accepts[]` (all Gateway networks), `PAYMENT-REQUIRED`, and MPP `WWW-Authenticate: Payment`
- Machine discovery: `GET /openapi.json` (OpenAPI 3.1, always free)
- Human/studio bypass: `x-aefi-api-key: $AEFI_API_KEY`
- Settlement: `createGatewayMiddleware({ sellerAddress }).require("$0.01")` → Gateway `settle()`
- Success responses include `PAYMENT-RESPONSE`

Local unpaid challenge (needs a real `AEFI_X402_PAY_TO` and network to Circle Gateway):

```bash
AEFI_X402_ENABLED=true AEFI_X402_PAY_TO=0xaEF1f897140C9a01a291d9e09865B519c997691B \
  pnpm --filter @aefi/api test
curl -sI http://localhost:8787/openapi.json | head
curl -sI -X POST http://localhost:8787/v1/payments/verify -H 'content-type: application/json' -d '{}'
# 402 + PAYMENT-REQUIRED + WWW-Authenticate: Payment
```

Disposition: API posts FactPayload to `AEFI_RULES_URL` (`services/rules`); falls back to local TS composer if the rules service is down. For local use without Drools, set `AEFI_RULES_ENABLED=false` so the API does not attempt `:8090`.

## CORS

CORS allowlist includes local Vite ports, `https://demo.aefi.io`, `https://hackathon.aefi.io`, `https://aefi.io` (extend with `AEFI_CORS_ORIGINS`).
