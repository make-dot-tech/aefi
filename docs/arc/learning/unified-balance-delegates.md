# Unified Balance Delegates

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Manage delegates](https://docs.arc.io/app-kit/tutorials/unified-balance/manage-delegates), [Delegate deposit and spend](https://docs.arc.io/app-kit/quickstarts/unified-balance-delegate-deposit-and-spend)

## What a delegate is

An address authorized to spend from an owner's Unified Balance on a **specific blockchain**. Typical pattern: backend service signs spends for a user who keeps custody.

```text
Owner (custody of Unified Balance)
  → addDelegate(delegate) on source chain
Delegate (signs spends)
  → spend(..., sourceAccount: owner, allocations: [{ chain, amount }])
  → funds arrive on destination (e.g. Arc) via Gateway / Forwarding Service
```

## API surface

| Call | Who signs | Meaning |
| --- | --- | --- |
| `getDelegateStatus` | read | `'none' \| 'pending' \| 'ready'` |
| `addDelegate` | owner | Authorize delegate on one chain |
| `removeDelegate` | owner | Revoke on one chain |
| `depositFor` | any funder | Permissionless deposit into owner's balance |
| `spend` with `sourceAccount` | delegate | Draw from owner's Unified Balance |

## Rules that matter for aefi

1. **Chain-specific** — authorizing on Base does not authorize on Arc/Ethereum/etc. Mandate assessment must be per-source-chain.
2. **Status lifecycle** — `none` → `pending` → `ready`. Confirmation can take up to ~15 minutes on Ethereum/Base/Arbitrum; near-instant on Arc/Avalanche.
3. **Owner keeps custody** — delegate signs spend intents; not a full wallet transfer of ownership.
4. **`depositFor` ≠ authority** — funding someone's balance does not grant spend rights.
5. **Fees reduce received amount** — provider / gas / forwarder fees deducted; Explained payment amount ≠ requested spend amount.
6. **Forwarder path** — destination may mint via Forwarding Service; result may include `transferId` instead of a locally submitted destination tx hash.

## Mapping to aefi delegated mandate

| Unified Balance concept | aefi object / field |
| --- | --- |
| Owner address | `principal` / wallet owner |
| Delegate address | `agent` acting wallet / delegated signer |
| `addDelegate` on chain X | mandate grant (source-scoped) |
| `removeDelegate` | mandate revocation / expiry signal |
| `getDelegateStatus == ready` | `mandate_active` check input |
| `spend` with `sourceAccount` | action under mandate |
| Gateway mint on Arc | settlement evidence (`gateway_transfer_linked`) |

This is closer to v1's delegated mandate than ERC-8004 identity alone. It is still **not** task-scoped capability authority.

## Confidence / evidence notes

- Onchain `addDelegate` / `removeDelegate` txs are strong mandate evidence when indexed
- App Kit SDK events are useful but secondary to onchain Gateway/CCTP settlement
- If only the Arc mint is observed without delegate grant evidence → lower confidence / coverage gap
- Distinguish roles in Explain Transaction: owner, delegate signer, recipient, forwarder/minter

## Open questions

1. Exact onchain events/addresses for `addDelegate` / `removeDelegate` per source chain
2. How to bind a UB spend to an ERC-8183 `jobId` (Memo on Arc mint? `transferId` metadata?)
3. Whether Circle exposes historical delegate grant logs suitable for backfill
