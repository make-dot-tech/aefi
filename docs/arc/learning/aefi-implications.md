# Aefi Implications from Arc

**Status**: Draft
**Last updated**: 2026-08-06

Synthesis of Arc learnings against [Aefi product spec v1](../../ideation/spec/v1.md).

Related learning notes: [contract-addresses](./contract-addresses.md), [stablecoins-and-finality](./stablecoins-and-finality.md), [unified-balance-delegates](./unified-balance-delegates.md), [connect-gas-privacy](./connect-gas-privacy.md), [consensus-and-fees](./consensus-and-fees.md), [arc-system-architecture](./arc-system-architecture.md), [erc-8004](./erc-8004.md), [erc-8183](./erc-8183.md), [gateway-and-x402](./gateway-and-x402.md), [gateway-protocol](./gateway-protocol.md), [gateway-events](./gateway-events.md), [x402-eip3009-evidence](./x402-eip3009-evidence.md), [cloudflare-authority](./cloudflare-authority.md).

## Mental model

```text
Principal / agent wallets (EOA, AA, Circle Wallets, Unified Balance delegates)
  → payment rails:
      App Kits / ERC-8183 escrow / x402 (exact or Gateway-batched) / raw transfers
  → Arc settlement (EIP-7708 Transfer + optional Memo) and/or Gateway mint
  → ERC-8004 identity / reputation / validation
Aefi correlates those records into financial intelligence
```

Arc creates identities, jobs, payments, and settlement. Aefi indexes, connects, explains, and assesses — it does not become a registry, wallet, escrow, or runtime.

## What Arc / Circle give Aefi (Phase 1+)

| Primitive | Aefi use | Confidence hooks |
| --- | --- | --- |
| System USDC `Transfer` | Payment settlement truth | payment settled |
| Memo + `memoId` / payload | Job/task/payment correlation | `exact_job_id_memo` |
| ERC-8183 lifecycle events | Commerce job + escrow + outcome | `erc_8183_job_lifecycle`, `escrow_release_after_acceptance` |
| ERC-8004 identity + `NewFeedback` | Agent identity + performance | `erc_8004_identity_match`, `erc_8004_reputation_event` |
| Feedback `proofOfPayment` | Reputation ↔ payment join | payment reference |
| CCTP burn/mint | Cross-chain lineage | `cctp_origin_matched` |
| Gateway / UB mint + delegates | Balance abstraction + mandate-shaped grants | `gateway_transfer_linked` |
| x402 auth + batch settle | Per-request commerce (often offchain auth) | `x402_payment_reference` |
| Deterministic PoA finality | Fast “verified settled” | — |

## What is still missing

| Gap | Spec need | Implication |
| --- | --- | --- |
| Task credentials / capability ceiling | Task execution authority | External adapters (e.g. Cloudflare) — expect `authorization_evidence_missing` often |
| Full mandate schema | Delegated mandate | Closest: UB `addDelegate`, AA session keys, Circle policies |
| Memo for AA wallets | Structured payment memos | EOA-only Memo |
| 1:1 onchain log per nanopayment | Verify Payment | Batched Gateway settlement needs offchain receipts |
| Single-tx atomicity for App Kits | Explain Transaction | Multi-leg flows need workflow IDs |

## Mandate-shaped surfaces (ranked)

1. **Unified Balance `addDelegate` / `removeDelegate`** — clearest owner→delegate spend authority (per source chain)
2. **ERC-8183 escrow fund/complete** — economic job authority + outcome
3. **AA session keys / Circle wallet policies** — provider-specific adapters
4. **Cloudflare Virtual Wallets / Agent Access** — Phase 2; best for task capability ceiling

## Indexer rules Aefi must enforce

1. Prefer system emitter Transfer (`0xff…fe`, 18 decimals) as settlement amount
2. Never double-count ERC-20 USDC Transfer (`0x3600…0000`, 6 decimals)
3. Order by `(blockNumber, logIndex)`; ignore timestamp uniqueness
4. No reorg rollback path on Arc (PoA BFT commit)
5. Join Memo ↔ Transfer primarily by `transactionHash`
6. Attribute Memo / Multicall3From activity to original sender
7. Derive gas separately from receipt; fees are not Transfer events
8. Index ERC-8183 canonical events (`JobCreated`…`JobExpired`), not only `getJob` polls
9. Treat x402 nanopayment batches as aggregate settlement unless per-auth refs exist
10. Join Gateway mint↔burn via `keccak256(TransferSpec)` when present
11. Treat Gateway delegates as high-privilege, chain-scoped mandate grants; signed intents survive revoke until expiry
12. Ingest Cloudflare (or similar) task credentials / activity logs before claiming task-level authorization

## MVP surface fit

Strongest today:

1. **Verify Payment** — Transfer + Memo + ERC-8183 fund/complete
2. **Explain Transaction** — parties/amount + memo/job linkage
3. **Job Lookup** — ERC-8183 events + related payments
4. **Provider Search** — ERC-8183 completions + ERC-8004 feedback (filtered clients)

Weaker until adapters + receipt schemas land:

- **Authority Check** / **Task Trace**
- Per-request nanopayment verification without facilitator receipts

## SDK priorities (Arc-shaped)

- Versioned Memo payload (`job_id`, `task_execution_id`, agent/principal refs)
- Indexed `memoId` scheme
- Route EOA payments through Memo when possible; AA fallback path documented
- Deliverable hashing compatible with ERC-8183 `submit`
- Emit/attach x402 payment references and Gateway `transferId`s into evidence
- Describe UB delegate grants as mandate-shaped evidence

## Open questions

1. Exact Memo payload convention for Aefi
2. Arc AgenticCommerce ABI drift vs EIP-8183 (`fund` args)
3. Gateway mint event schemas + forwarder `transferId` linkage on Arc
4. Whether nanopayment batch settlement exposes per-authorization index keys
5. Onchain event schema for UB `addDelegate` / `removeDelegate`
6. Facilitator trust window (serve now, settle later) for confidence labels
7. APS privacy impact when it ships

## Suggested next absorption (optional / deeper)

- Circle Agent Stack wallet APIs (if distinct receipt fields beyond x402 settle)
- Facilitator integration how-to end-to-end sample payloads
- Full Cloudflare AAM when wire-level APIs ship
- Arc [running a node](https://docs.arc.io/arc/concepts/running-a-node) if self-hosted indexing becomes a requirement
- Map learning notes → concrete Phase 1 indexer ticket list / schema DRAFT
