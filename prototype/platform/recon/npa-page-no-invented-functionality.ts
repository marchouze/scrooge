// platform/recon/npa-page-no-invented-functionality.ts
//
// gate: recon:npa-page-no-invented-functionality
//
// ANTI-INVENTION gate for the V2 NPA product-detail page (D-NPA-PAGE-DE-
// INVENTION, CEO-approved 2026-06-23). For EVERY product the NPA detail view
// can build (the baseline fixtures), every event type the page ASSERTS must
// EITHER resolve to a real substrate fact OR be surfaced through the page's own
// gap channel. A static assertion with no backing and no gap-surfacing is a
// FAIL — the page must never invent functionality it does not have.
//
// Three assertion families, per product:
//
//   (A) Lifecycle journal rows. Each `journalEntries[]` row maps a
//       lifecycleEventFamily event type to the canonical posting-rule registry
//       (v2-core/posting-rules/registry.ts). A row that claims `present` MUST
//       have ≥1 real registry entry for that event type (no fabricated rule
//       id); a row with no registry entry MUST be surfaced as `missing` (the
//       gap channel). A `present` row with no registry backing, or a registry-
//       backed event type silently dropped, is a FAIL.
//
//   (B) Dimension trigger/emit event types. Each DimensionCard names
//       `triggeredBy` / `emits` event types. Every name MUST either resolve to
//       a registered event type (EVENT_TYPE_REGISTRY via lookupEventType) OR
//       appear in that card's `unbacked` gap channel. An unregistered name that
//       is NOT flagged unbacked is a silent invented assertion — FAIL.
//
//   (C) No false gap. A name flagged `unbacked` MUST actually be unregistered,
//       and a journal row flagged `missing` MUST actually have no registry
//       entry — so the gap channel cannot be used to hide a real, backed fact
//       (which would mask drift the other direction).
//
// Severity: FAIL (ENFORCING). Wired into `bun run ci` (domain suite).
//
// Store-independent: the assertion is over the page builder's output for the
// baseline fixtures (built against an empty replay store), the posting-rule
// registry, and the event-type registry — all source-of-truth, no DB needed.
//
// Authority: D-NPA-PAGE-DE-INVENTION; D-NEW-PRODUCT-APPROVAL-POLICY;
//            D-ENGINEERING-INTEGRITY-CHARTER (cmd 2 fail-closed, cmd 5 no silent
//            deferral).
// Author: Atlas (Core banking platform architect, engineering)

import {
  type PostingRuleEntry,
  findEntriesForEventType,
} from "../accounting/posting-rule-registry";
import { lookupEventType } from "../event-store/registry";
import type { Event } from "../event-store/types";

import { type ProductDetailView, buildProductDetailView } from "../../dashboard/products-detail";
import { BASELINE_FIXTURES } from "../../dashboard/products-view";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "npa-page-no-invented-functionality";

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

/** True iff the event type resolves to a registered event-type metadata row. */
function isRegisteredEventType(name: string): boolean {
  return lookupEventType(name) !== undefined;
}

/** True iff the event type has ≥1 posting-rule registry entry. */
function hasRegistryEntry(name: string): boolean {
  return findEntriesForEventType(name).length > 0;
}

/**
 * Assert the anti-invention invariant for a single built product-detail view.
 * Pure — takes the view + the product's declared lifecycle event family so the
 * gate's negative test can drive it with a fabricated event type. Returns one
 * violation per breach.
 */
export function assertNoInvention(
  productId: string,
  lifecycleEventFamily: readonly string[],
  view: ProductDetailView,
): ReconViolation[] {
  const violations: ReconViolation[] = [];

  // ── (A) Lifecycle journal rows ──────────────────────────────────────────
  // The builder must produce exactly one row per lifecycle event family entry,
  // ordered the same way; that one-to-one mapping is part of the contract.
  if (view.journalEntries.length !== lifecycleEventFamily.length) {
    violations.push({
      subject: `${productId}:journal-row-count`,
      severity: "fail",
      message: `journalEntries length (${view.journalEntries.length}) does not match lifecycleEventFamily length (${lifecycleEventFamily.length}) — the page dropped or duplicated a lifecycle event.`,
    });
  }
  for (const row of view.journalEntries) {
    const backed = hasRegistryEntry(row.eventType);
    if (row.status === "present") {
      if (!backed) {
        violations.push({
          subject: `${productId}:journal:${row.eventType}`,
          severity: "fail",
          message: `journal row for "${row.eventType}" claims status "present" but the posting-rule registry has NO entry for it — invented posting rule. It must render "missing" (the gap channel) instead.`,
        });
      } else if (row.rule) {
        // The summarised rule id must be composed only of real registry rule ids.
        const realIds = new Set(
          findEntriesForEventType(row.eventType).map((e: PostingRuleEntry) => e.postingRuleId),
        );
        const claimed = row.rule.ruleId.split(" · ").map((s) => s.trim());
        for (const id of claimed) {
          if (!realIds.has(id)) {
            violations.push({
              subject: `${productId}:journal:${row.eventType}:${id}`,
              severity: "fail",
              message: `journal row for "${row.eventType}" cites posting-rule id "${id}", which is not a real registry entry for that trigger — fabricated rule id.`,
            });
          }
        }
      }
    } else if (backed) {
      // status === "missing" but the registry DOES back it → false gap.
      violations.push({
        subject: `${productId}:journal:${row.eventType}:false-missing`,
        severity: "fail",
        message: `journal row for "${row.eventType}" renders "missing" but the posting-rule registry DOES have an entry — a real fact is being hidden behind the gap channel.`,
      });
    }
  }

  // ── (B) + (C) Dimension trigger/emit event types ────────────────────────
  for (const dim of view.dimensions) {
    const checkNames = (names: readonly string[], flagged: readonly string[], kind: string) => {
      const flaggedSet = new Set(flagged);
      for (const name of names) {
        const registered = isRegisteredEventType(name);
        if (!registered && !flaggedSet.has(name)) {
          violations.push({
            subject: `${productId}:${dim.dimension}:${kind}:${name}`,
            severity: "fail",
            message: `dimension "${dim.dimension}" asserts ${kind} event type "${name}", which is NOT a registered event type and is NOT surfaced in the dimension's unbacked gap channel — silent invented assertion.`,
          });
        }
        if (registered && flaggedSet.has(name)) {
          violations.push({
            subject: `${productId}:${dim.dimension}:${kind}:${name}:false-unbacked`,
            severity: "fail",
            message: `dimension "${dim.dimension}" flags ${kind} event type "${name}" as unbacked, but it IS a registered event type — false gap.`,
          });
        }
      }
    };
    checkNames(dim.triggeredBy, dim.unbacked.triggeredBy, "triggeredBy");
    checkNames(dim.emits, dim.unbacked.emits, "emits");
  }

  return violations;
}

export interface RunOpts {
  /** Products to assert. Defaults to the baseline fixtures (what the page can build). */
  readonly products?: readonly { productId: string; lifecycleEventFamily: readonly string[] }[];
}

export function run(opts: RunOpts = {}): ReconResult {
  const base = emptyResult(PIPELINE);
  const products = opts.products ?? BASELINE_FIXTURES;
  const store = stubStore([]);
  const nowIso = base.asOf;

  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const product of products) {
    const view = buildProductDetailView(product.productId, store, nowIso);
    if (!view) {
      violations.push({
        subject: `${product.productId}:unbuildable`,
        severity: "fail",
        message: `the NPA detail view could not build product "${product.productId}" — the page would render nothing for a declared baseline product.`,
      });
      continue;
    }
    // Each journal row + each dimension trigger/emit name is one assertion.
    asserted +=
      view.journalEntries.length +
      view.dimensions.reduce((n, d) => n + d.triggeredBy.length + d.emits.length, 0);
    violations.push(...assertNoInvention(product.productId, product.lifecycleEventFamily, view));
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
          ? "npa-page-no-invented-functionality: ok — every asserted event type is registry-backed or gap-surfaced"
          : "npa-page-no-invented-functionality: FAILED — the NPA page asserts functionality with no backing and no gap-surfacing",
      details: r.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`),
    }),
  );
  if (!r.ok) process.exit(1);
}
