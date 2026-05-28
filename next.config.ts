import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /api/dev/* and /api/dev/run-eval endpoints read from
  // story-gate-eval/ at runtime. Without this, Vercel's file tracing
  // doesn't ship those files with the deployment.
  outputFileTracingIncludes: {
    "/api/dev/specimens": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/expectations.json",
    ],
    "/api/dev/specimens/text": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/expectations.json",
    ],
    "/api/dev/run-eval": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/expectations.json",
    ],
    "/api/dev/revise": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/expectations.json",
    ],
  },
};

export default nextConfig;
