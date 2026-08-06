# Transaction Memos

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Transaction memos](https://docs.arc.io/arc/concepts/transaction-memos), [Send USDC with a memo](https://docs.arc.io/arc/tutorials/send-usdc-with-transaction-memo), [Compliance](https://docs.arc.io/integrate/infrastructure/compliance)

## Purpose

Attach arbitrary application metadata (invoice ID, job ID, payment reference) to a contract call while keeping the original EOA as `msg.sender` for the target call.

## Contract

| Item | Value |
| --- | --- |
| Address (testnet) | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Available | Arc testnet as of 2026-06-18 |

### Entry point

```solidity
function memo(
    address target,
    bytes calldata data,
    bytes32 memoId,
    bytes calldata memoData
) external;
```

Flow:

```text
EOA → Memo.memo(target, data, memoId, memoData)
   → CallFrom precompile (preserves original EOA as msg.sender)
   → target call (e.g. USDC.transfer)
```

## Events

Ordered audit trail on success:

1. `BeforeMemo(memoIndex)` — before inner call
2. Target events (e.g. USDC `Transfer`)
3. `Memo(sender, target, callDataHash, memoId, memo, memoIndex)` — after inner call

| Field | Type | Notes |
| --- | --- | --- |
| `sender` | `address indexed` | Wallet that called `Memo.memo` (EOA) |
| `target` | `address indexed` | Forwarded contract (e.g. USDC ERC-20) |
| `callDataHash` | `bytes32` | `keccak256` of forwarded calldata |
| `memoId` | `bytes32 indexed` | App-defined lookup key |
| `memo` | `bytes` | App-defined payload |
| `memoIndex` | `uint256` | Sequential frame index |

Nested memos supported: `BeforeMemo` on the way in; `Memo` unwinds innermost → outermost. If the child call reverts, the outer tx reverts (`MemoFailed`), and the memo index increment rolls back.

## EOA-only constraint (critical)

Memo **must** be invoked directly by an EOA.

Supported: MetaMask / hardware / server EOAs / Circle wallets configured as EOAs.

**Not supported as direct callers:**

- ERC-4337 smart accounts (including Circle modular wallets)
- Safe / multisig contract wallets
- Any AA flow where tx originates from bundler / entry point

AA callers revert (sender spoofing not allowed). Workarounds in Arc docs: separate EOA-signed Memo tx, or attach metadata offchain / application-layer.

Also:

- Do not call CallFrom directly from an EOA (`unauthorized caller`)
- No `STATICCALL` / `DELEGATECALL` into Memo

## Sibling: Multicall3From

Address: `0x522fAf9A91c41c443c66765030741e4AaCe147D0`

Same CallFrom pattern for batched calls. Compliance and Aefi attribution must use original sender, not the Multicall3From address.

## Aefi mapping

| Arc field | Aefi use |
| --- | --- |
| `memoId` | Indexed key — e.g. hash of `job_id` / `task_execution_id` |
| `memo` bytes | Versioned structured payload (SDK-defined) |
| `sender` | Acting wallet (EOA) |
| `callDataHash` | Bind memo to exact payment call |
| same `txHash` as Transfer | Primary payment ↔ memo join |

Maps directly to v1 confidence reason `exact_job_id_memo`.

SDK implication: Aefi memo helpers should encode a versioned schema and document the EOA-only limitation. AA agents need an alternate correlation path until Arc supports Memo for smart accounts.
