// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,   // ← THIS KILLS THE DOUBLE-MOUNT BUG
};

module.exports = nextConfig;