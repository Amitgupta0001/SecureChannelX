# ============================================================
# SecureChannelX - Database Restore Script (PowerShell)
# ============================================================
# Restore MongoDB from backup file
# Usage: .\restore-db.ps1 <backup-file>
# ============================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile
)

# Helper functions
function Write-Success { param($Message) Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red; exit 1 }
function Write-Warning { param($Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }

# Check if backup file is provided
if (-not $BackupFile) {
    Write-Host "Usage: .\restore-db.ps1 <backup-file>" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Available backups:" -ForegroundColor Cyan
    
    $backups = Get-ChildItem -Path .\backups -Filter "securechannelx_backup_*.gz" -ErrorAction SilentlyContinue
    if ($backups) {
        $backups | Format-Table Name, Length, LastWriteTime -AutoSize
    } else {
        Write-Host "No backups found" -ForegroundColor Yellow
    }
    exit 1
}

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
}

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#].+?)=(.+)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
}

# Warning
Write-Warning "WARNING: This will replace all current data in the database!"
$response = Read-Host "Are you sure you want to continue? (yes/no)"

if ($response -ne "yes") {
    Write-Success "Restore cancelled"
    exit 0
}

# Check if MongoDB container is running
$mongoStatus = docker-compose ps mongodb | Select-String "Up"
if (-not $mongoStatus) {
    Write-Error "MongoDB container is not running. Start it with: docker-compose up -d mongodb"
}

Write-Success "Starting database restore from: $BackupFile"

# Restore backup
try {
    $mongoUri = $env:MONGODB_URI
    Get-Content $BackupFile -Encoding Byte -ReadCount 0 | 
        docker-compose exec -T mongodb mongorestore --uri="$mongoUri" --archive --gzip
    
    if ($?) {
        Write-Success "✓ Database restored successfully"
        Write-Success "Restarting backend to refresh connections..."
        docker-compose restart backend
        Write-Success "✓ Restore process completed"
    } else {
        Write-Error "Restore failed"
    }
} catch {
    Write-Error "Restore failed: $_"
}
