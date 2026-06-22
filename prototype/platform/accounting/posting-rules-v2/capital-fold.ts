// platform/accounting/posting-rules-v2/capital-fold.ts
//
// The CAPITAL trial-balance CONTRIBUTION FOLD — produces the capital GL legs as a
// PURE FOLD over the primary `capital` asset-class FIL instance lifecycle events
// (FilInstrumentCreated / FilInstrumentTerminated) through the lifted Capital
// posting rules (`v2-core/posting-rules/capital.ts`), with NO stored
// `GlPostingEmitted` in the path.
//
// ## Why this exists (the coherence seam — D-V2-UI-VISIBILITY-REMEDIATION)
//
// The R300m capital injection is fold-native (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
// D-CAPITAL-ASSET-CLASS-V1): the BA-700 capital-composition numerator is derived
// by `ba700-capital-composition.ts` as a fold over the capital FIL events and emits
// NO `GlPostingEmitted`. But `computeTrialBalanceV2` historically read capital ONLY
// from `GlPostingEmitted` (of which there are zero for capital), so a wired GL
// showed R0 Share Capital while BA-700 showed R300m own funds — an incoherence
// between two views of the SAME economic fact. This fold closes that seam: the
// capital accounts in the V2 trial balance / entries / accounts views are derived
// here from the primary FIL events, EXACTLY as the FX fold (`fx-fold.ts`) derives
// the FX accounts. The two own-funds legs (Dr settlement-cash, Cr own-funds) keep
// the trial balance in balance.
//
// ## Posting rules applied
//
//   FilInstrumentCreated (capital)    → postCapitalIssuanceLegs
//       Dr settlement-cash (proceeds)  IAS 32 §22 / IFRS 9 §3.1.1
//       Cr own-funds account            IAS 32 §22 (CET1) / IFRS 9 §4.2.1 (AT1/T2)
//   FilInstrumentTerminated (capital) → postCapitalRedemptionLegs
//       Dr/Cr own-funds (zero-amount memo today; richer terminal is a tracked gap)
//
// `FilInstrumentAmended` carries no capital posting arithmetic yet (Tier 2
// amortisation is a tracked gap in the capital rules) — it contributes no legs,
// MIRRORING `foldCapitalComposition`'s amended handling.
//
// ## Provenance
//
// Applies the caller's `filter` (defaulting to `defaultProvenanceFilter()` so the
// existing operating-book read path is unchanged). The R300m injection is
// `provenance:simulated`, so a `production-only` lens excludes it (honest empty
// pre-licence) and a `combined` lens admits it (the demonstration figure) — the
// SAME provenance semantics the BA-700 capital view uses, which is what makes the
// GL and BA-700 capital figures agree under the same lens.
//
// ## No double-count
//
// Capital emits no `GlPostingEmitted` today (verified: 0 in store). The GL fold's
// GlPostingEmitted path is left intact for any legacy / bond / money-market legs;
// this fold adds capital from the primary FIL events. If a future capital
// `GlPostingEmitted` ever exists, the GlPostingEmitted fold excludes capital-rule
// legs by postingRuleId (the same mechanism the FX block uses), so capital is never
// counted twice.
//
// PACKAGE BOUNDARY: v1 side (`platform/`) — MAY import from `v2-core/`.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION (CEO 2026-06-22) under
//   D-V2-UI-OVERSIGHT-STANDARD; D-CAPITAL-ASSET-CLASS-V1;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; IAS-32-§22; IAS-32-§33; IFRS-9-§3.1.1;
//   IFRS-9-§4.2.1; Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type CapitalPostingLeg,
  isCapitalPostingInstance,
  postCapitalIssuanceLegs,
  postCapitalRedemptionLegs,
} from "../../../v2-core/posting-rules/capital";
import type {
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";

// ---------------------------------------------------------------------------
// Capital FIL lifecycle event family — the events the fold reads.
// ---------------------------------------------------------------------------

const CAPITAL_FIL_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

/** The trimmed payload the fold reads off each FIL lifecycle event. */
interface FilLifecyclePayloadMinimal {
  readonly kind?: string;
  readonly type?: string;
}

/** The set of capital posting-rule ids — used by the GL fold to exclude any
 *  future capital-sourced GlPostingEmitted legs (no double-count). */
export const CAPITAL_FOLD_POSTING_RULE_IDS: ReadonlySet<string> = new Set([
  "PR-CAP-ISSUE-001-V2",
  "PR-CAP-ADJUST-002-V2",
  "PR-CAP-REDEEM-003-V2",
]);

/** True iff a GlPostingEmitted leg was produced by a capital V2 posting rule. */
export function isCapitalSourcedGlPosting(postingRuleId: string | undefined): boolean {
  return postingRuleId !== undefined && CAPITAL_FOLD_POSTING_RULE_IDS.has(postingRuleId);
}

// ---------------------------------------------------------------------------
// A folded capital leg carries the source FIL event id so entry-level views can
// address it (mirrors FxFoldLeg).
// ---------------------------------------------------------------------------

export interface CapitalFoldLeg extends CapitalPostingLeg {
  /** The FIL lifecycle event_id this leg was folded from. */
  readonly filEventId: string;
}

export interface CapitalFoldResult {
  readonly legs: readonly CapitalFoldLeg[];
}

export interface CapitalFoldArgs {
  /** Store holding the capital FIL lifecycle events (the canonical event store). */
  readonly eventStore: EventStore;
  /** Entity short-id the capital instances belong to. */
  readonly entity: string;
  /** Inclusive posting-date window lower bound (ISO date). */
  readonly periodStart: string;
  /** Inclusive posting-date window upper bound (ISO date). */
  readonly periodEnd: string;
  /**
   * Provenance lens for the fold. Defaults to `defaultProvenanceFilter()` (the
   * operating-book read), preserving the existing GL read path. An oversight
   * surface supplies an explicit `{ mode: "production-only" | "combined" }` so the
   * R300m simulated injection is excluded under Prod and admitted under +Sim — the
   * same lens the BA-700 capital view uses (GL ⇿ BA-700 coherence).
   */
  readonly filter?: ProvenanceFilter;
}

/**
 * Fold the capital contribution to the V2 GL from the primary capital FIL events.
 * Applies the same posting-date window + provenance filter as the GlPostingEmitted
 * fold, and produces in-memory legs via the lifted Capital posting rules. Both the
 * settlement-cash DEBIT leg and the own-funds CREDIT leg are produced, so the
 * trial balance stays balanced (ΣDr = ΣCr).
 *
 * The posting date is derived from the FIL event `asOf` (`substring(0,10)`),
 * IDENTICAL to how the engine / FX fold derive their posting dates.
 */
export function foldCapitalContributionLegs(args: CapitalFoldArgs): CapitalFoldResult {
  const filter = args.filter ?? defaultProvenanceFilter();
  const legs: CapitalFoldLeg[] = [];

  // Read the capital FIL lifecycle events from the store. Re-sort by as_of then
  // event_id for a deterministic cross-type merge (replay-safe, Charter cmd 9) —
  // balances accumulate per (accountCode,currency) so order is benign for the
  // trial balance, but entry-level views need stable ordering.
  const filEvents: Event[] = [];
  for (const t of CAPITAL_FIL_EVENT_TYPES) {
    for (const e of args.eventStore.replay({ entity: args.entity, type: t })) {
      if (!eventMatchesProvenanceFilter(e, filter)) continue;
      filEvents.push(e);
    }
  }
  filEvents.sort((a, b) => {
    if (a.as_of !== b.as_of) return a.as_of < b.as_of ? -1 : 1;
    return a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0;
  });

  for (const e of filEvents) {
    const p = e.payload as FilLifecyclePayloadMinimal;
    const kind = p.kind ?? e.type;

    // Only capital-asset-class instances are this fold's concern.
    if (typeof p.type !== "string" || !isCapitalPostingInstance(p.type)) continue;

    let ruleLegs: CapitalPostingLeg[];
    if (kind === "FilInstrumentCreated") {
      ruleLegs = postCapitalIssuanceLegs(e.payload as unknown as FilInstrumentCreatedPayload);
    } else if (kind === "FilInstrumentTerminated") {
      ruleLegs = postCapitalRedemptionLegs(e.payload as unknown as FilInstrumentTerminatedPayload);
    } else {
      // FilInstrumentAmended — no capital posting arithmetic yet (tracked gap).
      continue;
    }

    for (const leg of ruleLegs) {
      if (!leg.postingDate) continue;
      if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;
      legs.push({ ...leg, filEventId: e.event_id });
    }
  }

  return { legs };
}
