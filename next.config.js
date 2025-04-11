/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: false
  },
  reactStrictMode: true,
  swcMinify: true
}

module.exports = nextConfig
