# ============================================================
# SecureChannelX - Production Deployment Script (PowerShell)
# ============================================================
# Automated deployment script for production environments
# Usage: .\deploy.ps1 [start|stop|restart|update|backup|logs|health]
# ============================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('start','stop','restart','update','backup','logs','health','help')]
    [string]$Command = 'help'
)

# Configuration
$ProjectName = "securechannelx"
$BackupDir = ".\backups"
$LogFile = ".\deployment.log"

# Colors for output
function Write-Success { param($Message) Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red; exit 1 }
function Write-Warning { param($Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }

# Log function
function Write-Log {
    param($Message)
    $LogMessage = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $LogFile -Value $LogMessage
    Write-Host $LogMessage -ForegroundColor Green
}

# Check if Docker is installed
function Test-Docker {
    Write-Info "Checking Docker installation..."
    
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed. Please install Docker Desktop first."
    }
    
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Error "Docker Compose is not installed. Please install Docker Compose first."
    }
    
    Write-Success "Docker and Docker Compose are installed"
}

# Check if .env file exists
function Test-Environment {
    Write-Info "Validating environment configuration..."
    
    if (-not (Test-Path .env)) {
        Write-Error ".env file not found. Please create it from .env.example"
    }
    
    # Check for placeholder values
    $envContent = Get-Content .env -Raw
    if ($envContent -match "CHANGE_THIS") {
        Write-Warning ".env file contains placeholder values. Please update them before deploying."
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -ne 'y' -and $response -ne 'Y') {
            exit 1
        }
    }
    
    Write-Success ".env file exists and configured"
}

# Generate secrets if needed
function New-Secrets {
    Write-Info "Checking secrets..."
    
    $envContent = Get-Content .env
    $needsUpdate = $false
    
    if (-not ($envContent | Select-String "^SECRET_KEY=.+")) {
        $secretKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
        Add-Content -Path .env -Value "SECRET_KEY=$secretKey"
        Write-Success "Generated SECRET_KEY"
        $needsUpdate = $true
    }
    
    if (-not ($envContent | Select-String "^JWT_SECRET_KEY=.+")) {
        $jwtKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
        Add-Content -Path .env -Value "JWT_SECRET_KEY=$jwtKey"
        Write-Success "Generated JWT_SECRET_KEY"
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Write-Warning "Secrets have been generated. Please review your .env file."
    }
}

# Backup database
function Backup-Database {
    Write-Log "Creating database backup..."
    
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupFile = "$BackupDir\mongodb-backup-$timestamp.gz"
    
    docker-compose exec -T mongodb mongodump --archive --gzip | Set-Content -Path $backupFile -Encoding Byte
    
    Write-Success "Backup created: $backupFile"
    
    # Keep only last 7 backups
    Get-ChildItem -Path $BackupDir -Filter "mongodb-backup-*.gz" | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -Skip 7 | 
        Remove-Item -Force
    
    Write-Success "Cleaned up old backups"
}

# Start services
function Start-Services {
    Write-Log "Starting services..."
    
    docker-compose up -d
    
    Write-Info "Waiting for services to be healthy..."
    Start-Sleep -Seconds 10
    
    # Check health
    $unhealthy = docker-compose ps | Select-String "unhealthy"
    if ($unhealthy) {
        Write-Error "Some services are unhealthy. Check logs with: docker-compose logs"
    }
    
    Write-Success "All services started successfully"
    docker-compose ps
}

# Stop services
function Stop-Services {
    Write-Log "Stopping services..."
    
    docker-compose down
    
    Write-Success "All services stopped"
}

# Restart services
function Restart-Services {
    Write-Log "Restarting services..."
    
    Stop-Services
    Start-Services
}

# Update application
function Update-Application {
    Write-Log "Updating application..."
    
    # Backup before update
    Backup-Database
    
    # Pull latest code
    Write-Info "Pulling latest code..."
    try {
        git pull
    } catch {
        Write-Warning "Git pull failed or not a git repository"
    }
    
    # Pull latest images
    Write-Info "Pulling latest Docker images..."
    docker-compose pull
    
    # Rebuild and restart
    Write-Info "Rebuilding containers..."
    docker-compose up -d --build --remove-orphans
    
    # Clean up old images
    Write-Info "Cleaning up old Docker images..."
    docker image prune -f
    
    Write-Success "Update complete"
}

# View logs
function Show-Logs {
    docker-compose logs -f --tail=100
}

# Health check
function Test-Health {
    Write-Log "Running health checks..."
    
    # Backend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "✓ Backend is healthy"
        }
    } catch {
        Write-Error "✗ Backend health check failed"
    }
    
    # Frontend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "✓ Frontend is healthy"
        }
    } catch {
        Write-Warning "✗ Frontend health check failed"
    }
    
    # MongoDB health
    try {
        docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" | Out-Null
        Write-Success "✓ MongoDB is healthy"
    } catch {
        Write-Error "✗ MongoDB health check failed"
    }
    
    # Redis health
    try {
        docker-compose exec -T redis redis-cli ping | Out-Null
        Write-Success "✓ Redis is healthy"
    } catch {
        Write-Warning "✗ Redis health check failed"
    }
    
    Write-Success "Health check complete"
}

# Show usage
function Show-Usage {
    Write-Host @"
SecureChannelX Deployment Script (PowerShell)

Usage: .\deploy.ps1 [COMMAND]

Commands:
    start       Start all services
    stop        Stop all services
    restart     Restart all services
    update      Update application and restart
    backup      Backup database
    logs        View application logs
    health      Run health checks
    help        Show this help message

Examples:
    .\deploy.ps1 start
    .\deploy.ps1 update
    .\deploy.ps1 backup

"@ -ForegroundColor Cyan
}

# Main execution
Test-Docker

switch ($Command) {
    'start' {
        Test-Environment
        New-Secrets
        Start-Services
        Test-Health
    }
    'stop' {
        Stop-Services
    }
    'restart' {
        Restart-Services
        Test-Health
    }
    'update' {
        Update-Application
        Test-Health
    }
    'backup' {
        Backup-Database
    }
    'logs' {
        Show-Logs
    }
    'health' {
        Test-Health
    }
    'help' {
        Show-Usage
    }
    default {
        Write-Error "Unknown command: $Command. Use '.\deploy.ps1 help' for usage information."
    }
}
