/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export when building for Electron packaging
  output: process.env.NEXT_EXPORT === 'true' ? 'export' : undefined,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
