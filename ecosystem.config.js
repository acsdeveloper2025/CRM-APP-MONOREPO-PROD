module.exports = {
  apps: [
    {
      name: 'crm-backend',
      cwd: './CRM-BACKEND',
      script: 'dist/index.js',
      node_args: '-r module-alias/register',
      instances: 4,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      // Graceful shutdown — wait 5s for in-flight requests before force-kill
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Log rotation — prevent unbounded log growth
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      merge_logs: true,
      // Rotate logs when they exceed 50MB
      max_size: '50M',
      // Keep 10 rotated log files
      retain: 10,
    }
  ]
};
