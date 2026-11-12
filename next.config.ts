import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The moodboard route reads TTFs with `fs` at runtime; trace them into the Vercel function bundle.
  outputFileTracingIncludes: {
    "/api/og/moodboard": ["./public/fonts/**/*"],
  },
};

export default nextConfig;
