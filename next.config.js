const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress the Sentry CLI output in CI/dev unless debugging
  silent: !process.env.CI,

  // Upload source maps to Sentry for readable stack traces in prod
  widenClientFileUpload: true,

  // Hide source maps from the browser bundle
  hideSourceMaps: true,

  // Disable ad-blocker-friendly tunnel by default (enable if needed)
  tunnelRoute: undefined,

  // Disable automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: false,
});
