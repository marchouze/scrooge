// platform/recon/credit-limit-v2-parity.ts
//
// recon:credit-limit-v2-parity — ENFORCING parity gate (WS-V2-AUTHORITATIVE S2).
//
// STATUS: ENFORCING — hardened from advisory (Phase 3d) to enforcing under
// WS-V2-AUTHORITATIVE S2 (D-V1-REMOVAL-FLIP-BASIS-RBC, CEO-approved 2026-06-16).
// The V1 credit-limit approval types (CreditLimitApproved / CreditLimitLoaded /
// CreditLimitWithdrawn) are flipped to v2Status "v2-replaced" on ORDINARY
// BYTE-PARITY: the S4 (#1386) dual-run emitter proves V1↔V2 approval registries
// are byte-identical (V1-only=0, V2-only=0, zero field mismatches). Any future
// V1↔V2 divergence (mismatch, or a V2-only entry exceeding V1 scope) is now a
// fail-severity violation that blocks CI. A V1-only entry remains a warn (the
// dual-run emitter may legitimately lag a brand-new V1 approval by one tick).
// Charter cmd 3 — ratchets harden only; this gate now blocks regressions.
//
// Compares the V1 credit-limit approval registry (folded from V1 event types
// CreditLimitApproved / CreditLimitLoaded / CreditLimitWithdrawn) against the
// V2 approval registry (folded from V2 event types CreditLimitApprovedV2 /
// CreditLimitLoadedV2 / CreditLimitWithdrawnV2).
//
// ## Expected outcome at Phase 3d
//
// The V2 dual-run emitters in `credit-limit-engine-v2.ts` emit V2 events
// alongside V1. Until every call site that emits V1 approval events also calls
// the V2 emitter, there will be gaps (counterparties in V1 with no V2 entry).
//
// The gate therefore:
//   - Counterparties present in BOTH V1 and V2 → compare approvedLimit,
//     loadedLimit, breachStatus, effectiveFrom, expiryDate (byte-compare after
//     normalising the MoneyWire shape). `tenantId` is excluded from comparison
//     because V1 fold uses a proxy value.
//   - Counterparties present in V1 only → advisory warn (expected gap).
//   - Counterparties present in V2 only → fail (V2 must not exceed V1 scope).
//
// ## Advisory until enforcing
//
// The gate is ADVISORY at Phase 3d because the dual-run wiring is not yet
// complete across all call sites. It becomes enforcing once:
//   1. Every approval call site emits both V1 + V2.
//   2. Byte-equivalence holds for 100% of counterparties.
//   3. A CEO Decision promotes this gate (D-V1-REMOVAL-PHASE-3D).
//
// ## Provenance
//
// Both V1 and V2 folds apply the `defaultProvenanceFilter` — only production
// events are folded. The gate runs correctly on a fresh clean-store (vacuous
// empty == empty). On a sim-seeded store, provenance-filtered folds exclude
// the sim events, so the gate may show an empty registry; that is correct
// behaviour for a prod-filter gate.
//
// Authority: D-V1-REMOVAL-PHASE-3D (CEO-approved 2026-06-15).
// Citations: Banks Act 94 of 1990 §73; RRB Regulation 23; LEX Directive D3/2022;
//   BCBS 283; Policies/credit-risk-policy-v1.md; D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Author: Atlas (Substrate Architect, engineering).

import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import {
  computeCreditLimitRegistryV1,
  computeCreditLimitRegistryV2Uncached,
} from "../projections/credit-limit-registry-v2";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "credit-limit-v2-parity";

// The as-of bound for the fold. Broad window that captures all events in the
// build phase (same pattern as gl-v2-parity.ts).
const AS_OF = "2099-12-31";

// Fields excluded from the V1↔V2 comparison for counterparties present in both.
// - tenantId: V1 fold uses the anchor tenant ID as a proxy (V1 events carry
//   no tenantId); comparing it would always produce a false diff for V1 events
//   that predate the dual-run emitter.
const IGNORE_FIELDS = ["tenantId"] as const;

// ---------------------------------------------------------------------------
// Gate implementation
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — vacuous parity harness.
  const vacuousViolations = runParityCheck({
    label: "credit-limit-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuousViolations.length > 0) {
    violations.push({
      subject: "credit-limit-v2-parity:parity-harness-structural-check",
      message:
        "The parity harness structural check failed (empty == empty did not pass). " +
        "This is a harness bug. Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) Registry checks — all three V2 types must be registered as v2-parallel.
  for (const typeName of [
    "CreditLimitApprovedV2",
    "CreditLimitLoadedV2",
    "CreditLimitWithdrawnV2",
  ] as const) {
    const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === typeName);
    result.asserted += 1;
    if (!entry) {
      violations.push({
        subject: `credit-limit-v2-parity:registry-missing:${typeName}`,
        message: `"${typeName}" is not in the event type registry. This is a three-site F-032 registration defect. Register the type in platform/event-store/registry/credit-limit.ts with v2Status: "v2-parallel". Authority: D-V1-REMOVAL-PHASE-3D.`,
        severity: "fail",
      });
    } else if (entry.v2Status !== "v2-parallel") {
      violations.push({
        subject: `credit-limit-v2-parity:unexpected-status:${typeName}`,
        message: `"${typeName}" is tagged "${entry.v2Status}" — expected "v2-parallel". Phase 3d runs V2 approval-registry types in parallel with V1. Authority: D-V1-REMOVAL-PHASE-3D.`,
        severity: entry.v2Status === "v2-replaced" ? "fail" : "warn",
      });
    }
  }

  // (2b) FLIP-RECORDED CHECK (ENFORCING) — the three V1 approval types must be
  //      tagged "v2-replaced" (WS-V2-AUTHORITATIVE S2). Reverting a recorded flip
  //      without a CEO Decision is a regression. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.
  for (const typeName of [
    "CreditLimitApproved",
    "CreditLimitLoaded",
    "CreditLimitWithdrawn",
  ] as const) {
    const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === typeName);
    result.asserted += 1;
    if (!entry) {
      violations.push({
        subject: `credit-limit-v2-parity:registry-missing:${typeName}`,
        message: `"${typeName}" is not in the registry. Expected v2Status "v2-replaced" (flipped on byte-parity, WS-V2-AUTHORITATIVE S2). Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
        severity: "fail",
      });
    } else if (entry.v2Status !== "v2-replaced") {
      violations.push({
        subject: `credit-limit-v2-parity:flip-reverted:${typeName}`,
        message: `"${typeName}" is tagged "${entry.v2Status}" but it was flipped to "v2-replaced" under WS-V2-AUTHORITATIVE S2 (ordinary byte-parity; S4 dual-run). Reverting a recorded flip requires a CEO Decision. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; D-V1-REMOVAL-PHASE-3D.`,
        severity: "fail",
      });
    }
  }

  // (3) V1 vs V2 approval-registry comparison.
  //
  // Both folds use Uncached paths to avoid snapshot cross-contamination.
  let v1Count = 0;
  let v2Count = 0;
  let commonCount = 0;
  let v1OnlyCount = 0;
  let v2OnlyCount = 0;

  try {
    const v1Registry = computeCreditLimitRegistryV1(eventStore, AS_OF);
    const v2Registry = computeCreditLimitRegistryV2Uncached(eventStore, AS_OF);

    v1Count = v1Registry.size;
    v2Count = v2Registry.size;

    // (3a) V2-only entries → fail (V2 must not exceed V1 scope).
    for (const [counterpartyId] of v2Registry.entries()) {
      result.asserted += 1;
      if (!v1Registry.has(counterpartyId)) {
        v2OnlyCount += 1;
        violations.push({
          subject: `credit-limit-v2-parity:v2-only:${counterpartyId}`,
          message: `V2 registry has an entry for counterpartyId "${counterpartyId}" but V1 does not. V2 approval-registry must not exceed V1 scope at Phase 3d. Inspect credit-limit-engine-v2.ts — a V2 event was emitted without a corresponding V1 event. Authority: D-V1-REMOVAL-PHASE-3D.`,
          severity: "fail",
        });
      }
    }

    // (3b) V1-only entries → advisory warn (expected gap at Phase 3d).
    for (const [counterpartyId] of v1Registry.entries()) {
      result.asserted += 1;
      if (!v2Registry.has(counterpartyId)) {
        v1OnlyCount += 1;
        violations.push({
          subject: `credit-limit-v2-parity:v1-only:${counterpartyId}`,
          message: `V1 registry has an entry for counterpartyId "${counterpartyId}" but V2 does not. Expected at Phase 3d: the dual-run emitter is not yet wired at every approval call site. TO RESOLVE: add emitCreditLimitApprovedV2/emitCreditLimitLoadedV2/emitCreditLimitWithdrawnV2 calls alongside each V1 approval emission. Authority: D-V1-REMOVAL-PHASE-3D.`,
          severity: "warn",
        });
      }
    }

    // (3c) Common entries → parity-compare (ignoring tenantId).
    for (const [counterpartyId, v2Entry] of v2Registry.entries()) {
      if (!v1Registry.has(counterpartyId)) continue; // handled by (3a)
      const v1Entry = v1Registry.get(counterpartyId);
      if (!v1Entry) continue;

      commonCount += 1;
      result.asserted += 1;

      // Build parity specs per entry; use runParityCheck on the pair.
      const parityViolations = runParityCheck({
        label: `credit-limit-v2-parity:entry:${counterpartyId}`,
        readV1: () => v1Entry,
        readV2: () => v2Entry,
        ignore: [...IGNORE_FIELDS],
      });
      for (const v of parityViolations) {
        violations.push({
          subject: `credit-limit-v2-parity:mismatch:${counterpartyId}`,
          message: `V1↔V2 approval-registry mismatch for counterpartyId "${counterpartyId}": ${v.message} Inspect credit-limit-engine-v2.ts MoneyWire conversion and fold logic. Authority: D-V1-REMOVAL-PHASE-3D.`,
          severity: "fail",
        });
      }
    }
  } catch (err) {
    violations.push({
      subject: "credit-limit-v2-parity:fold-error",
      message: `Registry fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the event store for malformed CreditLimitApproved*/Loaded*/Withdrawn* events.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  // (4) Advisory gap documentation — surface the Phase 3d structural gap.
  result.asserted += 1;
  violations.push({
    subject: "credit-limit-v2-parity:coverage-status",
    message: `COVERAGE STATUS (ENFORCING — S2): V1↔V2 approval registries byte-compared. V1 entries: ${v1Count}. V2 entries: ${v2Count}. Common (both, byte-equal): ${commonCount}. V1-only (dual-run lag warn): ${v1OnlyCount}. V2-only (fail if any): ${v2OnlyCount}. The V1 types are flipped v2-replaced; V2 (decimal-native MoneyWire + tenantId) is authoritative. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; D-V1-REMOVAL-PHASE-3D.`,
    severity: v1OnlyCount > 0 ? "warn" : "info",
  });

  // ENFORCING gate: ok = false on any fail-severity violation (flip-revert,
  // V2-only scope breach, field mismatch, fold error). Warn-severity (V1-only
  // dual-run lag, the coverage status line) does not block.
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  const harnessStatus = vacuousViolations.length === 0 ? "OK" : "FAILED";
  const summary = `credit-limit-v2-parity [ENFORCING — S2]: ${failCount} fail, ${warnCount} warn. V1 types flipped v2-replaced (byte-parity). V1 entries: ${v1Count}, V2 entries: ${v2Count}. Common: ${commonCount}, V1-only (warn lag): ${v1OnlyCount}, V2-only (fail if any): ${v2OnlyCount}. Harness: ${harnessStatus}.`;

  result.asOf = summary;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (enforcing — byte-parity holds, flips recorded)" : "FAIL";
  process.stdout.write(`\nrecon:${PIPELINE} ${label}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: new Date().toISOString(),
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
