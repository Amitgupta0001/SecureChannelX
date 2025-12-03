# ============================================================
# SecureChannelX - Environment Setup Script (PowerShell)
# ============================================================
# Automated environment configuration
# Usage: .\setup-env.ps1
# ============================================================

Write-Host "SecureChannelX - Environment Setup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path .env) {
    Write-Host ".env file already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to overwrite it? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "Setup cancelled. Existing .env file preserved." -ForegroundColor Green
        exit 0
    }
}

# Copy template
if (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Host "✓ Created .env from template" -ForegroundColor Green
} else {
    Write-Host "✗ .env.example not found!" -ForegroundColor Red
    exit 1
}

# Generate secrets
Write-Host ""
Write-Host "Generating secure secrets..." -ForegroundColor Cyan

function New-RandomSecret {
    param([int]$Length = 64)
    -join ((65..90) + (97..122) + (48..57) | Get-Random -Count $Length | ForEach-Object {[char]$_})
}

$secretKey = New-RandomSecret
$jwtSecretKey = New-RandomSecret

# Update .env file
$envContent = Get-Content .env
$envContent = $envContent -replace "SECRET_KEY=.*", "SECRET_KEY=$secretKey"
$envContent = $envContent -replace "JWT_SECRET_KEY=.*", "JWT_SECRET_KEY=$jwtSecretKey"
$envContent | Set-Content .env

Write-Host "✓ Generated SECRET_KEY" -ForegroundColor Green
Write-Host "✓ Generated JWT_SECRET_KEY" -ForegroundColor Green

# Interactive configuration
Write-Host ""
Write-Host "Database Configuration" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

$mongoPassword = Read-Host "MongoDB Root Password" -AsSecureString
$mongoPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mongoPassword))

$redisPassword = Read-Host "Redis Password" -AsSecureString
$redisPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($redisPassword))

# Update passwords
$envContent = Get-Content .env
$envContent = $envContent -replace "MONGO_ROOT_PASSWORD=.*", "MONGO_ROOT_PASSWORD=$mongoPasswordPlain"
$envContent = $envContent -replace "REDIS_PASSWORD=.*", "REDIS_PASSWORD=$redisPasswordPlain"
$envContent = $envContent -replace "MONGODB_URI=.*", "MONGODB_URI=mongodb://admin:$mongoPasswordPlain@mongodb:27017/securechannelx?authSource=admin"
$envContent = $envContent -replace "REDIS_URL=.*", "REDIS_URL=redis://:$redisPasswordPlain@redis:6379/0"
$envContent | Set-Content .env

Write-Host "✓ Database credentials configured" -ForegroundColor Green

# Email configuration (optional)
Write-Host ""
Write-Host "Email Configuration (Optional - Press Enter to skip)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$mailUsername = Read-Host "Email Username (e.g., your-email@gmail.com)"
if ($mailUsername) {
    $mailPassword = Read-Host "Email Password (App-specific password)" -AsSecureString
    $mailPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mailPassword))
    
    $envContent = Get-Content .env
    $envContent = $envContent -replace "MAIL_USERNAME=.*", "MAIL_USERNAME=$mailUsername"
    $envContent = $envContent -replace "MAIL_PASSWORD=.*", "MAIL_PASSWORD=$mailPasswordPlain"
    $envContent | Set-Content .env
    
    Write-Host "✓ Email configuration saved" -ForegroundColor Green
} else {
    Write-Host "⊘ Email configuration skipped" -ForegroundColor Yellow
}

# Frontend URL configuration
Write-Host ""
Write-Host "Frontend URL Configuration" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan

$useProduction = Read-Host "Is this for production deployment? (y/N)"
if ($useProduction -eq 'y' -or $useProduction -eq 'Y') {
    $domain = Read-Host "Enter your domain (e.g., example.com)"
    
    $envContent = Get-Content .env
    $envContent = $envContent -replace "FRONTEND_URL=.*", "FRONTEND_URL=https://$domain"
    $envContent = $envContent -replace "VITE_API_BASE_URL=.*", "VITE_API_BASE_URL=https://api.$domain"
    $envContent = $envContent -replace "VITE_SOCKET_URL=.*", "VITE_SOCKET_URL=https://api.$domain"
    $envContent | Set-Content .env
    
    Write-Host "✓ Production URLs configured" -ForegroundColor Green
} else {
    Write-Host "⊘ Using default localhost URLs" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Environment Setup Complete! ✓" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration saved to: .env" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review your .env file" -ForegroundColor White
Write-Host "  2. Deploy with: .\deploy.ps1 start" -ForegroundColor White
Write-Host "  3. Check health: .\deploy.ps1 health" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see docs/QUICKSTART.md" -ForegroundColor Yellow
