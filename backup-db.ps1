# ============================================================
# SecureChannelX - Database Backup Script (PowerShell)
# ============================================================
# Automated MongoDB backup with rotation
# Can be scheduled with Task Scheduler for regular backups
# Usage: .\backup-db.ps1
# ============================================================

# Configuration
$BackupDir = ".\backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "securechannelx_backup_$Timestamp.gz"
$RetentionDays = 7

# Load environment variables from .env file
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#].+?)=(.+)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
}

# Helper functions
function Write-Success { param($Message) Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red; exit 1 }

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Success "Starting MongoDB backup..."

# Check if MongoDB container is running
$mongoStatus = docker-compose ps mongodb | Select-String "Up"
if (-not $mongoStatus) {
    Write-Error "MongoDB container is not running"
}

# Create backup
Write-Success "Creating backup: $BackupFile"
try {
    $mongoUri = $env:MONGODB_URI
    docker-compose exec -T mongodb mongodump --uri="$mongoUri" --archive --gzip | 
        Set-Content -Path "$BackupDir\$BackupFile" -Encoding Byte
    
    if ($?) {
        $size = (Get-Item "$BackupDir\$BackupFile").Length
        $sizeHuman = if ($size -gt 1GB) { "{0:N2} GB" -f ($size / 1GB) } 
                     elseif ($size -gt 1MB) { "{0:N2} MB" -f ($size / 1MB) }
                     else { "{0:N2} KB" -f ($size / 1KB) }
        
        Write-Success "✓ Backup created successfully: $BackupDir\$BackupFile"
        Write-Success "Backup size: $sizeHuman"
    } else {
        Write-Error "Backup failed"
    }
} catch {
    Write-Error "Backup failed: $_"
}

# Clean up old backups
Write-Success "Cleaning up old backups (keeping last $RetentionDays days)..."
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "securechannelx_backup_*.gz" |
    Where-Object { $_.LastWriteTime -lt $cutoffDate } |
    Remove-Item -Force

$remainingBackups = (Get-ChildItem -Path $BackupDir -Filter "securechannelx_backup_*.gz").Count
Write-Success "✓ Cleanup complete. $remainingBackups backup(s) remaining"

# Optional: Upload to cloud storage (S3)
if ($env:AWS_S3_BUCKET) {
    Write-Success "Uploading backup to S3..."
    aws s3 cp "$BackupDir\$BackupFile" "s3://$($env:AWS_S3_BUCKET)/backups/"
    Write-Success "✓ Uploaded to S3"
}

Write-Success "Backup process completed successfully"
