#!/bin/bash

# ============================================================
# SecureChannelX - Database Backup Script
# ============================================================
# Automated MongoDB backup with rotation
# Can be scheduled with cron for regular backups
# ============================================================

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="securechannelx_backup_${TIMESTAMP}.gz"
RETENTION_DAYS=7

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting MongoDB backup..."

# Check if MongoDB container is running
if ! docker-compose ps mongodb | grep -q "Up"; then
    error "MongoDB container is not running"
fi

# Create backup
log "Creating backup: $BACKUP_FILE"
docker-compose exec -T mongodb mongodump \
    --uri="$MONGODB_URI" \
    --archive --gzip > "$BACKUP_DIR/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    log "✓ Backup created successfully: $BACKUP_DIR/$BACKUP_FILE"
    
    # Get backup size
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    log "Backup size: $SIZE"
else
    error "Backup failed"
fi

# Clean up old backups
log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "securechannelx_backup_*.gz" -type f -mtime +$RETENTION_DAYS -delete

REMAINING=$(ls -1 "$BACKUP_DIR"/securechannelx_backup_*.gz 2>/dev/null | wc -l)
log "✓ Cleanup complete. $REMAINING backup(s) remaining"

# Optional: Upload to cloud storage
if [ -n "$AWS_S3_BUCKET" ]; then
    log "Uploading backup to S3..."
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$AWS_S3_BUCKET/backups/"
    log "✓ Uploaded to S3"
fi

log "Backup process completed successfully"
