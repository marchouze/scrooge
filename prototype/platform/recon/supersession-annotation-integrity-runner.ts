// platform/recon/supersession-annotation-integrity-runner.ts
//
// CLI runner for `recon:supersession-annotation-integrity`.
// Called by `bun run recon:supersession-annotation-integrity` and from
// the `ci` script.
//
// Authority: Vera Wave-5 (session 2026-05-11).
// Author: Vera (Internal audit engineer, third-line)

import { logger } from "../composition";
import { run } from "./supersession-annotation-integrity";

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
