#!/bin/bash

# Script to add CRM domain entries to /etc/hosts file
# This allows local access to example.com

echo "🌐 Adding CRM domain entries to /etc/hosts..."

# Backup current hosts file
sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)

# Add domain entries pointing to localhost (127.0.0.1)
# This allows testing the domain functionality locally
echo "" | sudo tee -a /etc/hosts
echo "# CRM Domain Resolution (added $(date))" | sudo tee -a /etc/hosts
echo "127.0.0.1 example.com" | sudo tee -a /etc/hosts
echo "127.0.0.1 www.example.com" | sudo tee -a /etc/hosts

echo "✅ Domain entries added successfully!"
echo ""
echo "📋 Current /etc/hosts file:"
cat /etc/hosts
echo ""
echo "🌐 You can now access:"
echo "   - https://example.com (Frontend)"
echo "   - https://example.com:5180 (Mobile)"
echo "   - https://www.example.com (Alternative)"
echo ""
echo "🔧 To test domain functionality:"
echo "   1. Open browser and go to https://example.com"
echo "   2. Check that SSL certificate works"
echo "   3. Test attachment loading in mobile app"
echo ""
echo "🗑️ To remove these entries later:"
echo "   sudo sed -i '/# CRM Domain Resolution/,+2d' /etc/hosts"
