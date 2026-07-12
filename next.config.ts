import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Recipe photos come from Spoonacular. next/image blocks remote hosts
    // unless they are allow-listed here.
    remotePatterns: [
      { protocol: "https", hostname: "img.spoonacular.com" },
      { protocol: "https", hostname: "spoonacular.com" },
    ],
  },
};

export default nextConfig;
