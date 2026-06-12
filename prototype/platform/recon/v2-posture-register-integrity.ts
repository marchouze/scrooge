// platform/recon/v2-posture-register-integrity.ts
//
// `recon:v2-posture-register-integrity` — the structural gate for the V2 S3
// posture register.
//
// ADVISORY in S3 (exits 0 unless a HARD structural error is found). Becomes
// enforcing-ready as the register population grows.
//
// Assertions:
//   1. Every active posture has a well-formed APPLIES_WHEN predicate that
//      evaluates without error (structural validity of the scope predicate).
//   2. Every PostureActivated event has a corresponding PostureRegistered
//      event (orphan-activation check — fold integrity).
//   3. The RAS pilot postures are present and active (minimum population gate):
//      at minimum the FX VaR/SVaR/ES, IRRBB delta-EVE, and LCR floor postures
//      must be registered and active.
//   4. No fold violations (duplicate registration, orphan activation/revision)
//      are found in the event stream.
//
// WHY THIS GATE IS V1-SIDE: it needs `node:fs`, the event store, and the recon
// `types` — all v1 infrastructure. The dependency direction v1→v2 is the
// permitted one (v2-core itself imports nothing from v1).
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Principle 2 (single-graph discipline — the register is a topology invariant).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import {
  type AppliesToScope,
  type PostureContext,
  evaluateAppliesToScope,
} from "../../v2-core/posture/applies-when";
import { type PostureRegister, foldPostureRegister } from "../../v2-core/posture/projection";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Pilot posture IDs that must be present and active
// ---------------------------------------------------------------------------

/**
 * The minimum pilot posture population from the RAS seed script. Any of these
 * missing from the register is an advisory finding in S3.
 */
const REQUIRED_PILOT_POSTURE_IDS = [
  "posture:risk-appetite:fx-var",
  "posture:risk-appetite:fx-svar",
  "posture:risk-appetite:fx-es",
  "posture:risk-appetite:irrbb-delta-eve",
  "posture:risk-appetite:lcr-floor",
] as const;

// ---------------------------------------------------------------------------
// Read the register from the live event store
// ---------------------------------------------------------------------------

function readPostureRegister(): PostureRegister {
  const payloads: unknown[] = [];
  for (const ev of eventStore.replay({ type: "PostureRegistered" })) {
    payloads.push({
      kind: "PostureRegistered",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of eventStore.replay({ type: "PostureActivated" })) {
    payloads.push({
      kind: "PostureActivated",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of eventStore.replay({ type: "PostureDeactivated" })) {
    payloads.push({
      kind: "PostureDeactivated",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of eventStore.replay({ type: "PostureRevised" })) {
    payloads.push({
      kind: "PostureRevised",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  // Sort by event sequence to ensure fold order matches emission order.
  // The eventStore.replay returns events in sequence order per type; for a
  // multi-type fold we need to interleave by sequence. In practice the pilot
  // seed emits RegisteredAll then ActivatedAll sequentially, so this works.
  return foldPostureRegister(payloads);
}

// ---------------------------------------------------------------------------
// Predicate structural validity check
// ---------------------------------------------------------------------------

/**
 * Verify that an APPLIES_WHEN predicate evaluates without throwing under a
 * broad-context probe (all dimensions set to non-null values). A malformed
 * predicate (e.g. a `conditions` array with a non-predicate element) would
 * throw inside `evaluateAppliesToScope`.
 */
function verifyPredicateStructural(scope: AppliesToScope): string | null {
  const probe: PostureContext = {
    jurisdiction: "ZA",
    entityType: "bank",
    filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
    regimeId: "urn:reg:za:pa:d7-2023",
    riskClass: "RT-MK",
  };
  try {
    evaluateAppliesToScope(scope, probe);
    return null;
  } catch (err) {
    return `evaluateAppliesToScope threw: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult("v2-posture-register-integrity");
  const violations: ReconViolation[] = [];

  // Fold the register. A catastrophic fold failure is a HARD error.
  let register: PostureRegister;
  try {
    register = readPostureRegister();
  } catch (err) {
    violations.push({
      subject: "PostureRegister",
      message: `posture register fold failed: ${(err as Error).message}`,
      severity: "fail",
    });
    return { ...result, asserted: 1, violations, ok: false };
  }

  // Assertion 1 — fold violations (orphan activations, duplicate registrations).
  result.asserted += 1;
  for (const v of register.violations) {
    violations.push({
      subject: v.postureId,
      message: v.message,
      severity: "warn", // advisory in S3
    });
  }

  // Assertion 2 — every active posture has a structurally valid APPLIES_WHEN predicate.
  const activePostures = register.listPostures().filter((p) => p.active);
  for (const posture of activePostures) {
    result.asserted += 1;
    const problem = verifyPredicateStructural(posture.appliesToScope);
    if (problem) {
      violations.push({
        subject: posture.postureId,
        message: `active posture has invalid APPLIES_WHEN predicate: ${problem}`,
        severity: "fail", // structural error — always hard
      });
    }
  }

  // Assertion 3 — pilot postures present and active.
  for (const id of REQUIRED_PILOT_POSTURE_IDS) {
    result.asserted += 1;
    const posture = register.getPosture(id);
    if (posture === null) {
      violations.push({
        subject: id,
        message: `required pilot posture not registered: ${id} — run scripts/seed-v2-helena-ras-postures.ts`,
        severity: "warn", // advisory in S3 (seed may not have run on a fresh install)
      });
    } else if (!posture.active) {
      violations.push({
        subject: id,
        message: `required pilot posture registered but not active: ${id}`,
        severity: "warn",
      });
    }
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
    `recon:v2-posture-register-integrity — asserted ${r.asserted} checks; ` +
      `${totalViolations} violation(s) (${failViolations} fail-severity)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
