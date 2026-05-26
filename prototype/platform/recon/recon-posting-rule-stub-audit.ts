// platform/recon/recon-posting-rule-stub-audit.ts
//
// Recon pipeline: posting-rule-stub-audit
//
// Asserts that every posting-rule-registry entry with
// condition === "intentional-no-impact" is still legitimately deferred —
// i.e. the trigger event type is NOT yet defined in the EVENT_TYPE_REGISTRY.
//
// If a trigger event type EXISTS in the EVENT_TYPE_REGISTRY AND the stub is
// NOT marked "[zero-impact-by-design]" in its conditionDetail, the stub has
// outlived its deferral and must be wired or reclassified.
//
// Categorisation (per Gap-4 audit, 2026-05-26):
//
//   Category A — event type EXISTS, stub is unwarranted → FINDING (exit 1)
//   Category B — event type does NOT exist → OK (legitimately deferred)
//   Category C — event type EXISTS, stub is genuinely zero-accounting-impact
//                (marker: "[zero-impact-by-design]" in conditionDetail) → OK
//
// The "[zero-impact-by-design]" marker is the contract: maintainers who add
// it to conditionDetail attest that the event carries no IFRS 9 recognition
// trigger and can never produce a GL posting. Removing the marker without
// wiring the rule will cause this recon to fail — that is the intended
// behaviour.
//
// This recon auto-catches future stubs that outlive their deferral whenever
// a new event type is introduced to the EVENT_TYPE_REGISTRY without updating
// the posting-rule stub.
//
// Authority:
//   - D-DATA-QUALITY-CROSS-DOMAIN-V1 (event schema cross-domain deferral policy)
//   - Principles/1-events-are-truth.md
//   - Principles/2-single-graph-discipline.md
//   - platform/accounting/posting-rule-registry.ts
//   - platform/event-store/registry/index.ts
//
// Author: Atlas (Core banking platform architect, engineering).

import { EVENT_TYPE_REGISTRY } from "../event-store/registry";
import { POSTING_RULE_REGISTRY } from "../accounting/posting-rule-registry";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:posting-rule-stub-audit";

/**
 * The "[zero-impact-by-design]" marker in conditionDetail signals that the
 * event type EXISTS in the EVENT_TYPE_REGISTRY but the stub is a Category C
 * entry — the event is genuinely zero-accounting-impact by IFRS 9 design
 * (e.g. payment-instruction memos, regulatory-dispatch confirmations,
 * coupon-schedule publications, or start-leg settlement confirmations where
 * recognition was already posted on the opening event).
 *
 * Maintainers: only add this marker when you can cite the IFRS 9 or
 * accounting-policy rationale in the conditionDetail comment above the entry.
 */
const ZERO_IMPACT_BY_DESIGN_MARKER = "[zero-impact-by-design]";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Build a fast-lookup set of all event types currently in EVENT_TYPE_REGISTRY.
  const registeredTypes = new Set<string>(EVENT_TYPE_REGISTRY.map((m) => m.type));

  // Collect all stubs (entries with condition === "intentional-no-impact").
  const stubs = POSTING_RULE_REGISTRY.filter((e) => e.condition === "intentional-no-impact");

  for (const stub of stubs) {
    result.asserted++;

    const eventTypeExists = registeredTypes.has(stub.triggerEventType);

    if (!eventTypeExists) {
      // Category B — legitimately deferred; event schema has not landed yet.
      // Recon records this as a checked-and-OK entry (no violation emitted).
      continue;
    }

    // Event type EXISTS in registry — check if this is Category C or Category A.
    const isZeroImpactByDesign =
      typeof stub.conditionDetail === "string" &&
      stub.conditionDetail.includes(ZERO_IMPACT_BY_DESIGN_MARKER);

    if (isZeroImpactByDesign) {
      // Category C — event type exists but stub is genuinely zero-accounting-impact.
      // The "[zero-impact-by-design]" marker attests that no IFRS 9 recognition
      // trigger fires on this event. Recon passes.
      continue;
    }

    // Category A — event type exists AND stub is NOT marked as zero-impact-by-design.
    // This stub has outlived its deferral: the event schema landed, but the posting
    // rule was never wired. This is a recon FINDING.
    violations.push({
      subject: `posting-rule:${stub.postingRuleId}`,
      severity: "fail",
      message:
        `Unwarranted posting-rule stub: posting rule ${stub.postingRuleId} ` +
        `(triggerEventType="${stub.triggerEventType}", postingType="${stub.postingType}") ` +
        `has condition="intentional-no-impact" but the trigger event type ` +
        `"${stub.triggerEventType}" IS registered in EVENT_TYPE_REGISTRY. ` +
        `Either wire the full posting rule (account codes + amount derivation) ` +
        `or reclassify as zero-impact-by-design by adding "${ZERO_IMPACT_BY_DESIGN_MARKER}" ` +
        `to conditionDetail with an IFRS 9 / accounting-policy rationale. ` +
        `Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1; ` +
        `platform/accounting/posting-rule-registry.ts; ` +
        `Principles/1-events-are-truth.md.`,
    });
  }

  // Empty-state guard — keep asserted >= 1 so the harness records a run.
  if (result.asserted === 0) {
    result.asserted = 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();

  const stubsChecked = POSTING_RULE_REGISTRY.filter(
    (e) => e.condition === "intentional-no-impact",
  ).length;

  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      stubsChecked,
      findings: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `posting-rule-stub-audit passed — ${stubsChecked} stub(s) checked; ` +
          `all are either legitimately deferred (event schema absent) ` +
          `or classified as zero-impact-by-design.`
        : `posting-rule-stub-audit FAILED — ${r.violations.length} unwarranted stub(s) found: ` +
          `event type exists in EVENT_TYPE_REGISTRY but posting rule is still stubbed. ` +
          `Wire the rule or add the [zero-impact-by-design] marker with IFRS 9 rationale.`,
      detail: r.violations,
    }),
  );

  process.exit(r.ok ? 0 : 1);
}
