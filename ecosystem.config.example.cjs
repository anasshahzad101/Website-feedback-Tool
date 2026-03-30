/**
 * PM2 — copy to ecosystem.config.cjs, adjust paths and env, then:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "website-feedback-tool",
      cwd: "/var/www/website-feedback-tool",
      script: "npm",
      args: "run start",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0",
        // Must match what nginx/OpenLiteSpeed proxies to (Hostinger often sets PORT for you).
        PORT: "3002",
        // Optional: raise if the app OOMs (scripts/next-start.mjs defaults to 512).
        // NODE_HEAP_MB: "768",
      },
      // Or load all vars from a file (install dotenv-cli or use bash wrapper):
      // env_file: ".env",
    },
  ],
};
