import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phone / LAN opens http://192.168.x.x:3003 — allow Next assets in dev
  allowedDevOrigins: ['192.168.8.75', '127.0.0.1', 'localhost'],
  async rewrites() {
    return [{
      source: '/client-api/:path*',
      destination: `${process.env.CLIENT_API_ORIGIN ?? 'http://127.0.0.1:3002'}/client-api/:path*`,
    }];
  },
};

export default nextConfig;
