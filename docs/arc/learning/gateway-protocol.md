# Gateway Protocol Deep Dive

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide), [ERC-1271 auth](https://developers.circle.com/gateway/references/erc-1271), [EVM unified balance quickstart](https://developers.circle.com/gateway/quickstarts/unified-balance-evm), Circle nanopayments overviews. Complements [gateway-and-x402.md](./gateway-and-x402.md).

## Architecture

```text
GatewayWallet (per source chain)     Gateway System (offchain)      GatewayMinter (per dest chain)
  deposit / withdraw / burn intents  ←→ balances + attestations ←→  mint from attestation
```

Vs CCTP: Gateway **front-loads** finality wait at deposit time so spends can be instant and chain-abstracted (even amounts exceeding any single-chain deposit).

Non-custodial: Circle cannot move funds without user-signed burn intents. Escape hatch: `initiateWithdrawal` → **7-day delay** → `withdraw`.

## Onchain deposits (critical)

Must use wallet deposit methods — **plain ERC-20 transfer to GatewayWallet loses funds**.

| Method | Notes |
| --- | --- |
| `deposit` | Approve then deposit |
| `depositFor` | Credit another depositor (permissionless funder) |
| `depositWithPermit` | EIP-2612 |
| `depositWithAuthorization` | ERC-3009 |

Deposits only become transferable after **source-chain finality** + Gateway observation. Pending ≠ available.

Arc testnet: domain `26`, Wallet `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`, Minter `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B`.

## Transfer primitives

### TransferSpec

Crosschain identity = `keccak256(TransferSpec)`. Same hash emitted on mint and corresponding burn → **primary Gateway join key** for Aefi (`gateway_transfer_linked`).

Key fields: source/dest domains & contracts & tokens, `sourceDepositor`, `destinationRecipient`, `sourceSigner`, `destinationCaller` (0 = any), `value`, `salt`, `hookData`.

### BurnIntent (user-signed)

`maxBlockHeight`, `maxFee`, embedded `TransferSpec`. Proves user intent; without it Circle cannot burn. Expires (must be far enough vs withdrawal delay). Up to **16** intents per EVM transfer request (`BurnIntentSet`); Solana = one intent each. Signed EIP-712 on EVM.

`sourceSigner` may be depositor **or authorized delegate**.

### Attestation (Gateway-signed)

Proves sufficient balance at request time. Expires in **~10 minutes**. Used to mint on destination. Attestation sets can mint total value atomically while emitting per-spec events.

## Instant transfer flow

```text
1. Sign BurnIntent(s)  [owner or delegate; EOA ECDSA or ERC-1271]
2. POST /v1/transfer → attestation (+ signature) or transfer id if forwarded
3. Call GatewayMinter with attestation on destination
4. Gateway System later submits burns on source chains (AttestationUsed → burn)
```

Same-chain withdrawal still uses mint/burn loop (no unsigned “pull from wallet”). Forwarded mint paths may return `transferId` instead of local dest tx — poll `GET /v1/transfer/{id}`.

`destinationCaller` binds who may submit the mint (anti front-run for composed multicalls).

## Delegates (protocol-level)

`addDelegate` / `removeDelegate` on **each** GatewayWallet where balance sits. Delegate can sign transfers for that depositor’s balance on that chain — **full allowance** for deposited USDC (not fine-grained limits in the base delegate model).

- Delegate can be EOA or ERC-1271 SCA
- Removal does **not** invalidate already-signed burn intents until they expire
- API reflects revocations when onchain removal is finalized

Maps to Aefi mandate, but coarser than Cloudflare Virtual Wallet allowlists / per-tx caps.

## ERC-1271 programmable authorization

`contractSigner: true` on `/v1/transfer` items. Gateway validates via AWS Nitro TEE + **RPC quorum (≥2 of 3)** simulating `isValidSignature` at a recent block (up to **5 minutes** stale → revocation lag).

Limits:

- EVM-only
- Read-only validation (no state-mutating `isValidSignature`)
- **Nanopayments are NOT available via ERC-1271** — nanopayment path uses ERC-3009 / different validation

## Nanopayments / x402 batch path (deeper)

```text
Deposit → Gateway balance (onchain, once)
Loop:
  HTTP 402 → EIP-3009 TransferWithAuthorization (offchain)
  → seller/facilitator verify → serve immediately
  → Gateway locks buyer / credits seller pending (offchain ledger)
Periodic:
  TEE verifies batch → single onchain settlement of net positions
  seller withdraws to any supported chain
```

Scheme name in x402 accepts: `GatewayWalletBatched` vs exact onchain (`ExactEvmScheme`).

**Evidence reality for Aefi:**

| Layer | What exists |
| --- | --- |
| Per API call | Offchain EIP-3009 auth + facilitator verify/settle response |
| Between calls | Offchain pending balances |
| Onchain | Sparse batch settlement txs + later withdrawals/mints |
| Join keys | Auth payload fields, facilitator receipts, eventual TransferSpec hashes if exposed |

Do not expect one Arc Transfer per nanopayment. Confidence for a single call should cite x402 receipt + batch settlement proof, with explicit coverage about serve-before-final-settle window.

## Gateway System inputs (indexer-adjacent)

| Input | System response |
| --- | --- |
| `Deposit` event | Increment balance |
| Transfer request | Decrement balance; issue attestation |
| `AttestationUsed` | Submit burns on sources |
| Attestation unused expire | Increment balance back |
| `WithdrawInitiated` | Decrement balance |

All observed only after chain finality (Arc: immediate; other chains: confirmation depth per Circle table).

See [gateway-events.md](./gateway-events.md) for full event ABIs and [x402-eip3009-evidence.md](./x402-eip3009-evidence.md) for offchain payment evidence.
