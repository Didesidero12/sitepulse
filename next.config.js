/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force Next.js to show 127.0.0.1 in terminal
  devIndicators: {
    buildActivity: false,
  },
  // This makes it show 127.0.0.1 instead of localhost
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

// Or just remember: localhost = dead, 127.0.0.1 = alive

module.exports = nextConfig;