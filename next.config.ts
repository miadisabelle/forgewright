import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["kuzu", "smcraft"],
  },
};

export default nextConfig;
