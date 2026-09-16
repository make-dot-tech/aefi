# TLAY: Machine-to-Machine USDC Nanopayments

**Status**: Draft
**Last updated**: 2026-08-14

Sources: [How TLAY Is Building the Payment Layer for the Machine Economy](https://www.arc.io/blog/how-tlay-is-building-the-payment-layer-for-the-machine-economy) (Arc partner spotlight, 2026-08-13), [TLAY](https://www.tlay.io), [Builder Spotlight replay](https://community.arc.io/public/videos/replay-arc-builder-spotlight-tlay-machine-to-machine-nanopayments-on-arc-2026-05-28)

## What shipped in the spotlight

TLAY builds **embedded wallets and trust primitives for physical devices** — machine-to-machine commerce, not only cloud LLM agents.

Live demo (Arc Builder Spotlight, 2026-05-27):

| Device | Role |
| --- | --- |
| **eCandle** | Solar energy broadcaster; publishes a live electricity price |
| **Bitaxe** | Compact bitcoin miner; evaluates price vs mining economics |

Every ~10 seconds the Bitaxe decides whether buying power is profitable. If yes, it **signs a USDC payment authorization on-device** and consumes electricity. Settlement runs through Circle infrastructure onto **Arc Testnet**. No human approval; no custodial intermediary holding funds for the decision loop.

## Why Arc fits

TLAY’s cadence (decision + settle every ~10s) needs:

- **Sub-second deterministic finality** — each payment settles before the next pricing window
- **USDC gas** — fee in the same stable asset as the transfer; nanopayments stay economical
- **Stablecoin-native stack** — path into EarnKit / Uniswap / CCTP as devices need lending, collateral, or cross-chain USDC later

Related notes: [stablecoins-and-finality.md](./stablecoins-and-finality.md), [consensus-and-fees.md](./consensus-and-fees.md), [gateway-and-x402.md](./gateway-and-x402.md).

## Category expansion

Arc’s agentic-economy framing is usually cloud agents + API payments. TLAY pushes the same pattern into **physical AI**:

- Sensor nets paying for data relay
- EV ↔ charging station settlement
- Manufacturing devices buying neighbor compute

Pattern: hold value → evaluate price → decide → settle continuously, at frequencies traditional rails cannot support.

Broader stack context: [agentic-economy.md](./agentic-economy.md).

## aefi implications

aefi indexes and explains evidence; it does not replace device wallets or Circle settlement.

| Observation | aefi angle |
| --- | --- |
| Device wallets are economic actors | Treat like provisional agents / wallet identities until stronger identity (e.g. ERC-8004) attaches |
| High-frequency USDC micropayments | Graph must **not** project all Arc USDC — only agent/device-relevant settlements (Postgres keeps the full stream) |
| “Payment settled” every 10s is table stakes | Operators still need counterparty, mandate/price rule, service delivered, and confidence over a stream of micropayments |
| Physical M2M vs cloud agents | Same evidence graph shape; identity and authority channels may be thinner / different (coverage gaps, not absence of value transfer) |

Useful product questions if we ever index TLAY-style flows:

1. Can we explain a continuous micropayment stream (not only one-shot txs)?
2. How do we score a device counterparty with sparse formal identity?
3. What evidence types cover on-device authorization vs observed Arc Transfer?

See also: [aefi-implications.md](./aefi-implications.md), matcher agent-payment filter in `services/matcher`.
