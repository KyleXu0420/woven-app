import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide Next's dev overlay indicator — it floats bottom-left and sits on top of the
  // sidebar account card, obscuring the avatar. Dev-only chrome, never in production;
  // compile status/errors are read from the terminal instead.
  devIndicators: false,
};

export default nextConfig;
