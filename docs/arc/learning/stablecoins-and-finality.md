# Stablecoin Native Model and Finality

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Stablecoin native model](https://docs.arc.io/arc/concepts/stablecoin-native-model), [Deterministic finality](https://docs.arc.io/arc/concepts/deterministic-finality)

## Stablecoin-native design

Arc has **no volatile native token**. USDC is gas and value. EURC and USYC are natively deployed (not bridged wrappers).

Design principles Arc states:

1. No volatile fee token
2. Single gas denomination at launch (USDC only; multi-stable gas via paymasters not supported at launch)
3. Stablecoins as first-class protocol primitives

### Dual USDC interface (recap)

| Interface | Decimals | Role |
| --- | --- | --- |
| Native | 18 | Gas, `msg.value`, native sends |
| ERC-20 (`0x3600…0000`) | 6 | Approvals / allowances / app transfers |

Same underlying balance. No `WUSDC` / `USDC.e` — DEXes should use the ERC-20 address directly.

Every USDC movement emits system EIP-7708 `Transfer` (18 decimals). Index that stream for complete coverage; see [evm-and-usdc.md](./evm-and-usdc.md).

### Other native assets

- **EURC** — standard ERC-20, 6 decimals, euro payments / FX
- **USYC** — yield-bearing MMF shares; institutional, non-US, \$100k minimum; allowlisted via Entitlements + Teller

### Aefi takeaway

Asset model is simple for Phase 1 (USDC + EURC). Treat amounts in a canonical atomic unit (prefer 18-decimal USDC). USYC is later / niche. Fee and payment share the same unit of account — Explain Transaction can show payment + gas in USDC without FX conversion.

## Deterministic finality

Arc finality is binary:

```text
unconfirmed  →  final
```

Once ≥2/3 of BFT validators sign a block, it is irreversible. No confirmation windows, no reorgs, no probabilistic finality.

| Network | Typical finality |
| --- | --- |
| Arc | \<1s, deterministic on commit |
| Ethereum L1 | ~12–15 min |
| Typical L2 | ~7 day withdrawal windows |

### Developer / Aefi implications

- Verify Payment can mark settled on inclusion (one confirmation)
- Indexer: no reorg rollback; process each block once
- Safe to fire downstream webhooks / DB writes immediately on commit
- Composable multi-step flows (swap-then-bridge) can chain without confirmation delays between steps — but Aefi must still correlate multi-leg economic events
- Settlement finality is auditable — strong fit for evidence-backed confidence
