# Arc Contract Addresses (Testnet)

**Status**: Draft
**Last updated**: 2026-08-06

Source: [Contract addresses](https://docs.arc.io/arc/references/contract-addresses)

All addresses below are **Arc Testnet**. Mainnet addresses are not yet published.

## Stablecoins

| Asset | Address | Notes |
| --- | --- | --- |
| USDC (ERC-20 interface) | `0x3600000000000000000000000000000000000000` | 6 decimals; same balance as native USDC (18) |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 decimals |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | 6 decimals; permissioned |
| USYC Entitlements | `0xcc205224862c7641930c87679e98999d23c26113` | Allowlist controls |
| USYC Teller | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` | Mint/redeem USYC from USDC |

Faucet: [faucet.circle.com](https://faucet.circle.com/)

## System emitters / extensions (from other docs)

| Role | Address |
| --- | --- |
| Native USDC system Transfer emitter (EIP-7708) | `0xfffffffffffffffffffffffffffffffffffffffe` |
| Legacy NativeCoinAuthority (pre-Zero5 testnet) | `0x1800000000000000000000000000000000000000` |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` |

## Crosschain — CCTP (domain 26)

| Contract | Address |
| --- | --- |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| TokenMinterV2 | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` |
| MessageV2 | `0xbaC0179bB358A8936169a63408C8481D582390C4` |

## Crosschain — Gateway (domain 26)

| Contract | Address |
| --- | --- |
| GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| GatewayMinter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` |

Gateway is the chain-abstracted balance path behind Unified Balance spends — index for `gateway_transfer_linked` confidence.

## Payments / FX

| Contract | Address | Notes |
| --- | --- | --- |
| StableFX FxEscrow | `0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10` | Stablecoin FX settlement escrow |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Required for StableFX allowances |

## Agentic (from tutorials; not on this Arc page)

| Contract | Address |
| --- | --- |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| ERC-8183 AgenticCommerce | `0x0747EEf0706327138c69792bF28Cd525089e4583` |

## Common Ethereum contracts on Arc

| Contract | Address |
| --- | --- |
| CREATE2 Factory (Arachnid) | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

## Test blocklisted address

Mnemonic `test test ... junk`, index 1:

`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

Value transfers to/from this address revert — useful for testing failed-payment / blocklist evidence paths.

## aefi notes

- Prefer system emitter for USDC settlement; ERC-20 USDC address is still needed for approvals, blocklist events, and interface metadata
- GatewayWallet / GatewayMinter are Phase 2 (or late Phase 1) for Unified Balance spend lineage
- StableFX escrow is relevant when explaining swap-settlement payments, not core agent job flows
- Keep this file as the single address cheat-sheet; update when Arc publishes mainnet addresses
