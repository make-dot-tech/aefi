#!/usr/bin/env bash
# Create (or recreate) the Cloudflare Tunnel connector VM.
# After create: SSH in, install cloudflared, login, and configure routes
# (see deploy/README.md Host header table).
set -euo pipefail

PROJECT="${GCP_PROJECT:-aefi-io}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE="${TUNNEL_INSTANCE:-cloudflared-tunnel}"

if gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --project="$PROJECT" >/dev/null 2>&1; then
  echo "instance $INSTANCE already exists in $ZONE"
  exit 0
fi

gcloud compute instances create "$INSTANCE" \
  --project="$PROJECT" \
  --zone="$ZONE" \
  --machine-type=e2-micro \
  --network-interface=network-tier=PREMIUM,stack-type=IPV4_ONLY,subnet=default \
  --metadata=enable-osconfig=TRUE \
  --tags=cloudflared \
  --create-disk=auto-delete=yes,boot=yes,device-name="$INSTANCE",image=projects/debian-cloud/global/images/family/debian-12,mode=rw,size=10,type=pd-balanced \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --labels=app=aefi,role=cloudflared

echo "Created $INSTANCE. Next:"
echo "  1. gcloud compute ssh $INSTANCE --zone=$ZONE --project=$PROJECT"
echo "  2. Install cloudflared and authenticate to Cloudflare (aefi.io zone)"
echo "  3. Add public hostname routes with HTTP Host Header → each *.run.app service"
echo "  See deploy/README.md"
