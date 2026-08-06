# App Kits

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [App Kits](https://docs.arc.io/app-kit), [Unified Balance delegate](https://docs.arc.io/app-kit/quickstarts/unified-balance-delegate-deposit-and-spend), [P2P Payments](https://docs.arc.io/build/payments)

## What App Kits are

Circle SDKs that compose multichain payment/liquidity flows behind one interface, abstracting [CCTP](https://developers.circle.com/cctp) and [Gateway](https://developers.circle.com/gateway).

Packages: `@circle-fin/app-kit` (all-in-one) or separate Bridge / Swap / Unified Balance kits. Adapters: Viem, Ethers, Solana, Circle Wallets.

## Capabilities

| Capability | Behavior | Aefi implication |
| --- | --- | --- |
| **Send** | Same-chain wallet → wallet transfer | Simplest settlement evidence |
| **Bridge** | USDC across chains | Origin ≠ settlement chain; need CCTP lineage |
| **Swap** | Token exchange same- or cross-chain | Payment path may include FX (e.g. USDC↔EURC) |
| **Unified Balance** | Deposit on multiple chains, spend anywhere | Spend may not look like a simple Arc wallet→wallet send |

## Unified Balance + delegates

Delegation lets an owner keep custody while a delegate EOA signs spends (typical backend pattern).

Key behaviors from the delegate quickstart:

- `depositFor` is permissionless — any wallet can fund another account’s Unified Balance
- `addDelegate` is owner-signed, **source-chain specific**
- Delegate signs spends with `sourceAccount` = owner
- Spend to Arc can use Forwarding Service (`useForwarder: true`) — destination mint may not be locally submitted; result may include `transferId`
- Received amount can be less than requested after provider / gas / forwarder fees

This is a concrete Arc/Circle form of **delegated mandate**: owner authorizes delegate spend rights; Aefi should model owner vs delegate vs recipient distinctly.

## Economic event shape

Do not assume one Arc tx = one economic event. A commerce payment may be:

```text
deposit (source chain)
  → optional swap
  → spend / bridge / forwarder mint on Arc
  → fees skimmed along the path
```

Matching needs workflow correlation (memos, transfer IDs, Gateway/CCTP receipts), not Transfer logs alone.

## Payments positioning

Arc P2P payments docs point agents/apps at App Kit Send/Bridge/Unified Balance plus compliance vendors. Sample agent payment path also includes Circle Nanopayments + x402.
