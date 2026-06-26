// platform/recon/fx-render-no-deprecated-or-stale-family.ts
//
// gate: recon:fx-render-no-deprecated-or-stale-family
//
// FAIL-CLOSED RENDER-COHERENCE gate for the FX product NPA page
// (D-FX-ACCOUNTING-RENDER-COHERENCE, CEO-approved 2026-06-26). It guards the FX
// accounting render surfaces against two regressions the retired `journalEntries`
// lifecycle-journal silently allowed:
//
//   (1) A RETIRED posting rule rendering as LIVE. No FX product's rendered
//       accounting surfaces (the `accountingTreatment.postingRules` table, the
//       `accountingPerspective` per-stage rule legs, and the General-Ledger
//       valuation lens) may cite a posting rule the registry flags
//       `deprecated === true`. A static registry PRESENCE is not evidence a rule
//       is current (D-DERIVED-EVENT-IRREDUCIBILITY-TEST) — so the deprecated set
//       is sourced from the registry's own STRUCTURED `deprecated` flag, never a
//       hardcoded denylist (Engineering-Charter cmd 4, source-don't-hardcode).
//
//   (2) A STALE event family rendering. No FX product's rendered rules may cite a
//       trigger event type that is NOT in the LIVE (non-deprecated) trigger set
//       for the product's family lifecycle ids. The superseded pre-FIL FX family
//       (FxTradeExecuted / PrincipalPayment / SettlementConfirmed → the retired
//       PR-FX-LIFECYCLE-CLOSE) maps only to deprecated rows, so a rendered rule
//       whose trigger is absent from the live set is the stale-family regression.
//
//   (3) An IFRS-MEASUREMENT-MISMATCHED rule rendering. No FX product's rendered
//       rules may cite a rule gated to an IFRS 9 family (`appliesWhenIfrs9Family`)
//       that differs from the product's classification. FX is FVTPL-only, so the
//       FVOCI→P&L reclassification rule (PR-FX-FVOCI-RECLASS-V2, RETAINED for the
//       future equity estate) is FVOCI-gated and must NOT render for an FVTPL FX
//       product — this is the FVOCI-for-FX render regression (IFRS 9 §5.7.5 is
//       equity-only; D-FX-IFRS-REVIEW-FOUNDATION F1).
//
// The three are complementary: (1) catches a retired RULE on a live trigger; (2)
// catches a live-looking rule on a retired/absent TRIGGER; (3) catches an FVOCI
// (or otherwise measurement-mismatched) rule on an FVTPL product. Together they
// fail closed if the FVOCI-for-FX path or the pre-FIL family ever re-enters a
// render.
//
// FX is FVTPL-only — never FVOCI (IFRS 9 §5.7.5 is equity-only;
// D-FX-IFRS-REVIEW-FOUNDATION finding F1). The enforcing
// `recon:fx-pnl-account-category-integrity` gate is the single guard forbidding
// any FX→OCI posting on the EXECUTION path; THIS gate is the complementary guard
// on the RENDER path.
//
// Severity: FAIL (ENFORCING). Wired into `bun run ci` (domain suite).
//
// Store-independent: the assertion is over the page builder's output for the
// baseline fixtures (built against an empty replay store) + the posting-rule
// registry — all source-of-truth, no DB needed.
//
// Authority: D-FX-ACCOUNTING-RENDER-COHERENCE; D-FX-IFRS-REVIEW-FOUNDATION;
//   D-DERIVED-EVENT-IRREDUCIBILITY-TEST; D-ENGINEERING-INTEGRITY-CHARTER
//   (cmd 2 fail-closed, cmd 4 source-don't-hardcode).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  findEntryForRuleId,
  isDeprecatedRuleId,
  liveTriggerEventTypesForLifecycles,
} from "../../v2-core/posting-rules/registry";

import {
  FAMILY_LIFECYCLE_IDS,
  type ProductDetailView,
  buildProductDetailView,
} from "../../dashboard/products-detail";
import { BASELINE_FIXTURES } from "../../dashboard/products-view";

import { type Event } from "../event-store/types";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-render-no-deprecated-or-stale-family";

/** Minimal replay-only store over an in-memory event array (views only need `replay`). */
function stubStore(events: readonly Event[]): {
  replay: (opts?: { type?: string }) => Generator<Event>;
} {
  return {
    *replay(opts: { type?: string } = {}) {
      for (const ev of events) {
        if (opts.type && ev.type !== opts.type) continue;
        yield ev;
      }
    },
  };
}

/** One rendered (postingRuleId, triggerEventType) pair, tagged with its surface. */
interface RenderedRule {
  readonly surface: string;
  readonly postingRuleId: string;
  readonly triggerEventType: string;
}

/**
 * Collect every posting rule the FX accounting render surfaces cite, each tagged
 * with the surface it came from. Pure over the built view.
 */
function renderedRules(view: ProductDetailView): RenderedRule[] {
  const out: RenderedRule[] = [];

  for (const r of view.accountingTreatment.postingRules) {
    out.push({
      surface: "accountingTreatment.postingRules",
      postingRuleId: r.postingRuleId,
      triggerEventType: r.triggerEventType,
    });
  }

  for (const stage of view.accountingPerspective?.stages ?? []) {
    for (const r of stage.postingRules) {
      out.push({
        surface: `accountingPerspective.stage[${stage.id}]`,
        postingRuleId: r.postingRuleId,
        triggerEventType: r.triggerEventType,
      });
    }
  }

  // The General-Ledger valuation lens lists posting-rule ids; its event types are
  // listed in parallel, so the rule-id surface is what we guard.
  for (const lens of view.lenses?.valuation ?? []) {
    if (lens.domain !== "general-ledger") continue;
    for (const id of lens.postingRuleIds) {
      out.push({
        surface: "lenses.valuation[general-ledger]",
        postingRuleId: id,
        // The lens does not pair rule→trigger; the deprecated check still bites,
        // and the stale-trigger check is covered by the treatment/perspective
        // surfaces which DO pair them. Empty trigger ⇒ trigger check skipped.
        triggerEventType: "",
      });
    }
  }

  return out;
}

/**
 * Assert FX render coherence for one built product-detail view. Pure + injectable
 * so the negative test can feed a view with a deprecated / stale-trigger rule and
 * prove the gate bites.
 */
export function assertFxRenderCoherence(
  productId: string,
  family: string,
  view: ProductDetailView,
): ReconViolation[] {
  const violations: ReconViolation[] = [];

  // The gate is FX-only — non-FX products carry no FX accounting render surface
  // this gate governs.
  if (family !== "fx") return violations;

  const lifecycleIds = FAMILY_LIFECYCLE_IDS[family] ?? [];
  const liveTriggers = liveTriggerEventTypesForLifecycles(lifecycleIds);
  // The product's IFRS 9 measurement family (from the rendered accounting view).
  const productIfrs9 = view.accountingTreatment.ifrs9Family.toLowerCase();

  for (const rr of renderedRules(view)) {
    // (1) No retired rule rendered as live.
    if (isDeprecatedRuleId(rr.postingRuleId)) {
      violations.push({
        subject: `${productId}:${rr.surface}:${rr.postingRuleId}:deprecated`,
        severity: "fail",
        message: `FX render surface "${rr.surface}" cites posting rule "${rr.postingRuleId}", which the registry flags deprecated (retired) — a retired rule must never render as a live posting rule (D-FX-ACCOUNTING-RENDER-COHERENCE; D-DERIVED-EVENT-IRREDUCIBILITY-TEST).`,
      });
    }

    // (2) No stale event family rendered. Skip rows that do not pair a trigger
    // (the GL valuation lens), and skip the empty-trigger sentinel.
    if (rr.triggerEventType !== "" && !liveTriggers.has(rr.triggerEventType)) {
      violations.push({
        subject: `${productId}:${rr.surface}:${rr.triggerEventType}:stale-family`,
        severity: "fail",
        message: `FX render surface "${rr.surface}" cites posting rule "${rr.postingRuleId}" on trigger event type "${rr.triggerEventType}", which is NOT in the LIVE (non-deprecated) trigger set for the product's family — the page is rendering a superseded event family (D-FX-ACCOUNTING-RENDER-COHERENCE).`,
      });
    }

    // (3) No IFRS-measurement-mismatched rule rendered. A rule gated to an IFRS 9
    // family (e.g. an FVOCI-only reclassification) must not render for a product
    // of a different family. FX is FVTPL-only, so an FVOCI-gated rule rendering
    // here is the FVOCI-for-FX regression (IFRS 9 §5.7.5 is equity-only;
    // D-FX-IFRS-REVIEW-FOUNDATION F1).
    const entry = findEntryForRuleId(rr.postingRuleId);
    const gate = entry?.appliesWhenIfrs9Family;
    if (gate !== undefined && gate.toLowerCase() !== productIfrs9) {
      violations.push({
        subject: `${productId}:${rr.surface}:${rr.postingRuleId}:ifrs9-family-mismatch`,
        severity: "fail",
        message: `FX render surface "${rr.surface}" cites posting rule "${rr.postingRuleId}", which is gated to IFRS 9 family "${gate}" but the product is "${productIfrs9}" — a measurement-mismatched rule must not render (FX is FVTPL-only; an FVOCI rule can never fire for an FX derivative — D-FX-ACCOUNTING-RENDER-COHERENCE; D-FX-IFRS-REVIEW-FOUNDATION F1).`,
      });
    }
  }

  return violations;
}

export interface RunOpts {
  /** Products to assert. Defaults to the FX baseline fixtures. */
  readonly products?: readonly { productId: string; family: string }[];
}

export function run(opts: RunOpts = {}): ReconResult {
  const base = emptyResult(PIPELINE);
  const products = opts.products ?? BASELINE_FIXTURES;
  const store = stubStore([]);
  const nowIso = base.asOf;

  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const product of products) {
    if (product.family !== "fx") continue;
    const view = buildProductDetailView(product.productId, store, nowIso);
    if (!view) {
      violations.push({
        subject: `${product.productId}:unbuildable`,
        severity: "fail",
        message: `the NPA detail view could not build FX product "${product.productId}" — the render-coherence gate cannot assert a page that does not build.`,
      });
      continue;
    }
    // One assertion per rendered (rule, surface) — three checks each
    // (deprecated, stale-family, ifrs9-family-mismatch).
    asserted += renderedRules(view).length * 3;
    violations.push(...assertFxRenderCoherence(product.productId, product.family, view));
  }

  return {
    ...base,
    asserted,
    violations,
    ok: violations.every((v) => v.severity !== "fail"),
  };
}

export default run;

// CLI entrypoint
if (import.meta.main) {
  const r = run();
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  console.log(
    JSON.stringify({
      level: failCount === 0 ? "info" : "error",
      pipeline: r.pipeline,
      ok: r.ok,
      asserted: r.asserted,
      violations: r.violations.length,
      msg:
        failCount === 0
          ? "fx-render-no-deprecated-or-stale-family: ok — no FX render surface cites a deprecated rule or a stale event family"
          : "fx-render-no-deprecated-or-stale-family: FAILED — an FX render surface cites a retired posting rule or a superseded event family",
      details: r.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`),
    }),
  );
  if (!r.ok) process.exit(1);
}
