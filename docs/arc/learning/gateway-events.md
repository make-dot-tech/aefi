# Gateway Contract Events

**Status**: Draft
**Last updated**: 2026-08-06

Source: [Contract interfaces and events](https://developers.circle.com/gateway/references/contract-interfaces-and-events). Arc addresses: [contract-addresses.md](./contract-addresses.md).

## Index priority (Aefi)

| Priority | Contract | Events |
| --- | --- | --- |
| P0 | GatewayMinter | `AttestationUsed` |
| P0 | GatewayWallet | `GatewayBurned`, `Deposited`, `DelegateAdded`, `DelegateRemoved` |
| P1 | GatewayWallet | `WithdrawalInitiated`, `WithdrawalCompleted` |
| P2 | Both | `Denylisted`, `UnDenylisted`, `TokenSupported` |

Join key across mint and burn: **`transferSpecHash`** (`keccak256` of encoded `TransferSpec`).

## GatewayWallet events

### `Deposited`

```solidity
event Deposited(address indexed token, address indexed depositor, address indexed sender, uint256 value);
```

`sender == depositor` except for `depositFor` (funder ≠ credited owner).

### `DelegateAdded` / `DelegateRemoved`

```solidity
event DelegateAdded(address indexed token, address indexed depositor, address delegate);
event DelegateRemoved(address indexed token, address indexed depositor, address delegate);
```

Per-token, per-depositor mandate grants. Index as delegated-mandate evidence (chain-scoped).

### `WithdrawalInitiated`

```solidity
event WithdrawalInitiated(
    address indexed token,
    address indexed depositor,
    uint256 value,
    uint256 remainingAvailable,
    uint256 totalWithdrawing,
    uint256 withdrawalBlock
);
```

Trustless 7-day path; `withdrawalBlock` is when completion becomes allowed.

### `WithdrawalCompleted`

```solidity
event WithdrawalCompleted(address indexed token, address indexed depositor, uint256 value);
```

### `GatewayBurned`

```solidity
event GatewayBurned(
    address indexed token,
    address indexed depositor,
    bytes32 indexed transferSpecHash,
    uint32 destinationDomain,
    bytes32 destinationRecipient,
    address signer,
    uint256 value,
    uint256 fee,
    uint256 fromAvailable,
    uint256 fromWithdrawing
);
```

Emitted when Circle burns after a destination mint. `signer` is who authorized (owner or delegate). Fee separated from value.

## GatewayMinter events

### `AttestationUsed`

```solidity
event AttestationUsed(
    address indexed token,
    address indexed recipient,
    bytes32 indexed transferSpecHash,
    uint32 sourceDomain,
    bytes32 sourceDepositor,
    bytes32 sourceSigner,
    uint256 value
);
```

Destination-side mint evidence. `sourceDepositor` / `sourceSigner` are `bytes32` (cross-domain address encoding).

## Aefi correlation recipes

```text
Instant crosschain spend:
  AttestationUsed(transferSpecHash=H) on dest
  ↔ GatewayBurned(transferSpecHash=H) on source(s)
  parties: depositor, signer, recipient, domains, value, fee

Mandate:
  DelegateAdded(depositor, delegate, token) → mandate grant
  DelegateRemoved → revoke signal (intents may still burn until expiry)

Deposit funding:
  Deposited(depositor, sender, value) → balance funding evidence
  (sender≠depositor ⇒ depositFor / third-party fund)
```

## Related reads

- `isTransferSpecHashUsed(bytes32)` on both contracts — replay protection check
- `gatewayMint(attestationPayload, signature)` — mint entrypoint emitting `AttestationUsed`
