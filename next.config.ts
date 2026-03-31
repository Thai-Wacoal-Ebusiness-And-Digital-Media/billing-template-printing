import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit out of the server bundle so it loads from node_modules at
  // runtime and can resolve its own data files (e.g. Helvetica.afm)
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;
