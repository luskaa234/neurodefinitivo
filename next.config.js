/** @type {import('next').NextConfig} */
const isProd = process.env.VERCEL === '1';

let withPWA = (config) => config;

// ✅ PWA habilitado em produção para offline
if (isProd) {
  const withPWAFactory = require('@ducanh2912/next-pwa').default;

  withPWA = withPWAFactory({
    dest: 'public',
    register: true,
    skipWaiting: true,
    reloadOnOnline: true,
    disable: false,
    customWorkerSrc: 'worker',
    fallbacks: {
      document: '/offline.html',
    },
  });
}

module.exports = withPWA({
  reactStrictMode: false,

  // ✅ resolve o erro do Turbopack
  turbopack: {},

  // ✅ isso NÃO pode mais ficar aqui no Next 16
  // eslint: { ignoreDuringBuilds: true }, ❌ removido

  // ⚠️ permitido, mas use com cuidado
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },

  serverExternalPackages: ['@supabase/supabase-js'],
});
