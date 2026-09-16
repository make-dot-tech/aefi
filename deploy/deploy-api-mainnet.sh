#!/usr/bin/env bash
# Mainnet API/worker deploy is documented, not a one-liner yet.
# See deploy/mainnet.md — wait for published chain id, RPC, and allowlist.
set -euo pipefail

echo "Mainnet is not a flag flip on the testnet trigger." >&2
echo "Playbook: deploy/mainnet.md" >&2
echo "Need: chain id, RPC, ABI pack under services/indexer/abi/<chainId>/," >&2
echo "then separate aefi-indexer-mainnet / aefi-matcher-mainnet services." >&2
exit 1
