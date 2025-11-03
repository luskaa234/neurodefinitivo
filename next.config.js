/** @type {import('next').NextConfig} */
const withPWAFactory = require('@ducanh2912/next-pwa').default;
const path = require('path');

const withPWA = withPWAFactory({
  dest: 'public', // gera sw.js na pasta public
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  scope: '/app', // evita interceptar _next/*
  fallbacks: {
    document: '/offline.html', // página offline
  },
  runtimeCaching: [
    {
      // Cache de imagens locais e remotas
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|ico|webp|avif)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Cache de arquivos do Supabase
      urlPattern: /^https:\/\/.*\/storage\/v1\/object\/public\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      // Evita cachear rotas internas do Next
      urlPattern: /^\/_next\/.*/i,
      handler: 'NetworkOnly',
    },
  ],
  disable:
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true',
});

module.exports = withPWA({
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  experimental: {
    // optimizeCss desativado para evitar Critters no Vercel
    allowedDevOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.2.51:3000',
    ],
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

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: require.resolve('path-browserify'),
      };
    }
    return config;
  },
});
