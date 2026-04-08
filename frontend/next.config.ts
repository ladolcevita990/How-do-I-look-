import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow any Supabase project's storage CDN. Users configure which one
    // via NEXT_PUBLIC_SUPABASE_URL, so we can't hardcode a single hostname.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
    ],
  },
};

export default nextConfig;
