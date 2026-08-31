module.exports = {
  apps: [
    {
      name: 'findmydonor-backend',
      script: 'dist/server.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        APP_URL: 'https://findmydonor.online',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '350M',
      kill_timeout: 5000,
      listen_timeout: 10000
    },
    {
      name: 'findmydonor-admin',
      script: 'dist/admin-server.cjs',
      env: {
        NODE_ENV: 'production',
        ADMIN_PORT: 6001,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '200M',
      kill_timeout: 5000,
      listen_timeout: 10000
    }
  ]
}
