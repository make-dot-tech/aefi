# Gateway, Nanopayments, and x402

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Circle Gateway](https://developers.circle.com/gateway), [Agent nanopayments](https://developers.circle.com/agent-stack/agent-nanopayments), Arc App Kits / UB notes. (Some nanopayment concept pages timed out during fetch — filled from Circle overview + search snippets; revisit for event-level detail.)

## Circle Gateway

Unified USDC balance across chains:

```text
Deposit USDC → GatewayWallet (source chain, non-custodial)
  → mint instantly (<500 ms) on destination via API / GatewayMinter
```

| vs CCTP | Gateway |
| --- | --- |
| Point-to-point transfer | Unified balance spendable anywhere |
| Seconds–minutes | Instant after balance established |
| Domain messaging | Balance abstraction + mint |

Arc testnet addresses (domain 26): see [contract-addresses.md](./contract-addresses.md) — `GatewayWallet`, `GatewayMinter`.

Also: ERC-1271 programmable authorization (SCA can authorize without separate EOA delegate); 7-day trustless withdrawal.

App Kits Unified Balance is the DX layer over Gateway (+ CCTP where needed).

## Nanopayments + x402

**Problem:** per-request agent API payments at sub-cent scale are uneconomical if each payment is its own onchain tx.

**Pattern:**

```text
1. Buyer requests paid resource
2. Seller returns HTTP 402 Payment Required + payment details
3. Buyer signs EIP-3009 payment authorization (offchain, zero gas)
4. Buyer retries with signed authorization
5. Seller verifies + serves immediately
6. Gateway batches many authorizations → single onchain settlement (net positions)
```

Agent Nanopayments = this flow for AI agents (Circle CLI / SDKs, Agent Marketplace discovery). Balance can live on any Gateway-supported chain.

Additive to “exact” onchain x402: sellers can offer both standard onchain and `GatewayWalletBatched` options; clients/facilitators route by scheme name.

## Aefi implications (important)

| Payment path | What Aefi sees on Arc | Confidence notes |
| --- | --- | --- |
| Direct Arc Transfer (+ Memo) | Per-payment Transfer (+ Memo) | High joinability via memo/job id |
| ERC-8183 escrow | Fund/complete events | Strong job linkage |
| CCTP bridge | DepositForBurn / MessageReceived | Cross-chain lineage |
| Gateway UB spend | Destination mint (+ fees); may use `transferId` / forwarder | Need Gateway event correlation |
| x402 nanopayment batch | **Batched** settlement — many logical payments → one (or few) onchain txs | Per-request payment is offchain auth; onchain evidence is aggregate unless batch receipts expose per-payment refs |

For nanopayments, “Verify Payment” for a single API call likely needs:

- Offchain x402 receipt / authorization payload
- Facilitator / Gateway batch settlement proof
- Optional ERC-8004 feedback `proofOfPayment` linkage

Do **not** assume every agent commerce payment has a 1:1 Arc Transfer log.

## Spec alignment

v1 already lists `x402_payment_reference`, `gateway_transfer_linked`, `cctp_origin_matched`. This page clarifies they are different legs of the stack:

```text
x402 (HTTP payment protocol)
  → optional Gateway batch settlement (nanopayments)
  → or exact onchain settlement
Gateway / UB (balance abstraction)
  → Arc mint / spend
CCTP (bridge messaging)
  → Arc burn/mint domains
```

Deeper protocol notes: [gateway-protocol.md](./gateway-protocol.md).
