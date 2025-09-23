#!/bin/bash

# 🔥 Firebase Configuration Script
# This script helps configure Firebase with your project values

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_header "Firebase Configuration Helper"

# Function to collect Firebase values
collect_firebase_values() {
    print_header "Firebase Project Configuration"
    
    echo "Please provide your Firebase project values:"
    echo "(You can find these in your Firebase project settings)"
    echo ""
    
    read -p "Project ID: " PROJECT_ID
    read -p "Project Number: " PROJECT_NUMBER
    read -p "Web API Key: " API_KEY
    read -p "Mobile SDK App ID (Android): " MOBILE_SDK_APP_ID
    read -p "Client ID: " CLIENT_ID
    read -p "Messaging Sender ID: " MESSAGING_SENDER_ID
    read -p "App ID: " APP_ID
    
    echo ""
    print_info "Configuration collected:"
    print_info "  Project ID: $PROJECT_ID"
    print_info "  Project Number: $PROJECT_NUMBER"
    print_info "  API Key: ${API_KEY:0:10}..."
    print_info "  Mobile SDK App ID: $MOBILE_SDK_APP_ID"
    print_info "  Messaging Sender ID: $MESSAGING_SENDER_ID"
    print_info "  App ID: $APP_ID"
    
    echo ""
    read -p "Is this information correct? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Configuration cancelled"
        exit 1
    fi
}

# Function to create google-services.json
create_android_config() {
    print_header "Creating Android Configuration"
    
    local android_config="$MOBILE_DIR/android/app/google-services.json"
    
    cat > "$android_config" << EOF
{
  "project_info": {
    "project_number": "$PROJECT_NUMBER",
    "project_id": "$PROJECT_ID",
    "storage_bucket": "$PROJECT_ID.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "$MOBILE_SDK_APP_ID",
        "android_client_info": {
          "package_name": "com.caseflow.mobile"
        }
      },
      "oauth_client": [
        {
          "client_id": "$CLIENT_ID",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "$API_KEY"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [
            {
              "client_id": "$CLIENT_ID",
              "client_type": 3
            }
          ]
        }
      }
    }
  ],
  "configuration_version": "1"
}
EOF

    print_success "Created: $android_config"
}

# Function to create .env.production
create_env_config() {
    print_header "Creating Environment Configuration"
    
    local env_config="$MOBILE_DIR/.env.production"
    
    cat > "$env_config" << EOF
# Firebase Configuration for Production
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
VITE_FIREBASE_API_KEY=$API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$PROJECT_ID.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=$PROJECT_ID.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=$MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=$APP_ID

# Environment
VITE_ENVIRONMENT=production
VITE_APP_NAME=CaseFlow Mobile
VITE_APP_VERSION=1.0.0
EOF

    print_success "Created: $env_config"
}

# Function to validate configuration
validate_config() {
    print_header "Validating Configuration"
    
    local android_config="$MOBILE_DIR/android/app/google-services.json"
    local env_config="$MOBILE_DIR/.env.production"
    
    if [ -f "$android_config" ] && [ -f "$env_config" ]; then
        print_success "All configuration files created successfully"
        
        # Test if files contain real values
        if grep -q "$PROJECT_ID" "$android_config" && grep -q "$PROJECT_ID" "$env_config"; then
            print_success "Configuration files contain expected values"
        else
            print_error "Configuration files may not contain correct values"
        fi
    else
        print_error "Some configuration files are missing"
    fi
}

# Function to show next steps
show_next_steps() {
    print_header "Next Steps"
    
    echo "1. Test the configuration:"
    echo "   cd $MOBILE_DIR"
    echo "   npm run build:prod"
    echo ""
    echo "2. Sync with Capacitor:"
    echo "   npx cap sync android"
    echo ""
    echo "3. Run on Android:"
    echo "   npx cap run android"
    echo ""
    echo "4. Check Firebase Console:"
    echo "   - Go to https://console.firebase.google.com/"
    echo "   - Check if your app appears in the project"
    echo "   - Monitor authentication and messaging"
    echo ""
    print_success "Firebase configuration complete!"
}

# Main execution
main() {
    collect_firebase_values
    create_android_config
    create_env_config
    validate_config
    show_next_steps
}

# Run main function
main "$@"
