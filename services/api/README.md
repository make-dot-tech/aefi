# aefi API (TypeScript)

**Status**: Draft
**Last updated**: 2026-08-08

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
| `check_authority` / `trace_task` / `search_providers` | B/C | Honest gap envelopes |

x402 gate (`AEFI_X402_ENABLED`):

- **off** (default): open local/dev access  
- **on**: agents must send `PAYMENT-SIGNATURE` (x402 v2); missing → `402` + `PAYMENT-REQUIRED`  
- Human/dev bypass: `x-aefi-api-key: $AEFI_API_KEY`  
- Verify via facilitator (`AEFI_X402_FACILITATOR_URL`) or `AEFI_X402_DEV_ACCEPT=true` structural accept  
- Success responses include `PAYMENT-RESPONSE`

Disposition: API posts FactPayload to `AEFI_RULES_URL` (`services/rules`); falls back to local TS composer if the rules service is down.
