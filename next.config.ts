import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El modo estricto monta el mapa dos veces en desarrollo (dos contextos WebGL).
  reactStrictMode: false,
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/data/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, immutable' }],
      },
    ];
  },
};

export default nextConfig;
