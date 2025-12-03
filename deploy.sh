#!/bin/bash

# ============================================================
# SecureChannelX - Production Deployment Script
# ============================================================
# Automated deployment script for production environments
# Usage: ./deploy.sh [start|stop|restart|update|backup]
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="securechannelx"
BACKUP_DIR="./backups"
LOG_FILE="./deployment.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    log "Docker and Docker Compose are installed"
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        error ".env file not found. Please create it from .env.example"
    fi
    
    # Check for placeholder values
    if grep -q "CHANGE_THIS" .env; then
        warn ".env file contains placeholder values. Please update them before deploying."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log ".env file exists and configured"
}

# Generate secrets if needed
generate_secrets() {
    log "Checking secrets..."
    
    if ! grep -q "^SECRET_KEY=" .env || [ -z "$(grep '^SECRET_KEY=' .env | cut -d'=' -f2)" ]; then
        SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
        echo "SECRET_KEY=$SECRET_KEY" >> .env
        log "Generated SECRET_KEY"
    fi
    
    if ! grep -q "^JWT_SECRET_KEY=" .env || [ -z "$(grep '^JWT_SECRET_KEY=' .env | cut -d'=' -f2)" ]; then
        JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
        echo "JWT_SECRET_KEY=$JWT_SECRET_KEY" >> .env
        log "Generated JWT_SECRET_KEY"
    fi
}

# Backup database
backup_database() {
    log "Creating database backup..."
    
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/mongodb-backup-$(date +'%Y%m%d-%H%M%S').gz"
    
    docker-compose exec -T mongodb mongodump --archive --gzip > "$BACKUP_FILE"
    
    log "Backup created: $BACKUP_FILE"
    
    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/mongodb-backup-*.gz | tail -n +8 | xargs -r rm
    log "Cleaned up old backups"
}

# Start services
start_services() {
    log "Starting services..."
    
    docker-compose up -d
    
    log "Waiting for services to be healthy..."
    sleep 10
    
    # Check health
    if docker-compose ps | grep -q "unhealthy"; then
        error "Some services are unhealthy. Check logs with: docker-compose logs"
    fi
    
    log "All services started successfully"
    docker-compose ps
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    docker-compose down
    
    log "All services stopped"
}

# Restart services
restart_services() {
    log "Restarting services..."
    
    stop_services
    start_services
}

# Update application
update_application() {
    log "Updating application..."
    
    # Backup before update
    backup_database
    
    # Pull latest code
    log "Pulling latest code..."
    git pull || warn "Git pull failed or not a git repository"
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose pull
    
    # Rebuild and restart
    log "Rebuilding containers..."
    docker-compose up -d --build --remove-orphans
    
    # Clean up old images
    log "Cleaning up old Docker images..."
    docker image prune -f
    
    log "Update complete"
}

# View logs
view_logs() {
    docker-compose logs -f --tail=100
}

# Health check
health_check() {
    log "Running health checks..."
    
    # Backend health
    if curl -f http://localhost:5000/api/health &> /dev/null; then
        log "✓ Backend is healthy"
    else
        error "✗ Backend health check failed"
    fi
    
    # Frontend health
    if curl -f http://localhost:3000/health &> /dev/null; then
        log "✓ Frontend is healthy"
    else
        warn "✗ Frontend health check failed"
    fi
    
    # MongoDB health
    if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
        log "✓ MongoDB is healthy"
    else
        error "✗ MongoDB health check failed"
    fi
    
    # Redis health
    if docker-compose exec -T redis redis-cli ping &> /dev/null; then
        log "✓ Redis is healthy"
    else
        warn "✗ Redis health check failed"
    fi
    
    log "Health check complete"
}

# Show usage
usage() {
    cat << EOF
SecureChannelX Deployment Script

Usage: $0 [COMMAND]

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
    $0 start
    $0 update
    $0 backup

EOF
}

# Main script
main() {
    check_docker
    
    case "${1:-}" in
        start)
            check_env
            generate_secrets
            start_services
            health_check
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            health_check
            ;;
        update)
            update_application
            health_check
            ;;
        backup)
            backup_database
            ;;
        logs)
            view_logs
            ;;
        health)
            health_check
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            error "Unknown command: ${1:-}. Use '$0 help' for usage information."
            ;;
    esac
}

# Run main function
main "$@"
