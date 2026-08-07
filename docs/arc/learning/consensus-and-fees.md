# Consensus and Stable Fees

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Consensus layer](https://docs.arc.io/arc/concepts/consensus-layer), [Stable fee design](https://docs.arc.io/arc/concepts/stable-fee-design)

## Consensus (Malachite BFT)

Arc orders and finalizes blocks with [Malachite](https://github.com/circlefin/malachite/) — Tendermint-style BFT under a **permissioned Proof-of-Authority** validator set (known institutions, SOC 2, geographic distribution, uptime SLAs).

### Pipeline

```text
1. Propose   → rotating proposer bundles txs
2. Pre-vote  → validators vote on validity
3. Pre-commit → ≥2/3 pre-commit → proceed
4. Commit    → block finalized; txs irreversible
```

Two-phase voting makes conflicting finalized blocks impossible → **no reorgs**.

### Performance (documented)

| Metric | Value | Conditions |
| --- | --- | --- |
| Throughput | 3,000+ TPS | 20 validators |
| Finality | \<350 ms | benchmark |
| Peak | 10,000+ TPS | 4 validators |

Safety: \<1/3 faulty validators. Liveness: ≥2/3 honest online.

Roadmap: multi-proposer, fewer consensus rounds, possible permissioned PoS.

### aefi

- Trust model for settlement evidence is institutional PoA BFT, not anonymous stake
- Indexer design stays “process once on inclusion”
- Note permissioned validators in coverage / trust assumptions (not Ethereum mainnet equivalence)

## Stable fee design

EIP-1559 base fee + **EWMA smoothing** of utilization (not per-block step jumps).

```text
utilization_ewma(n) = α * util(n) + (1-α) * ewma(n-1)
base_fee(n) = adjust(prev, ewma, target)  # clamped [min, max]
```

| Parameter | Value |
| --- | --- |
| Design target | ~\$0.001 per ERC-20 transfer (stable-fee page); gas page also cites ~\$0.01 under normal load — treat as approximate |
| Testnet min base fee | 20 Gwei |
| Max base fee | 20,000 Gwei |
| Throughput | 30M gas/block |

Priority tip: usually `0`; small tip under congestion. Query `eth_maxPriorityFeePerGas`.

Benefits for agents: predictable USDC-denominated costs, less fee-bump retry logic, easy reconciliation in the same unit as payments.

### aefi

- Explain Transaction can show payment + gas in USDC without FX
- Micropayments / Memo-annotated txs are economically viable on Arc public path
- Separately, Gateway nanopayments / x402 batch settlement is the path for *sub-cent* gas-free agent API payments (see [gateway-and-x402.md](./gateway-and-x402.md))
