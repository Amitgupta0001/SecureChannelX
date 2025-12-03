#!/bin/bash

# ============================================================
# SecureChannelX - Database Restore Script
# ============================================================
# Restore MongoDB from backup file
# Usage: ./restore-db.sh <backup-file>
# ============================================================

set -e

BACKUP_FILE=$1

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/securechannelx_backup_*.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Warning
warn "WARNING: This will replace all current data in the database!"
read -p "Are you sure you want to continue? (yes/no): " -r
echo

if [ "$REPLY" != "yes" ]; then
    log "Restore cancelled"
    exit 0
fi

# Check if MongoDB container is running
if ! docker-compose ps mongodb | grep -q "Up"; then
    error "MongoDB container is not running. Start it with: docker-compose up -d mongodb"
fi

log "Starting database restore from: $BACKUP_FILE"

# Restore backup
docker-compose exec -T mongodb mongorestore \
    --uri="$MONGODB_URI" \
    --archive --gzip < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    log "✓ Database restored successfully"
    log "Restarting backend to refresh connections..."
    docker-compose restart backend
    log "✓ Restore process completed"
else
    error "Restore failed"
fi
