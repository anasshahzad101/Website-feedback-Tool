/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Shared hosts can hit process spawn limits (EAGAIN) during build.
    // Keep worker fan-out low to make production builds stable.
    cpus: 1,
    workerThreads: false,
    serverActions: {
      bodySizeLimit: '50mb',
    },
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
