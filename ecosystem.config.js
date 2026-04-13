module.exports = {
  apps: [
    {
      name: 'crm-backend',
      cwd: './CRM-BACKEND',
      // Run node directly instead of `npm start` — module-alias
      // requires `-r module-alias/register` which doesn't work
      // in PM2 cluster mode (each worker re-requires from scratch
      // and module-alias paths fail). Fork mode with node_args
      // is the reliable path.
      script: 'dist/index.js',
      node_args: '-r module-alias/register',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      // Graceful shutdown — wait 5s for in-flight requests before force-kill
      kill_timeout: 5000,
      // Restart delay to avoid tight crash loops
      restart_delay: 5000,
      max_restarts: 10,
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
