import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent Next.js from bundling pdfkit — it must load from node_modules
      // at runtime so it can resolve its data files (e.g. Helvetica.afm)
      const externals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [...externals, 'pdfkit'];
    }
    return config;
  },
};

export default nextConfig;
