# x402 / EIP-3009 Payment Evidence

**Status**: Draft
**Last updated**: 2026-08-06

Sources: [Sign EIP-3009 authorizations](https://developers.circle.com/gateway/nanopayments/howtos/eip-3009-signing), [Buyer quickstart](https://developers.circle.com/gateway/nanopayments/quickstarts/buyer), [SDK reference](https://developers.circle.com/gateway/nanopayments/references/sdk), [Verify/Settle APIs](https://developers.circle.com/api-reference/gateway/all/verify-x402payment). Complements [gateway-and-x402.md](./gateway-and-x402.md).

## What x402 is

HTTP negotiation protocol around `402 Payment Required` — not a settlement rail. It defines how servers request payment and clients return proof. Funding/verify/settle are scheme-specific (exact onchain vs `GatewayWalletBatched` nanopayments).

Typical headers:

| Direction | Header | Role |
| --- | --- | --- |
| Server → client | `PAYMENT-REQUIRED` | Base64 JSON with `accepts[]` options |
| Client → server | `Payment-Signature` / `PAYMENT-SIGNATURE` | Base64 payment payload |
| Server → client | `PAYMENT-RESPONSE` | Confirmation after verify/settle |

## Gateway batched signing (Arc Testnet example)

EIP-712 domain is **not** the USDC token domain:

```ts
const domain = {
  name: "GatewayWalletBatched", // ≠ "GatewayWallet" (withdraw/transfer domain)
  version: "1",
  chainId: 5042002, // EVM chain ID — NOT Gateway domain id 26
  verifyingContract: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9", // GatewayWallet
};
```

`TransferWithAuthorization` message (EIP-3009):

```ts
{
  from, to, value,          // value in USDC 6-decimal base units
  validAfter, validBefore,  // validBefore must be ≥ 3 days ahead
  nonce                     // unique random bytes32 each payment
}
```

### Payment payload shape (manual)

```json
{
  "x402Version": 2,
  "payload": {
    "authorization": {
      "from": "0x…",
      "to": "0x…",
      "value": "10000",
      "validAfter": "0",
      "validBefore": "…",
      "nonce": "0x…"
    },
    "signature": "0x…"
  },
  "resource": "…",
  "accepted": { }
}
```

Encoded as base64 in the payment signature header. SDK `BatchEvmScheme` builds this when `accepts[].extra.name === "GatewayWalletBatched"`.

### Common signature failures

| Mistake | Symptom |
| --- | --- |
| Domain name `GatewayWallet` / `USDC` | `invalid_signature` |
| Wrong `verifyingContract` (USDC or Minter) | `invalid_signature` |
| Gateway domain id instead of EVM `chainId` | `invalid_signature` |
| Reused nonce | `invalid_signature` |
| `validBefore` \< 3 days | `authorization_validity_too_short` |
| Dollar amount instead of 6-decimal base units | amount mismatch |

## Verify vs settle (facilitator / Gateway API)

| Call | Checks | Guarantee |
| --- | --- | --- |
| `verify` | Scheme, network, token, signature, time window, address/amount match | **Not** settlement — no balance/nonce lock guarantee |
| `settle` | Full path; locks sender balance; queues batch | Production path; low latency; “guarantees settlement” (queued) |

### SDK response shapes

```ts
// verify
{ isValid: boolean; invalidReason?: string; payer?: string }

// settle
{ success: boolean; errorReason?: string; payer?: string; transaction: string }

// seller middleware req.payment
{ verified: boolean; payer: string; amount: string; network: string; transaction?: string }
```

Treat `transaction` as a **settlement reference** from Circle (may be batch/queue id — do not assume it is always an Arc tx hash until confirmed against chain). Prefer joining later to onchain `GatewayBurned` / batch txs when available.

**Verify ≠ paid.** aefi confidence:

- `verify` only → low / unverified settlement
- successful `settle` + receipt → medium (offchain lock, pending batch)
- settle + observed batch/onchain effect → high

## EOA-only for nanopayments

Nanopayments verify EIP-3009 with `ecrecover` offchain — **SCA / ERC-1271 not supported** on this path. (Standard Gateway transfers do support ERC-1271.) Same class of constraint as Arc Memo.

## Agent Marketplace / CLI flow

Circle Agent Stack wraps the same rails:

```text
circle gateway deposit → circle services search/inspect → circle services pay
```

Payment still settles against Gateway balance via x402. Marketplace is discovery UX, not a separate evidence schema — store CLI/SDK settle responses + authorization payload as evidence.

## aefi evidence object sketch

```json
{
  "type": "x402_payment_authorization",
  "scheme": "GatewayWalletBatched",
  "x402_version": 2,
  "from": "0x…",
  "to": "0x…",
  "value": "10000",
  "asset_decimals": 6,
  "chain_id": 5042002,
  "nonce": "0x…",
  "valid_before": "…",
  "signature": "0x…",
  "resource": "https://…",
  "settle": {
    "success": true,
    "payer": "0x…",
    "transaction_ref": "…"
  },
  "confidence": "medium",
  "confidence_reason": ["x402_payment_reference", "gateway_batch_queued"]
}
```

Upgrade confidence when linked to onchain batch / `GatewayBurned` / seller withdrawal.

## SDK packaging note for aefi

Helpers should:

1. Parse `PAYMENT-REQUIRED` / `accepts` and detect `GatewayWalletBatched`
2. Normalize authorization fields into evidence
3. Record verify vs settle distinctly
4. Never claim onchain finality from verify alone
5. Document EOA-only nanopayment constraint
