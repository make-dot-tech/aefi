# Arc System Architecture (Deep)

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [System overview](https://docs.arc.io/arc/concepts/system-overview), [Execution layer](https://docs.arc.io/arc/concepts/execution-layer), [Deployment model](https://docs.arc.io/arc/concepts/deployment-model), [Consensus](./consensus-and-fees.md)

## Two-layer design

```text
JSON-RPC submit
  → mempool validation
  → Malachite propose / pre-vote / pre-commit / commit   # consensus finalizes order
  → Reth EVM execution + Arc modules                    # state + logs
  → Merkle state root
```

Consensus (Malachite) and execution (Reth) optimize independently. Commit makes the block irreversible; execution then applies state. Full lifecycle \<1s.

## Execution pipeline (Reth)

1. Mempool (signature, balance, nonce)
2. EVM execution (contracts + native transfers)
3. Fee Manager (USDC gas, EWMA)
4. Module calls (APS / Stablecoin Services when live — skipped today)
5. State update (balances, storage, **logs**)
6. State root

### Protocol modules

| Module | Status | Role |
| --- | --- | --- |
| Fee Manager | Live | USDC gas + EWMA |
| CallFrom precompile | Live | Preserve `msg.sender` for Memo / Multicall3From |
| APS | Planned | Confidential EVM alongside public |
| Stablecoin Services | Planned | Cross-currency settlement, paymasters, multi-stable gas |

### Custom precompiles (`0x1800…0000`–`0004`)

| Precompile | Address suffix | Function |
| --- | --- | --- |
| Native Coin Authority | `…0000` | Mint / burn / transfer native USDC |
| Native Coin Control | `…0001` | Native coin blocklist |
| System Accounting | `…0002` | Fee Manager gas fee ring buffer |
| Call From | `…0003` | Memo / Multicall3From sender preservation |
| PQ Signature Verify | `…0004` | SLH-DSA-SHA2-128s verification |

Apps usually hit these indirectly (USDC ERC-20, Memo, fees), not via raw precompile calls. Direct EOA → CallFrom reverts (`unauthorized caller`).

## Deployment phases

| Phase | Status |
| --- | --- |
| Devnet | Internal |
| Private Testnet | Complete |
| **Public Testnet** | **Live** — chain ID `5042002` |
| Private Mainnet | Upcoming (~20 PoA validators, limited access) |
| Public Mainnet | Upcoming |

Developer access is permissionless at every public phase. Validators remain permissioned PoA (~20 SOC 2 institutions) at launch; possible later permissioned PoS.

Testnet Q1 2026 snapshot (from docs): 100% uptime, ~0.48s blocks, ~30.7M txs, ~916K wallets.

## Aefi implications

- Settlement evidence final at commit — no confirmation ladder
- Trust assumption: institutional PoA, not anonymous L1 stake — disclose in confidence/coverage
- CallFrom is a protocol primitive; Memo correlation depends on it
- APS will hide public logs when used — plan coverage gaps now
- Precompile `0x1800…0000` historical NativeCoin* events still matter for pre-Zero5 testnet backfill (see [evm-and-usdc.md](./evm-and-usdc.md))
