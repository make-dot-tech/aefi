# EVM Differences and USDC Events

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [EVM differences](https://docs.arc.io/arc/references/evm-differences), [USDC system events](https://docs.arc.io/arc/references/usdc-system-events)

## One USDC, two views

Native USDC and ERC-20 USDC are the **same asset**, not two tokens.

| Interface | Decimals | Used for |
| --- | --- | --- |
| Native (`addr.balance`, `msg.value`, gas) | 18 | Gas + native sends |
| ERC-20 (`0x3600…0000`) | 6 | `transfer` / `approve` / allowances |

Rules:

- Never compare raw values across interfaces without converting
- ERC-20 `balanceOf` truncates below `1e-6` USDC — a `0` ERC-20 balance does not imply a `0` native balance
- Do not treat native vs ERC-20 USDC as a trading pair

## Value transfer rules (vs Ethereum)

Native transfers can revert even with sufficient balance:

- Non-zero transfer to `0x0` forbidden
- Burning forbidden (including value to already self-destructed accounts)
- Blocklist enforced at runtime (to/from blocked addresses revert; included reverts still consume gas)
- Sending value to precompiles reverts

## EIP-7708 native Transfer logs

On Ethereum, plain native sends emit no log. Arc emits a standard ERC-20 `Transfer` from a system address for **every** USDC movement.

| Stream | Emitter | Decimals |
| --- | --- | --- |
| System (EIP-7708) | `0xfffffffffffffffffffffffffffffffffffffffe` | 18 |
| ERC-20 USDC | `0x3600000000000000000000000000000000000000` | 6 |

`topic0` (both): `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`

### Critical indexing rule

An ERC-20 `transfer()` emits **two** logs (system 18-decimal + ERC-20 6-decimal). A plain native send emits **only** the system log.

```text
PRIMARY settlement evidence = system emitter Transfer (18 decimals)
ERC-20 Transfer             = interface metadata only
NEVER sum both for the same movement
```

System log quirks:

- Emitted **first** in the transaction
- Zero-value and self-transfers emit no log
- Mint: `Transfer(0x0, to, amount)` / Burn: `Transfer(from, 0x0, amount)` via precompile only

### Historical testnet (pre-Zero5)

Before Zero5, native movements used custom events from `0x1800…0000` (`NativeCoinTransferred` / `Minted` / `Burned`). Mainnet has used EIP-7708 since genesis. Only matters for testnet backfill across the hard fork.

## Fees and rewards

- Gas fees and block rewards are **not** Transfer events
- Fees: `gasUsed × effectiveGasPrice` from the receipt
- Base fee paid to block beneficiary (not burned)
- Next base fee published in parent header `extra_data`

## Ordering and finality

- Order by `(blockNumber, logIndex)` — timestamps are 1s granularity and can repeat across sub-second blocks
- Finality on inclusion — no reorg handling
- Local tools like Foundry `anvil` do **not** reproduce Arc-specific behavior (EIP-7708, blocklist, native precompiles)

## Other EVM deltas (lower aefi priority)

- `PREVRANDAO` always `0` (no onchain randomness)
- No blob (type-3) transactions
- `SELFDESTRUCT` follows EIP-6780 plus Arc native-value rules; successful balance move emits system Transfer
- EIP-7702 set-code works as on Ethereum
