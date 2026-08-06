# Arc Network

**Status**: Draft
**Last updated**: 2026-08-06

Source: [Arc Network](https://docs.arc.io/arc-chain), [Integrate](https://docs.arc.io/integrate), [Build](https://docs.arc.io/build)

## What Arc is

Purpose-built L1 for stablecoin-native finance and agentic commerce:

- USDC as gas (no volatile native token)
- Sub-second deterministic finality (~0.48s testnet blocks)
- Full EVM compatibility (Reth execution, Osaka baseline)
- Permissioned validators, permissionless developers
- Chain ID: `5042002` (testnet)

Also ships App Kits, AI/MCP tooling, and ecosystem indexers/AA/compliance partners.

## Architecture

```text
Consensus (Malachite BFT)  →  sub-second finality, no reorgs
Execution (Reth / EVM)     →  Solidity + standard Ethereum tooling
```

Other notable features (lower priority for Aefi Phase 1):

- Opt-in privacy via Arc Privacy Sector (APS) — evidence blind spot when used
- Post-quantum wallet signatures (SLH-DSA-SHA2-128s)

## Three integration differences

From [Integrate](https://docs.arc.io/integrate):

1. **USDC gas** — fee estimation, display, and balances are USDC-native
2. **Deterministic finality** — one confirmation is enough; tx lifecycle is `pending | final`
3. **Dual USDC interface** — native 18 decimals vs ERC-20 6 decimals, same underlying balance

## Build stack (adjacent to Aefi)

| Piece | Role vs Aefi |
| --- | --- |
| App Kits | Creates multichain payment workflows Aefi must explain |
| Account abstraction | Agents often spend via smart wallets / session keys |
| Data indexers (Envio, Goldsky, The Graph, Thirdweb) | Possible raw-feed partners; Aefi owns matching + confidence |
| Compliance vendors (Elliptic, TRM) | Screen/risk; not Aefi’s job |

## Stable assets

- **USDC** — gas + primary settlement asset
- **EURC** — euro-denominated transfers
- **USYC** — onchain yield

## Aefi takeaway

Arc is the settlement substrate. Aefi indexes its economic and identity activity; it does not replace Arc wallets, runtimes, or marketplaces.
