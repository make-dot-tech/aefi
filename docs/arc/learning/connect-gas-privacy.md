# Connect, Gas, and Privacy

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc), [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees), [Opt-in privacy](https://docs.arc.io/arc/concepts/opt-in-privacy)

## Network connection (testnet)

| Parameter | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| Currency | USDC |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |
| Primary HTTP RPC | `https://rpc.testnet.arc.io` |
| Primary WS | `wss://rpc.testnet.arc.io` |

Alternate RPCs: Blockdaemon, dRPC, QuickNode (`*.testnet.arc.io` variants).

`viem` includes built-in `arcTestnet` chain. Wallets without custom-gas-token support may display balances as “ETH” while the asset is USDC.

## Gas and fees

- Fees denominated in USDC (18-decimal native accounting)
- EIP-1559 + EWMA smoothing of base fee (stable, not spike-reactive)
- Design target ~\$0.01 / tx under normal load
- Testnet min base fee: **20 Gwei**; max: **20,000 Gwei**
- Throughput: 30M gas/block (~60M gas/sec at 0.5s blocks)
- Next base fee also published in parent header `extra_data` (see EVM differences)
- Base fee paid to beneficiary — **not burned**

Submission tips from Arc:

- Set `maxFeePerGas` ≥ 20 Gwei or txs may pend forever / fail
- Small priority tip (e.g. 1 Gwei) can help under load; 0 is accepted
- Display fees to users in USDC dollars, not raw Gwei

Common errors: `transaction underpriced`, `intrinsic gas too low`, `insufficient funds for gas * price + value` (need USDC for **value + gas**).

Gas tracker: https://testnet.arcscan.app/gas-tracker

### Aefi

- Payment explanations can show settlement amount + gas fee in the same asset (USDC)
- Fee is **not** a Transfer log — compute from receipt (`gasUsed × effectiveGasPrice`)
- Low absolute fee cost makes frequent agent micropayments / Memo-annotated txs practical

## Opt-in privacy (APS) — roadmap only

**Not available on Arc yet.** Documented design for future coverage planning.

Arc Privacy Sector (APS):

- Parallel confidential EVM alongside public Arc
- Same validators / same block commit — synchronous composability
- Submit encrypted txs via privacy precompile; public ledger sees opaque calldata
- **No public execution results, return values, or event logs**
- Default-deny isolation; events off by default; trust domains + access policies

### Aefi coverage implication

When APS ships, private agent commerce will create intentional **mediation / collection gaps**. Treat as `mediation_coverage_incomplete` / unknown coverage unless authorized private-state disclosure is provided. Do not treat absence of public Transfer/Memo as proof of non-payment.
