#!/bin/bash

# Nestify Deployment Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="tds-content-factory"
ENVIRONMENT="${1:-production}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment checks
check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ required. Found: $(node -v)"
        exit 1
    fi
    
    log_info "Node.js version: $(node -v) ✓"
}

# Install dependencies
install_deps() {
    log_info "Installing dependencies..."
    npm install
    log_info "Dependencies installed ✓"
}

# Run tests if available
run_tests() {
    log_info "Running tests..."
    if npm run test 2>/dev/null; then
        log_info "Tests passed ✓"
    else
        log_warn "No tests found or tests failed"
    fi
}

# Build application
build_app() {
    log_info "Building application..."
    npm run build
    log_info "Build complete ✓"
}

# Validate configuration
validate_config() {
    log_info "Validating configuration..."
    
    if [ ! -f "nestify.json" ]; then
        log_error "nestify.json not found"
        exit 1
    fi
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        log_warn ".env file not found. Using .env.example"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_warn "Created .env from .env.example - please update with your values"
        fi
    fi
    
    log_info "Configuration valid ✓"
}

# Create data directory if needed
setup_data_dir() {
    if [ ! -d "/data" ]; then
        log_warn "Data directory /data not found (expected on Nestify)"
        log_info "Creating local data directory for development..."
        mkdir -p ./data
    fi
}

# Main deployment process
main() {
    echo "========================================"
    echo "  Deploying $APP_NAME to Nestify"
    echo "  Environment: $ENVIRONMENT"
    echo "========================================"
    echo
    
    check_requirements
    validate_config
    install_deps
    run_tests
    build_app
    setup_data_dir
    
    echo
    log_info "Deployment preparation complete!"
    echo
    echo "Next steps:"
    echo "  1. Push to your Git repository"
    echo "  2. Connect repository to Nestify"
    echo "  3. Set environment variables in Nestify dashboard"
    echo "  4. Deploy from Nestify dashboard or CLI"
    echo
    echo "Or deploy manually:"
    echo "  nestify deploy --env $ENVIRONMENT"
    echo
}

# Run main function
main "$@"
