import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // Don't let `next dev` write assistant instruction files into the repo.
  agentRules: false,
  images: {
    // Profile photos live in Supabase Storage's public `avatars` bucket.
    remotePatterns: supabaseUrl
      ? [new URL(`${supabaseUrl}/storage/v1/object/public/avatars/**`)]
      : [],
  },
};

export default nextConfig;
