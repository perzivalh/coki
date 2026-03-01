import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output mode compatible with Cloudflare Pages
  // Switch to "export" only for fully static. For Cloudflare Pages with Functions:
  // use "standalone" locally; Cloudflare adapter handles edge runtime.
  output: "standalone",
  experimental: {
    // Required for edge runtime compatibility
  },
};

export default nextConfig;
