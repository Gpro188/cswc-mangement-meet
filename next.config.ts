import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/manage-cswc-portal/dashboard',
        permanent: true,
      }
    ]
  },
};

export default nextConfig;
