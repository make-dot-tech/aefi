# Arc Learning Notes

**Status**: Draft
**Last updated**: 2026-08-06

Working notes from Arc official docs ([docs.arc.io](https://docs.arc.io/)), focused on what aefi needs to index, correlate, and explain.

This set covers Arc L1 mechanics, indexing primitives, App Kits / Gateway / x402 payment rails, and ERC-8004/8183 agent commerce. Start with [aefi-implications.md](./aefi-implications.md) for the synthesis.

## Documents

| Doc | Focus |
| --- | --- |
| [network.md](./network.md) | L1 overview, architecture, integration surface |
| [arc-system-architecture.md](./arc-system-architecture.md) | Consensus↔execution pipeline, precompiles, deployment phases |
| [connect-gas-privacy.md](./connect-gas-privacy.md) | RPC/chain config, fee market, APS privacy roadmap |
| [consensus-and-fees.md](./consensus-and-fees.md) | Malachite PoA BFT + EWMA fee market |
| [evm-and-usdc.md](./evm-and-usdc.md) | EVM differences, dual USDC, EIP-7708 Transfer logs |
| [stablecoins-and-finality.md](./stablecoins-and-finality.md) | Stablecoin-native model + deterministic finality |
| [contract-addresses.md](./contract-addresses.md) | Testnet address cheat-sheet |
| [indexing.md](./indexing.md) | Event ingestion blueprint, contracts, ordering, finality |
| [transaction-memos.md](./transaction-memos.md) | Memo contract, CallFrom, EOA constraint |
| [app-kits.md](./app-kits.md) | Bridge / Swap / Send / Unified Balance / delegates |
| [unified-balance-delegates.md](./unified-balance-delegates.md) | UB delegate grants as mandate-shaped evidence |
| [gateway-and-x402.md](./gateway-and-x402.md) | Gateway, nanopayments, x402 batch settlement (overview) |
| [gateway-protocol.md](./gateway-protocol.md) | TransferSpec / BurnIntent / attestation / delegates / ERC-1271 |
| [gateway-events.md](./gateway-events.md) | GatewayWallet / GatewayMinter event ABIs + join recipes |
| [x402-eip3009-evidence.md](./x402-eip3009-evidence.md) | EIP-3009 signing, payment payloads, verify/settle evidence |
| [cloudflare-authority.md](./cloudflare-authority.md) | Virtual Wallets + Agent Access Model → aefi authority layers |
| [agentic-economy.md](./agentic-economy.md) | Arc agent stack overview (8004/8183/AA) |
| [erc-8004.md](./erc-8004.md) | EIP-8004 identity / reputation / validation |
| [erc-8183.md](./erc-8183.md) | EIP-8183 job escrow state machine + events |
| [aefi-implications.md](./aefi-implications.md) | How Arc maps onto the aefi v1 spec |

## Doc convention

Every project doc uses this header under the title:

```md
**Status**: Draft | Active | Deprecated
**Last updated**: YYYY-MM-DD
```

## Sources

Primary index: [https://docs.arc.io/llms.txt](https://docs.arc.io/llms.txt)
