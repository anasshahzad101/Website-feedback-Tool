/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint during `next build` adds work and can add parallel tasks; run `npm run lint` locally/CI.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Shared hosts can hit process spawn limits (EAGAIN) during build.
    // Keep worker fan-out low to make production builds stable.
    cpus: 1,
    workerThreads: false,
    // Fewer static-generation workers → fewer child processes during `next build`.
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 999,
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      // Webpack default parallelism is high; cap it for low nproc hosts (e.g. Hostinger).
      config.parallelism = 1;
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
};

module.exports = nextConfig;
