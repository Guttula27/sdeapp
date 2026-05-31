// PM2 process config for the paynpik API.
// Edit instances/exec_mode if you want to fork-cluster.
module.exports = {
  apps: [
    {
      name: 'paynpik-api',
      script: 'dist/src/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
      },
      max_memory_restart: '512M',
      out_file: 'logs/out.log',
      error_file: 'logs/err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
