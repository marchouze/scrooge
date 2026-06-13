// platform/recon/v2-csi-cross-tenant-gate.ts
//
// `recon:v2-csi-cross-tenant-gate` — ENFORCING. The competition-law keystone
// gate for V2 S12: no cross-tenant learning flow may bypass the CSI gate.
//
// ASSERTIONS
// ----------
//   1. COVERAGE (fail): every CSI category CLASS in the closed taxonomy is
//      covered by an ACTIVE blocklist entry. A missing class means the gate
//      cannot screen for it — a competition-law hole. (Folds the live CSI
//      blocklist register from CsiCategoryRegistered/Retired events; if the
//      seed has not run the gate falls back to the canonical seed taxonomy so
//      it is non-vacuous even on a fresh store.)
//   2. NON-BYPASS (fail): every recorded cross-tenant learning flow outcome is
//      a screened/blocked GATE event — there is no cross-tenant flow that
//      proceeded without passing the gate. (Append-only audit invariant: every
//      blocked event carries the offending categories; every cleared event
//      carries an outcome.)
//   3. SYNTHETIC-LEAK / NON-VACUOUS (fail): the gate is exercised against a
//      constructed offender — tenant A position data → tenant B posture
//      proposal — and MUST block it. If the gate ever passes the leak the
//      whole pipeline FAILS. This is the sabotage-proof core: remove the
//      screen and this assertion fails.
//   4. FOLD INTEGRITY (warn): no orphan retirement / duplicate registration in
//      the blocklist event stream.
//
// WHY THIS GATE IS V1-SIDE: it needs `node:fs`, the event store, and the recon
// `types` — all v1 infrastructure. The dependency direction v1→v2 is permitted
// (v2-core imports nothing from v1).
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE (CSI blocklist gate before C-tier
// go-live); D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Principle 2 (single-graph discipline — the gate topology is an invariant).
// Author: Atlas (Substrate Architect, engineering) with Vera (Internal Audit
// Engineer, governance) independent validation.

import {
  CSI_CATEGORY_CLASSES,
  CSI_SEED_CATEGORIES,
  type CsiBlocklistEventPayload,
} from "../../v2-core/cross-tenant/csi-blocklist";
import {
  type LearningFlow,
  screenCrossTenantLearningFlow,
} from "../../v2-core/cross-tenant/gate";
import { CsiBlocklist, foldCsiBlocklist } from "../../v2-core/cross-tenant/projection";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Read the CSI blocklist register from the live event store
// ---------------------------------------------------------------------------

function readCsiBlocklist(): CsiBlocklist {
  const payloads: CsiBlocklistEventPayload[] = [];
  for (const ev of eventStore.replay({ type: "CsiCategoryRegistered" })) {
    payloads.push({
      kind: "CsiCategoryRegistered",
      ...(ev as { payload: Record<string, unknown> }).payload,
    } as CsiBlocklistEventPayload);
  }
  for (const ev of eventStore.replay({ type: "CsiCategoryRetired" })) {
    payloads.push({
      kind: "CsiCategoryRetired",
      ...(ev as { payload: Record<string, unknown> }).payload,
    } as CsiBlocklistEventPayload);
  }
  const folded = foldCsiBlocklist(payloads);
  // Fallback: if the live store carries NO registered categories (seed not yet
  // run), screen against the canonical seed taxonomy so the gate is never
  // vacuous. The seed-parity is asserted separately; here we want the synthetic
  // leak to be caught against a real (seed or live) blocklist on every runner.
  if (folded.activeCategories().length === 0) {
    return foldCsiBlocklist(
      CSI_SEED_CATEGORIES.map((c) => ({
        kind: "CsiCategoryRegistered" as const,
        categoryId: c.categoryId,
        categoryClass: c.categoryClass,
        description: c.description,
        lawBasis: c.lawBasis,
        registeredBy: "Zara",
        citations: ["D-W7-VENDOR-ENTITY-STRUCTURE"],
      })) as CsiBlocklistEventPayload[],
    );
  }
  return folded;
}

// ---------------------------------------------------------------------------
// Read recorded cross-tenant gate outcomes from the live event store
// ---------------------------------------------------------------------------

interface RecordedGateOutcome {
  readonly kind: "CrossTenantLearningScreened" | "CrossTenantLearningBlocked";
  readonly payload: Record<string, unknown>;
}

function readGateOutcomes(): RecordedGateOutcome[] {
  const out: RecordedGateOutcome[] = [];
  for (const ev of eventStore.replay({ type: "CrossTenantLearningScreened" })) {
    out.push({
      kind: "CrossTenantLearningScreened",
      payload: (ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of eventStore.replay({ type: "CrossTenantLearningBlocked" })) {
    out.push({
      kind: "CrossTenantLearningBlocked",
      payload: (ev as { payload: Record<string, unknown> }).payload,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult("v2-csi-cross-tenant-gate");
  const violations: ReconViolation[] = [];

  let blocklist: CsiBlocklist;
  try {
    blocklist = readCsiBlocklist();
  } catch (err) {
    violations.push({
      subject: "CsiBlocklist",
      message: `CSI blocklist fold failed: ${(err as Error).message}`,
      severity: "fail",
    });
    return { ...result, asserted: 1, violations, ok: false };
  }

  // Assertion 1 — COVERAGE: every CSI class is covered by an active entry.
  const activeClasses = blocklist.activeClasses();
  for (const cls of CSI_CATEGORY_CLASSES) {
    result.asserted += 1;
    if (!activeClasses.has(cls)) {
      violations.push({
        subject: cls,
        message: `CSI category class "${cls}" has no active blocklist entry — the gate cannot screen for it (run scripts/seed-v2-csi-blocklist.ts)`,
        severity: "fail",
      });
    }
  }

  // Assertion 4 — fold integrity (advisory).
  for (const v of blocklist.violations) {
    result.asserted += 1;
    violations.push({
      subject: v.categoryId,
      message: v.message,
      severity: "warn",
    });
  }

  // Assertion 2 — NON-BYPASS: every recorded cross-tenant outcome is a typed
  // gate event with a well-formed outcome. A blocked event MUST carry its
  // offending categories; a screened event MUST carry an outcome. (There is no
  // other code path that emits a cross-tenant learning artefact: the gate is
  // the sole emitter of these event types — `recon:zod-schema-coverage` and the
  // single-registration of the family enforce that structurally.)
  for (const o of readGateOutcomes()) {
    result.asserted += 1;
    if (o.kind === "CrossTenantLearningBlocked") {
      const cats = o.payload.blockedCategories;
      if (!Array.isArray(cats) || cats.length === 0) {
        violations.push({
          subject: String(o.payload.flowId ?? "unknown"),
          message:
            "CrossTenantLearningBlocked event carries no blockedCategories — a block must name what it refused",
          severity: "fail",
        });
      }
    } else {
      const outcome = o.payload.outcome;
      if (outcome !== "cleared" && outcome !== "within-tenant-pass") {
        violations.push({
          subject: String(o.payload.flowId ?? "unknown"),
          message: `CrossTenantLearningScreened event has unexpected outcome "${String(outcome)}"`,
          severity: "fail",
        });
      }
    }
  }

  // Assertion 3 — SYNTHETIC LEAK (NON-VACUOUS, SABOTAGE-PROOF): construct the
  // canonical offender and assert the gate blocks it. If the gate ever lets a
  // tenant-A-position → tenant-B-posture flow through, this FAILS. Removing the
  // screen (so the gate returns allowed) makes this assertion fail — that is
  // the sabotage test, run on every CI invocation.
  result.asserted += 1;
  const syntheticLeak: LearningFlow = {
    flowId: "recon:synthetic-csi-leak",
    sourceTenantId: "tenant:za-bank",
    destinationTenantId: "tenant:rival-bank",
    sinkKind: "posture",
    sinkRef: "posture:risk-appetite:fx-var",
    csiCategoriesPresent: ["positions-exposures"],
  };
  const leakResult = screenCrossTenantLearningFlow(syntheticLeak, blocklist);
  if (leakResult.allowed || leakResult.outcome !== "blocked") {
    violations.push({
      subject: "synthetic-csi-leak",
      message:
        "SABOTAGE-CHECK FAILED: the cross-tenant gate did NOT block a tenant-A position → tenant-B posture leak. The CSI gate is non-functional — this is a competition-law control failure.",
      severity: "fail",
    });
  }

  // Assertion 3b — NON-VACUOUS positive control: a within-tenant flow with the
  // SAME CSI payload is correctly allowed (proves the gate is not blocking
  // everything indiscriminately — the block in 3 is meaningful).
  result.asserted += 1;
  const withinTenant: LearningFlow = {
    ...syntheticLeak,
    flowId: "recon:within-tenant-control",
    destinationTenantId: "tenant:za-bank",
  };
  const withinResult = screenCrossTenantLearningFlow(withinTenant, blocklist);
  if (!withinResult.allowed) {
    violations.push({
      subject: "within-tenant-control",
      message:
        "NON-VACUOUS-CHECK FAILED: the gate blocked a within-tenant flow — the gate is over-blocking, so the cross-tenant block proves nothing",
      severity: "fail",
    });
  }

  return {
    ...result,
    violations,
    ok: violations.filter((v) => v.severity === "fail").length === 0,
  };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const totalViolations = r.violations.length;
  const failViolations = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:v2-csi-cross-tenant-gate — asserted ${r.asserted} checks; ` +
      `${totalViolations} violation(s) (${failViolations} fail-severity)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
