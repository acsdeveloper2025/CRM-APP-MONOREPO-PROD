#!/bin/bash

# Add mobile app route to Nginx configuration for HTTPS access
echo "🔧 Adding mobile app route to Nginx configuration..."

# Backup current configuration
sudo cp /etc/nginx/sites-available/example.com /etc/nginx/sites-available/example.com.backup

# Add mobile app route before the main location block
sudo sed -i '/location \/ {/i\
    # Mobile app route\
    location /mobile {\
        proxy_pass http://127.0.0.1:5180;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_read_timeout 86400;\
        proxy_send_timeout 86400;\
    }\
' /etc/nginx/sites-available/example.com

echo "✅ Mobile app route added to Nginx configuration"

# Test Nginx configuration
echo "🔍 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Reload Nginx
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reloaded successfully"
        echo ""
        echo "🎉 Mobile app is now accessible via:"
        echo "   📱 https://example.com/mobile"
        echo ""
        echo "🔧 The mobile app will now be served over HTTPS, resolving CORS issues"
    else
        echo "❌ Failed to reload Nginx"
        exit 1
    fi
else
    echo "❌ Nginx configuration test failed"
    echo "🔄 Restoring backup configuration..."
    sudo cp /etc/nginx/sites-available/example.com.backup /etc/nginx/sites-available/example.com
    exit 1
fi
