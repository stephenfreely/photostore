#!/usr/bin/env bash
# Backup client .env before serverless remove (values become invalid after stack delete).
# Usage: ./scripts/backup-client-env.sh [client-env-path]

set -euo pipefail

CLIENT_ENV="${1:-../photostoreclient/.env}"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/.deploy/env-backups"

if [[ ! -f "$CLIENT_ENV" ]]; then
  echo "No file to backup: ${CLIENT_ENV}" >&2
  exit 0
fi

mkdir -p "$BACKUP_DIR"
backup_file="${BACKUP_DIR}/client-env-$(date -u +"%Y%m%dT%H%M%SZ").env"
cp "$CLIENT_ENV" "$backup_file"
echo "Backed up ${CLIENT_ENV} → ${backup_file}"
