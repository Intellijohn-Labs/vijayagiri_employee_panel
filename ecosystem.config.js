module.exports = {
  apps: [
    {
      name: "vijayagiri-employee",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      exec_mode: "cluster",
      instances: "max",
      max_memory_restart: "1G",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: 3006,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
