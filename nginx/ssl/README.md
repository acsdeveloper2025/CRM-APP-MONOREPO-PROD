# SSL Certificate Directory

This directory should contain your SSL certificates for production deployment.

## Required Files:
- `example.com.crt` - SSL certificate
- `example.com.key` - Private key
- `ca-bundle.crt` - Certificate authority bundle (if required)

## Setup Instructions:
1. Obtain SSL certificate from your certificate authority
2. Place certificate files in this directory
3. Update nginx configuration if needed
4. Restart nginx service

## Security Note:
- Keep private keys secure and never commit them to version control
- Set appropriate file permissions (600 for private keys)
- Regularly renew certificates before expiration
