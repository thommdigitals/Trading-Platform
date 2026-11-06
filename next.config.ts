import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import { STATIC_SECURITY_HEADERS } from './src/config/security';

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] },
      {
        // fingerprinted assets are immutable
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

