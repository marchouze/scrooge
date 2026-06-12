// platform/recon/fil-conformance.ts
//
// `recon:fil-conformance` — the gate that makes "all aspects consistently use
// the FIL language" mechanical rather than aspirational (W9 §7; FIL Framework
// unification §3, check #7).
//
// S0 SCOPE — ADVISORY, ENFORCING-READY. In S0 there are NO facet consumers yet
// (no facet implementations, no FIL-Models declared — those land S7-FIL onward),
// so the implementation-resolution check passes TRIVIALLY (zero consumers ⇒
// zero unresolved). The pipeline is stood up now so it is enforcing-ready when
// consumers land: it folds the FIL-Models register from any
// `FilModelImplementationDeclared` events present, surfaces registry conflicts
// as warnings, and asserts every facet consumer resolves to a registered
// implementation. The §2 legacy-vocabulary inventory (the seed allowlist) and
// the advisory→enforcing ratchet per check-class are W9 §7's rollout — wired in
// later FIL slices (S-FIL-3…6) as the allowlist burns down.
//
// In S0 this pipeline exits 0 (advisory) unless a HARD structural error is
// found (e.g. a malformed declaration event that cannot fold) — it never blocks
// CI on the empty-register baseline.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (one conformance family, §3 / clause
// (vi)); D-V2-BBAAS-BLUEPRINT-SYNTHESIS (S0). Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import { type FilModelsRegister, foldFilModelsRegister } from "../../v2-core/fil-models/registry";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/**
 * Read any declared FIL-Model implementation payloads from the live event
 * store. In S0 there are none — the register folds empty. Reading through the
 * v1 event store here is fine: this is a v1-side recon (the v1→v2 direction is
 * permitted; v2-core itself imports nothing from v1).
 */
function readFilModelsRegister(): FilModelsRegister {
  const payloads: unknown[] = [];
  for (const ev of eventStore.replay({ type: "FilModelImplementationDeclared" })) {
    payloads.push((ev as { payload: unknown }).payload);
  }
  return foldFilModelsRegister(payloads);
}

export function run(): ReconResult {
  const result = emptyResult("fil-conformance");
  const violations: ReconViolation[] = [];

  // Fold the register. A malformed declaration throws inside the fold — that is
  // a HARD error (a registered event the schema cannot parse), surfaced as a
  // fail. The empty-register baseline folds cleanly.
  let register: FilModelsRegister;
  try {
    register = readFilModelsRegister();
  } catch (err) {
    violations.push({
      subject: "FilModelImplementationDeclared",
      message: `declaration event failed to fold: ${(err as Error).message}`,
      severity: "fail",
    });
    return { ...result, asserted: 1, violations, ok: false };
  }

  // Assertion 1 — register integrity: no two models claim the same facet+scope
  // at the same version (the OO single-implementation rule). Advisory in S0.
  result.asserted += 1;
  for (const conflict of register.conflicts) {
    violations.push({
      subject: conflict.key,
      message: `registry conflict: ${conflict.message} (models: ${conflict.modelIds.join(", ")})`,
      severity: "warn", // advisory until the ratchet flips per check-class
    });
  }

  // Assertion 2 — implementation-resolution (check #7): every facet CONSUMER
  // resolves to a registered implementation. In S0 the consumer set is empty
  // (no facet implementations wired into any v2 layer yet), so this passes
  // trivially. The enumeration is a no-op today; it becomes a real join when
  // S7-FIL lands the first consumer (SA-CCR). Stood up here so the wiring is
  // enforcing-ready, not invented later.
  result.asserted += 1;
  const facetConsumers: ReadonlyArray<{ consumer: string; facet: string; scope: string }> = [];
  for (const c of facetConsumers) {
    const resolved = register.rows.some(
      (r) => r.key.facet === c.facet && r.scope.some((s) => s === c.scope),
    );
    if (!resolved) {
      violations.push({
        subject: c.consumer,
        message: `facet consumer ${c.consumer} requires ${c.facet} over ${c.scope} but no registered FIL-Model resolves it`,
        severity: "fail",
      });
    }
  }

  // Advisory gate: only HARD `fail` violations break CI. `warn`s are surfaced
  // but do not fail the build in S0.
  const hardFailures = violations.filter((v) => v.severity === "fail");
  result.violations = violations;
  return { ...result, ok: hardFailures.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const hard = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:fil-conformance (advisory, S0) — asserted ${r.asserted}; ${r.violations.length} finding(s), ${hard} hard\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
