# Cloudflare Authority Surfaces (Deep)

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Agent Access Model](https://blog.cloudflare.com/the-agent-access-model), [Cloudflare Wallets](https://blog.cloudflare.com/wallets). Vendor-neutral mapping already sketched in [Aefi spec v1](../../ideation/spec/v1.md) §4–7.

These are **not Arc-native**. They are the strongest published model for Aefi’s *task execution authority* layer, which Arc settlement alone does not provide.

## Dual wallet model (mandate layer)

| Cloudflare | Meaning | Aefi concept |
| --- | --- | --- |
| Account Wallet | Human/org owner wallet; fund/remove | `principal` + funding wallet |
| Virtual Wallet | Agent-operated via API keys | `delegated_wallet` + `agent` |
| Guardrails | Allowance, allow list, max tx size | `delegated_mandate.permissions` |

Virtual Wallets let agents buy APIs / MCP tools / content under owner-defined spend limits. This is durable **delegated mandate**, not task-scoped capability.

## Agent Access Model (task authority layer)

Reference architecture (not a wire-level spec). Unit of authority: **one task-scoped run**.

### Core ideas

1. **Short-lived, task-scoped credentials** — issued at dispatch; expire when task ends. Encode “agent X, for principal H, task T.” **Sender-constrained** to a harness-held proof key (stolen token alone insufficient).
2. **Enforcement outside the model** — harness + network, never the prompt.
3. **Capability ceiling** — initial capability set for the task execution graph; can only narrow during the task.
4. **Trust ratchet** — on declared protected events, remove capabilities across the graph; restoration only in a **new** authorized task.
5. **Mediated paths only** — tool mediation + network egress controls; unmediated sockets create coverage gaps.
6. **Evidence systems** — Agent Activity Log + Grant Review Loop; grants reviewed from captured activity; approved changes apply to **future** tasks only (never widen the active task).

### Architecture pieces (AAM)

| Control | Role |
| --- | --- |
| Agent Identity Broker | Issues task credential at dispatch |
| Capability / policy enforcement | At tool + network boundaries |
| Trust ratchet | Narrows capability state on triggers |
| Agent Activity Log | Externally generated activity evidence |
| Grant Review Loop | Template tightening from evidence |

Terminology mapping (from v1):

```text
task execution graph      → task_execution
capability ceiling        → initial_capability_set
trust ratchet             → capability_transition
agent activity log        → enforcement_activity
virtual wallet            → delegated_wallet
```

## Why this matters vs Arc rails

| Concern | Arc / Circle today | Cloudflare AAM / VW |
| --- | --- | --- |
| Settlement | Strong (Transfer, ERC-8183, Gateway) | N/A (payment via wallets) |
| Who may spend generally | UB/Gateway delegates (coarse) | Virtual Wallet allowance/allowlist/max |
| Was *this* action allowed in *this* run | Not native | Task credential + capability state |
| Audit of tool/network acts | Partial (onchain only) | Activity Log (if mediated) |
| AA / Memo tension | Memo EOA-only | Separate from Arc Memo |

Aefi Phase 1 can verify **payment settled** and **job completed** on Arc with high confidence, while often returning `authorization_evidence_missing` / `capability_state_unresolved` for task authority — unless Cloudflare (or similar) adapters ingest credentials, capability transitions, and activity logs.

## Confidence / coverage rules to preserve

- Missing Activity Log events ≠ unauthorized (mediation gaps: encrypted traffic, out-of-band, telemetry failure)
- External enforcement evidence outranks agent self-reports
- Mandate check and task check remain **separate** assessments, then combined

## Adapter sketch (Phase 2)

```text
Cloudflare Virtual Wallet events  → delegated_mandate evidence
Identity Broker credential issue  → task_execution.credential
Capability transitions            → capability_state versions
Policy allow/deny decisions       → action.authorization_decision
Agent Activity Log                → enforcement_activity evidence
```

Keep schema vendor-neutral; store `source: cloudflare_*` on evidence objects.
