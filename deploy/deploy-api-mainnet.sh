#!/usr/bin/env bash
# Stub: deploy a mainnet-side API once Arc mainnet ABI/RPC exist.
# Mirrors urge's deploy-api-testnet.sh pattern (separate service, shared data).
set -euo pipefail

echo "Mainnet deploy is not enabled yet (no mainnet ABI pack)." >&2
echo "When ready: clone aefi-api → aefi-api-mainnet with ARC_CHAIN_ID=<mainnet>," >&2
echo "separate indexer/matcher services, same AEFI-DATABASE-URL + Aura secrets." >&2
exit 1
