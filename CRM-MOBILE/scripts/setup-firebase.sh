#!/bin/bash

# 🔥 Firebase Setup Script for CaseFlow Mobile
# This script helps set up Firebase configuration files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$MOBILE_DIR")"

print_header "Firebase Setup for CaseFlow Mobile"

print_info "Mobile Directory: $MOBILE_DIR"
print_info "Project Root: $PROJECT_ROOT"

# Check if we're in the right directory
if [ ! -f "$MOBILE_DIR/capacitor.config.ts" ]; then
    print_error "capacitor.config.ts not found. Please run this script from the CRM-MOBILE directory."
    exit 1
fi

# Function to check if Firebase config files exist
check_firebase_files() {
    print_header "Checking Firebase Configuration Files"
    
    local android_config="$MOBILE_DIR/android/app/google-services.json"
    local ios_config="$MOBILE_DIR/ios/App/GoogleService-Info.plist"
    local env_config="$MOBILE_DIR/.env.production"
    
    local files_missing=false
    
    # Check Android config
    if [ -f "$android_config" ]; then
        print_success "Android Firebase config found: google-services.json"
    else
        print_warning "Android Firebase config missing: google-services.json"
        files_missing=true
    fi
    
    # Check iOS config
    if [ -f "$ios_config" ]; then
        print_success "iOS Firebase config found: GoogleService-Info.plist"
    else
        print_warning "iOS Firebase config missing: GoogleService-Info.plist"
        files_missing=true
    fi
    
    # Check environment config
    if [ -f "$env_config" ]; then
        print_success "Environment config found: .env.production"
    else
        print_warning "Environment config missing: .env.production"
        files_missing=true
    fi
    
    return $files_missing
}

# Function to setup environment file
setup_env_file() {
    print_header "Setting up Environment Configuration"
    
    local env_template="$MOBILE_DIR/.env.firebase.template"
    local env_production="$MOBILE_DIR/.env.production"
    
    if [ ! -f "$env_template" ]; then
        print_error "Environment template not found: .env.firebase.template"
        return 1
    fi
    
    if [ -f "$env_production" ]; then
        print_warning ".env.production already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping environment file setup"
            return 0
        fi
    fi
    
    cp "$env_template" "$env_production"
    print_success "Created .env.production from template"
    print_warning "Please edit .env.production and fill in your actual Firebase values"
    
    return 0
}

# Function to validate Firebase setup
validate_firebase_setup() {
    print_header "Validating Firebase Setup"
    
    local android_config="$MOBILE_DIR/android/app/google-services.json"
    local validation_passed=true
    
    # Check if Android config has real values
    if [ -f "$android_config" ]; then
        if grep -q "YOUR_PROJECT_ID" "$android_config"; then
            print_error "Android config still contains template values"
            validation_passed=false
        else
            print_success "Android config appears to have real values"
        fi
    fi
    
    # Check environment file
    local env_production="$MOBILE_DIR/.env.production"
    if [ -f "$env_production" ]; then
        if grep -q "your-project-id" "$env_production"; then
            print_error "Environment config still contains template values"
            validation_passed=false
        else
            print_success "Environment config appears to have real values"
        fi
    fi
    
    if [ "$validation_passed" = true ]; then
        print_success "Firebase setup validation passed"
        return 0
    else
        print_error "Firebase setup validation failed"
        return 1
    fi
}

# Function to show next steps
show_next_steps() {
    print_header "Next Steps"
    
    echo "1. Create Firebase Project:"
    echo "   - Go to https://console.firebase.google.com/"
    echo "   - Create a new project: 'CaseFlow-Mobile-Prod'"
    echo ""
    echo "2. Add Android App:"
    echo "   - Package name: com.caseflow.mobile"
    echo "   - Download google-services.json"
    echo "   - Replace: $MOBILE_DIR/android/app/google-services.json"
    echo ""
    echo "3. Add iOS App (optional):"
    echo "   - Bundle ID: com.caseflow.mobile"
    echo "   - Download GoogleService-Info.plist"
    echo "   - Replace: $MOBILE_DIR/ios/App/GoogleService-Info.plist"
    echo ""
    echo "4. Configure Environment:"
    echo "   - Edit: $MOBILE_DIR/.env.production"
    echo "   - Fill in your Firebase project values"
    echo ""
    echo "5. Enable Firebase Services:"
    echo "   - Authentication (Email/Password)"
    echo "   - Cloud Messaging"
    echo "   - Firestore (optional)"
    echo ""
    echo "6. Test Setup:"
    echo "   - Run: npm run build"
    echo "   - Run: npx cap sync android"
    echo "   - Run: npx cap run android"
    echo ""
    echo "For detailed instructions, see: $MOBILE_DIR/FIREBASE_SETUP.md"
}

# Main execution
main() {
    # Check current Firebase files
    if check_firebase_files; then
        print_success "All Firebase configuration files are present"
        
        # Validate setup
        if validate_firebase_setup; then
            print_success "Firebase setup appears to be complete and valid"
        else
            print_warning "Firebase setup needs attention"
        fi
    else
        print_warning "Some Firebase configuration files are missing"
        
        # Setup environment file
        setup_env_file
    fi
    
    # Always show next steps
    show_next_steps
    
    print_header "Firebase Setup Complete"
    print_info "For support, see: $MOBILE_DIR/FIREBASE_SETUP.md"
}

# Run main function
main "$@"
