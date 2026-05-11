// platform/recon/goal-loop-capability-runner.ts
//
// CLI runner for `recon:goal-loop-capability`.
// Called by `bun run recon:goal-loop-capability` and from the ci script.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3

import { logger } from "../composition";
import { run } from "./goal-loop-capability";

const result = run();

if (result.violations.length > 0) {
  const severity = result.ok ? "warn" : "fail";
  logger[severity === "fail" ? "error" : "warn"](
    {
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      ok: result.ok,
      detail: result.violations,
    },
    `${result.pipeline}: ${result.violations.filter((v) => v.severity === "fail").length} fail(s), ${result.violations.filter((v) => v.severity === "warn").length} warn(s)`,
  );
} else {
  logger.info(
    {
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: 0,
      ok: result.ok,
    },
    `${result.pipeline}: passed`,
  );
}

process.exit(result.ok ? 0 : 1);
