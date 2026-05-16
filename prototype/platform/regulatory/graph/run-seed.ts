// platform/regulatory/graph/run-seed.ts
//
// Entry-point for `bun run graph:seed`.
// Runs the seed projection and prints stats as JSON.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { runSeed } from "./seed-projection";

const stats = await runSeed();
console.log(JSON.stringify(stats, null, 2));
