/**
 * PM2: API (Nest) и Next.js CRM.
 * Порты: API 3000, Next 3001 — как в nginx-примере.
 */
const path = require("path");

const root = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "oyna-api",
      cwd: path.join(root, "backend"),
      script: "npm",
      args: "run start:prod",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "oyna-web",
      cwd: path.join(root, "frontend"),
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
