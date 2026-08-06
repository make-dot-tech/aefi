# Indexing Arc Events

**Status**: Draft
**Last updated**: 2026-08-06

Source: [Index Arc events](https://docs.arc.io/integrate/infrastructure/indexing-events)

## Pipeline defaults

- RPC: `https://rpc.testnet.arc.io`
- WebSocket: `wss://rpc.testnet.arc.io`
- Stream: `eth_subscribe("newHeads")`; backfill via `eth_getLogs`
- Throughput: sub-second blocks — must handle bursts of many blocks/second
- Finality: process each block once; resume from last processed block; **no reorg logic**
- Ordering key: `(blockNumber, logIndex)` — never `block.timestamp` alone

## Phase 1 contracts to index

| Priority | Contract | Address | Events |
| --- | --- | --- | --- |
| P0 | Native USDC (system) | `0xff…fe` | `Transfer` (18 decimals) |
| P0 | Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | `Memo` (+ `BeforeMemo`) |
| P0 | ERC-8004 Identity / Reputation / Validation | see [agentic-economy.md](./agentic-economy.md) | identity + reputation + validation |
| P0 | ERC-8183 AgenticCommerce | `0x0747EEf0706327138c69792bF28Cd525089e4583` | job lifecycle |
| P1 | CCTP TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | `DepositForBurn` |
| P1 | CCTP MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | `MessageReceived` |
| P1 | GatewayMinter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` | `AttestationUsed` |
| P1 | GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | `Deposited`, `GatewayBurned`, `DelegateAdded`/`Removed` |
| P1 | EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | `Transfer` (6 decimals) |
| P2 | USDC ERC-20 | `0x3600…0000` | `Transfer` (metadata), `Blocklisted`, `UnBlocklisted` |
| P2 | Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` | batched CallFrom routing |

## USDC settlement stream

Filter system emitter only for payment amounts:

```text
address = 0xfffffffffffffffffffffffffffffffffffffffe
topic0  = Transfer signature
value   = 18-decimal atomic USDC
```

If also indexing ERC-20 USDC Transfer, key by emitter so ERC-20 legs are not double-counted.

## Memo correlation

Join `Memo` ↔ `Transfer` by:

1. Same `transactionHash` (primary)
2. Caller-supplied `memoId` (indexed lookup)
3. `callDataHash` vs known calldata hash (bind to exact inner call)

See [transaction-memos.md](./transaction-memos.md).

## CCTP

Outbound burn (`DepositForBurn`) and inbound mint (`MessageReceived`) give cross-chain lineage. Match on CCTP nonce / domain fields for `cctp_origin_matched`-style confidence.

## Compliance attribution

Memo and Multicall3From preserve original `msg.sender` via CallFrom. Attribute activity to `tx.from` / Memo `sender`, not the wrapper contract address. Blocklist is still enforced against the original sender.

## Suggested per-block index order

```text
1. system USDC Transfer
2. Memo / BeforeMemo
3. ERC-8004 + ERC-8183 events
4. CCTP burn/mint
5. EURC Transfer
6. blocklist events
```
