# Agentic Economy on Arc

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Agentic Economy](https://docs.arc.io/build/agentic-economy), [Register AI agent (ERC-8004)](https://docs.arc.io/arc/tutorials/register-your-first-ai-agent), [Create ERC-8183 job](https://docs.arc.io/arc/tutorials/create-your-first-erc-8183-job), [Account abstraction](https://docs.arc.io/arc/tools/account-abstraction)

## Arc’s agent stack

Arc treats agents as first-class economic participants via:

- **ERC-8004** — onchain identity, reputation, validation
- **ERC-8183** — job lifecycle with USDC escrow and settlement
- Stable USDC gas + sub-second finality
- Adjacent: x402 / Nanopayments sample apps, Circle Wallets, AA providers

aefi does **not** replace these registries or escrow contracts. It indexes and explains the evidence they produce.

Deeper EIP notes: [erc-8004.md](./erc-8004.md), [erc-8183.md](./erc-8183.md). Nanopayment rail: [gateway-and-x402.md](./gateway-and-x402.md).

## ERC-8004 (identity)

Testnet contracts:

| Contract | Address |
| --- | --- |
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

### Identity

- `register(metadataURI)` mints an identity NFT
- Agent ID = minted `tokenId` from IdentityRegistry `Transfer` event
- Metadata URI typically IPFS

### Reputation

- External observers record feedback (score, tag, hash, etc.)
- **Owners cannot record reputation for their own agents** (anti self-dealing)

### Validation

- Two-step request/response on ValidationRegistry
- Agent owner requests validation; validator submits response
- Status readable via `getValidationStatus`

### aefi mapping

```text
ERC-8004 identity NFT  → agent identity (+ identity_sources type erc_8004)
reputation events      → provider performance / confidence inputs
validation status      → credential / trust evidence (not task authority)
```

Identity alone still does not prove mandate, task capability, or successful delivery — matches v1 principle “Identity is not enough.”

## ERC-8183 (jobs)

Testnet reference implementation:

| Contract | Address |
| --- | --- |
| AgenticCommerce | `0x0747EEf0706327138c69792bF28Cd525089e4583` |

### Lifecycle (quickstart)

```text
createJob(provider, evaluator, expiredAt, description, hook)
  → setBudget(jobId, amount, optParams)
  → approve USDC + fund(jobId, optParams)     # Funded
  → submit(jobId, deliverableHash, optParams) # Submitted
  → complete(jobId, reasonHash, optParams)    # Completed
```

`getJob` returns: `id`, `client`, `provider`, `evaluator`, `description`, `budget`, `expiredAt`, `status`, `hook`.

Status enum names from tutorial:

```text
Open | Funded | Submitted | Completed | Rejected | Expired
```

`JobCreated` event fields: `jobId`, `client`, `provider`, `evaluator`, `expiredAt`, `hook`.

Notes:

- Tutorial uses Circle developer-controlled **smart contract account** wallets for the job flow
- Deliverable is a `bytes32` hash (content offchain)
- Client can also act as evaluator
- `hook` can be `address(0)` for the basic flow
- Reference `getJob()` does not return the deliverable hash — track from submit tx / local state

### aefi mapping

```text
ERC-8183 job          → commerce_job
client / provider     → requester / provider agents or wallets
fund / complete       → payment + outcome evidence
deliverable hash      → deliverable reference
evaluator complete    → evaluation / acceptance
```

High-confidence linkage when job ID appears in Memo or explicit job contract events (`erc_8183_job_lifecycle`, `escrow_release_after_acceptance`).

## Account abstraction

Arc supports ERC-4337 via ecosystem providers (Biconomy, Pimlico, Zerodev, Privy, Circle Wallets, Turnkey, etc.) — modular mix of SDKs, bundlers, paymasters, session keys.

Tension with Memo: Memo requires direct EOA callers. Agent spend via AA/session keys may not get native Memo correlation unless a separate EOA Memo tx or offchain metadata is used.

Unified Balance delegates (EOA delegate signing for owner) are a closer fit to aefi’s delegated-mandate model than opaque AA bundler txs.

## Sample apps called out by Arc

- Escrow + work validation with Circle Wallets / Refund Protocol
- Agent nanopayments for APIs via x402
