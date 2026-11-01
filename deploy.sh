#!/usr/bin/env bash
# Build the portal and upload dist/ to the CloudPanel site over SSH.
# Usage: SSH_USER=<site-user> SSH_HOST=<server-ip-or-host> ./deploy.sh
set -euo pipefail

: "${SSH_USER:?set SSH_USER to the CloudPanel site user}"
: "${SSH_HOST:?set SSH_HOST to the server IP or hostname}"
DOMAIN="${DOMAIN:-my.centralnetworks.co.ke}"
REMOTE_DIR="${REMOTE_DIR:-/home/$SSH_USER/htdocs/$DOMAIN}"

cd "$(dirname "$0")"
npm ci
npm run build

rsync -avz --delete dist/ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"
echo "Deployed to https://$DOMAIN"
