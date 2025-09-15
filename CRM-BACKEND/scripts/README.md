# Utility Scripts

This directory contains utility scripts for development, deployment, and maintenance tasks.

## Common Scripts

- `setup.sh` - Initial project setup
- `deploy.sh` - Deployment script
- `backup.sh` - Database backup script
- `migrate.sh` - Database migration script
- `seed.sh` - Database seeding script
- `cleanup.sh` - Cleanup temporary files

## Usage

Make scripts executable before running:
```bash
chmod +x scripts/script-name.sh
./scripts/script-name.sh
```

## Guidelines

- Use bash for shell scripts
- Add proper error handling
- Include usage documentation in script headers
- Test scripts in development environment first
