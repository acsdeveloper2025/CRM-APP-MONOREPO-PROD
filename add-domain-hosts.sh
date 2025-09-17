#!/bin/bash

# Script to add CRM domain entries to /etc/hosts file
# This allows local access to crm.allcheckservices.com

echo "🌐 Adding CRM domain entries to /etc/hosts..."

# Backup current hosts file
sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)

# Add domain entries pointing to localhost (127.0.0.1)
# This allows testing the domain functionality locally
echo "" | sudo tee -a /etc/hosts
echo "# CRM Domain Resolution (added $(date))" | sudo tee -a /etc/hosts
echo "127.0.0.1 crm.allcheckservices.com" | sudo tee -a /etc/hosts
echo "127.0.0.1 www.crm.allcheckservices.com" | sudo tee -a /etc/hosts

echo "✅ Domain entries added successfully!"
echo ""
echo "📋 Current /etc/hosts file:"
cat /etc/hosts
echo ""
echo "🌐 You can now access:"
echo "   - https://crm.allcheckservices.com (Frontend)"
echo "   - https://crm.allcheckservices.com:5180 (Mobile)"
echo "   - https://www.crm.allcheckservices.com (Alternative)"
echo ""
echo "🔧 To test domain functionality:"
echo "   1. Open browser and go to https://crm.allcheckservices.com"
echo "   2. Check that SSL certificate works"
echo "   3. Test attachment loading in mobile app"
echo ""
echo "🗑️ To remove these entries later:"
echo "   sudo sed -i '/# CRM Domain Resolution/,+2d' /etc/hosts"
