import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /api/dev/* endpoints read from story-gate-eval/ at runtime. Without
  // this, Vercel's file tracing doesn't ship those files with the
  // deployment. Both the main specimens/ corpus and the per-diagnoser
  // experiment specimens need to be included.
  outputFileTracingIncludes: {
    "/api/dev/specimens": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/diagnoser_experiments/**/*",
      "./story-gate-eval/expectations.json",
    ],
    "/api/dev/specimens/text": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/diagnoser_experiments/**/*",
      "./story-gate-eval/expectations.json",
    ],
    "/api/dev/diagnose-by-path": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/diagnoser_experiments/**/*",
      "./story-gate-eval/expectations.json",
    ],
    "/api/dev/revise": [
      "./story-gate-eval/specimens/**/*",
      "./story-gate-eval/diagnoser_experiments/**/*",
      "./story-gate-eval/expectations.json",
    ],
  },
};

export default nextConfig;
