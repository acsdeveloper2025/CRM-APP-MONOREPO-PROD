module.exports = {
  apps: [
    {
      name: 'crm-backend',
      cwd: './CRM-BACKEND',
      script: 'npm',
      args: 'start',
      instances: 4,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      merge_logs: true
    }
  ]
};
