import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  // Keep pdfkit out of the server bundle so it loads from node_modules at
  // runtime and can resolve its own data files (e.g. Helvetica.afm)
  serverExternalPackages: ['pdfkit'],
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
