/** @type {import('next').NextConfig} */
const isProd = process.env.VERCEL === '1';

let withPWA = (config) => config;

// ⚠️ next-pwa ainda não é compatível com Next 15 em produção
if (!isProd) {
  const withPWAFactory = require('@ducanh2912/next-pwa').default;

  withPWA = withPWAFactory({
    dest: 'public',
    register: true,
    skipWaiting: true,
    reloadOnOnline: true,
    disable: false,
  });
}

module.exports = withPWA({
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

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
