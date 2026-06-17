// platform/accounting/posting-rules-v2/fx-fold.ts
//
// The FX trial-balance CONTRIBUTION FOLD — produces the FX GL legs as a PURE
// FOLD over the primary FIL instance lifecycle events (FilInstrumentCreated /
// FilInstrumentAmended / FilInstrumentTerminated, FX) through the lifted FX
// posting rules (`./fx.ts`), with NO stored `GlPostingEmitted` in the path.
//
// This is the read-side engine of D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD: the FX
// accounts in the V2 trial balance / entries / accounts views are derived here
// from primaries; bond / money-market / capital accounts still come from the
// stored `GlPostingEmitted` (see gl-projection-v2.ts).
//
// TREATMENT RESOLUTION (brief step 3)
// -----------------------------------
// For each FX FIL instance the fold resolves the reporting treatment that
// selects the applicable posting rules:
//
//   1. PREFERRED — product binding (`resolveInstanceTreatment`): the instance's
//      originating trade event → `trade.productId` → registered Product →
//      composed treatment. This path is taken whenever the originating trade
//      carries a `productId`.
//
//   2. BUILD-PHASE FALLBACK (retired-by-S0d) — when the originating trade has no
//      `productId` (the norm today: trade `productId` is the deferred S0d slice),
//      resolve the treatment by matching the instance's `fil:type` scope against
//      the registry's `posting-rules` modules. VALID ONLY when EXACTLY ONE
//      `posting-rules` module's scope matches the instance type; if zero or more
//      than one match → FAIL CLOSED (no posting; surfaced as a typed skip
//      reason), never a silent default (Engineering Charter cmd 2 / cmd 5).
//      FX today is unambiguous (one `posting-rules:fx` module scoped
//      `fil:type:fx:*`). When S0d lands (booking-time product binding), every
//      trade carries a `productId` and path 1 always wins — this fallback is then
//      DEAD and is removed. Tracked: see the `// TODO(S0d)` note below.
//
// FAIL-CLOSED is observable: `foldFxContributionLegs` returns the produced legs
// AND the list of skipped instances with a typed reason, so a caller / recon can
// surface (never swallow) an unresolved instance.
//
// PACKAGE BOUNDARY: v1 side (`platform/`) — MAY import from `v2-core/`.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Principle 1; Principle 2.
// Author: Atlas (Substrate Architect, engineering).

import { matchesFilScope } from "../../../v2-core/fil-core/urn";
import type {
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import {
  type ReportingTreatmentRegister,
  foldReportingTreatmentRegister,
} from "../../../v2-core/reporting-treatments/registry";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../../projections/filter";
import {
  type InstanceTreatmentInput,
  type TreatmentEventLookup,
  resolveInstanceTreatment,
} from "../reporting-treatment-dispatcher";
import {
  type FxPostingLeg,
  isFxInstance,
  postFxCloseLegs,
  postFxInitialRecognitionLegs,
  postFxRevaluationLegs,
} from "./fx";

// ---------------------------------------------------------------------------
// FX FIL lifecycle event family.
// ---------------------------------------------------------------------------

const FX_FIL_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

/** The trimmed payload the fold reads off each FIL lifecycle event. */
interface FilLifecyclePayloadMinimal {
  readonly kind: "FilInstrumentCreated" | "FilInstrumentAmended" | "FilInstrumentTerminated";
  readonly type?: string;
  readonly instance?: string;
  readonly originatingEvent?: { readonly eventType: string; readonly eventId: string };
}

// ---------------------------------------------------------------------------
// Skip reasons — fail-closed, surfaced not swallowed.
// ---------------------------------------------------------------------------

export type FxFoldSkipReason =
  | "treatment-unresolved" // product binding absent AND fallback ambiguous/empty → fail closed
  | "fx-posting-rules-not-applicable"; // resolved treatment does not apply the FX posting rules

export interface FxFoldSkip {
  readonly instance: string;
  readonly kind: string;
  readonly reason: FxFoldSkipReason;
  readonly detail: string;
}

/** A folded FX leg carries the source event id so entry-level views can address it. */
export interface FxFoldLeg extends FxPostingLeg {
  /** The FIL lifecycle event_id this leg was folded from. */
  readonly filEventId: string;
}

export interface FxFoldResult {
  readonly legs: readonly FxFoldLeg[];
  readonly skipped: readonly FxFoldSkip[];
}

// ---------------------------------------------------------------------------
// Treatment registry from the store (folds ReportingTreatmentDeclared events).
// ---------------------------------------------------------------------------

/**
 * Fold the `ReportingTreatmentDeclared` events visible in `store` into the
 * reporting-treatment register. Applies the SAME provenance filter as the GL
 * fold so the treatment view matches the operating book.
 */
export function foldTreatmentRegisterFromStore(
  store: Pick<EventStore, "replay">,
): ReportingTreatmentRegister {
  const filter = defaultProvenanceFilter();
  const payloads: unknown[] = [];
  for (const e of store.replay({ type: "ReportingTreatmentDeclared" })) {
    if (!eventMatchesProvenanceFilter(e, filter)) continue;
    payloads.push(e.payload);
  }
  return foldReportingTreatmentRegister(payloads);
}

// ---------------------------------------------------------------------------
// Treatment resolution for one FX instance — preferred product binding, then
// the documented build-phase fail-closed fallback.
// ---------------------------------------------------------------------------

const POSTING_RULES_CATEGORY = "posting-rules";

interface TreatmentDecision {
  readonly applyFxPostingRules: boolean;
  readonly reason: FxFoldSkipReason | "ok";
  readonly detail: string;
}

/**
 * Decide whether the FX posting rules apply to `instance` of taxonomy `type`.
 *
 * Path 1 (preferred): product binding. If `resolveInstanceTreatment` resolves a
 * product, the FX posting rules apply iff the composed treatment references at
 * least one FX V2 posting-rule id.
 *
 * Path 2 (fallback, retired-by-S0d): no product binding. Match the instance
 * `type` against the registry's `posting-rules` modules; valid ONLY when exactly
 * one such module's scope matches. Ambiguous (>1) or empty (0) → fail closed.
 */
function decideFxTreatment(
  type: string,
  originatingEvent: { eventType: string; eventId: string },
  treatmentStore: TreatmentEventLookup,
  register: ReportingTreatmentRegister,
): TreatmentDecision {
  // Path 1 — preferred product binding.
  const input: InstanceTreatmentInput = { originatingEvent };
  const resolved = resolveInstanceTreatment(input, treatmentStore, register);
  if (resolved.resolved) {
    const appliesFx = resolved.postingRuleIds.some((id) => id.startsWith("PR-FX-"));
    return appliesFx
      ? { applyFxPostingRules: true, reason: "ok", detail: `product ${resolved.productId}` }
      : {
          applyFxPostingRules: false,
          reason: "fx-posting-rules-not-applicable",
          detail: `product ${resolved.productId} treatment references no FX posting rule`,
        };
  }

  // The build-phase reality (pre-S0d): FIL fixtures carry an originating REF to a
  // descriptor (`Ws-v2-s1-fixture-book`) that is not itself a stored event, and
  // real trades carry no `productId` yet. BOTH manifest as "no product binding
  // available" → the fallback. Only `product-not-registered` is a genuine
  // fail-closed error (a productId WAS present but names no registered product),
  // which must NOT be papered over by the type-scope fallback.
  if (resolved.reason === "product-not-registered") {
    return {
      applyFxPostingRules: false,
      reason: "treatment-unresolved",
      detail: `product-binding path failed: ${resolved.reason} — ${resolved.detail}`,
    };
  }

  // Path 2 — build-phase fallback (retired-by-S0d). Exactly-one match required.
  //
  // TODO(S0d): when booking-time product binding lands (trade.productId + NPA
  // gate), path 1 always resolves and this fallback is DEAD CODE — remove it
  // then. Tracked under D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD S0d.
  const matches = register.rows.filter(
    (r) => r.category === POSTING_RULES_CATEGORY && r.scope.some((s) => matchesFilScope(s, type)),
  );
  // De-duplicate by treatmentId (the register already keeps latest-per-version,
  // but a single module may declare multiple scope patterns — count distinct
  // modules, not rows).
  const distinctModules = new Set(matches.map((r) => r.treatmentId));
  if (distinctModules.size === 1) {
    const only = matches[0];
    const appliesFx = only?.applicablePostingRuleIds.some((id) => id.startsWith("PR-FX-"));
    return appliesFx
      ? {
          applyFxPostingRules: true,
          reason: "ok",
          detail: `build-phase fallback: unique posting-rules module ${only?.treatmentId} matches ${type}`,
        }
      : {
          applyFxPostingRules: false,
          reason: "fx-posting-rules-not-applicable",
          detail: `unique posting-rules module for ${type} references no FX posting rule`,
        };
  }

  return {
    applyFxPostingRules: false,
    reason: "treatment-unresolved",
    detail:
      distinctModules.size === 0
        ? `no posting-rules treatment module scopes ${type} (and no product binding) — fail closed`
        : `${distinctModules.size} posting-rules modules scope ${type} — ambiguous, fail closed`,
  };
}

// ---------------------------------------------------------------------------
// The fold.
// ---------------------------------------------------------------------------

export interface FxFoldArgs {
  /** Store holding the FIL FX lifecycle events (the canonical event store). */
  readonly eventStore: EventStore;
  /**
   * Store to resolve treatment from (ReportingTreatmentDeclared + V2ProductRegistered
   * + originating trade events). Defaults to `eventStore`. Injectable so a test
   * can point treatment resolution at a separate fixture store.
   */
  readonly treatmentStore?: EventStore;
  /** Inclusive posting-date window lower bound (ISO date). */
  readonly periodStart: string;
  /** Inclusive posting-date window upper bound (ISO date). */
  readonly periodEnd: string;
}

/**
 * Fold the FX contribution to the V2 GL from the primary FIL FX events. Applies
 * the same provenance filter + posting-date window as the GlPostingEmitted fold,
 * resolves the reporting treatment per instance, and produces in-memory legs via
 * the lifted FX posting rules. Fail-closed skips are returned, not swallowed.
 *
 * The posting date is derived from the FIL event `asOf` (`substring(0,10)`),
 * IDENTICAL to how the engine derives `GlPostingEmitted.postingDate` — so the
 * window gate matches the old behaviour exactly.
 */
export function foldFxContributionLegs(args: FxFoldArgs): FxFoldResult {
  const filter = defaultProvenanceFilter();
  const treatmentStore = args.treatmentStore ?? args.eventStore;
  const register = foldTreatmentRegisterFromStore(treatmentStore);

  const legs: FxFoldLeg[] = [];
  const skipped: FxFoldSkip[] = [];

  // Read the FIL FX lifecycle events from the store in sequence order (stable,
  // matching the engine's iteration). Iterate each registered type stream and
  // merge in sequence order via the store's natural ordering per type; the GL
  // fold accumulates per (accountCode,currency) so cross-type order is benign
  // for balances, but we keep per-type store order for entry-level stability.
  const filEvents: Event[] = [];
  for (const t of FX_FIL_EVENT_TYPES) {
    for (const e of args.eventStore.replay({ type: t })) {
      if (!eventMatchesProvenanceFilter(e, filter)) continue;
      filEvents.push(e);
    }
  }
  // Stable global order: by sequence is not exposed here; replay already yields
  // sequence-ascending per type. Re-sort by as_of then event_id for a
  // deterministic cross-type merge (replay-safe, Charter cmd 9).
  filEvents.sort((a, b) => {
    if (a.as_of !== b.as_of) return a.as_of < b.as_of ? -1 : 1;
    return a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0;
  });

  for (const e of filEvents) {
    const p = e.payload as unknown as FilLifecyclePayloadMinimal;
    const type = p.type;
    const instance = p.instance ?? "";

    // Terminated events do not carry the taxonomy type in the same FX-guarded
    // way; the engine treats every termination as an FX close at this scope.
    // Mirror that: a created/amended must be an FX instance; a terminated is
    // always processed (the engine's documented Phase-3A behaviour).
    if (p.kind !== "FilInstrumentTerminated") {
      if (type === undefined || !isFxInstance(type)) continue; // non-FX → not this fold's concern
    }

    // Resolve treatment (preferred product binding, else fail-closed fallback).
    // Terminated events carry the type URN too (the backfill stamps it), so the
    // fallback can match; if a terminated event lacks a type, the fallback's
    // exactly-one check below will fail closed.
    const originatingEvent = p.originatingEvent ?? { eventType: "", eventId: "" };
    const decision = decideFxTreatment(type ?? "", originatingEvent, treatmentStore, register);
    if (!decision.applyFxPostingRules) {
      skipped.push({
        instance,
        kind: p.kind,
        reason: decision.reason === "ok" ? "treatment-unresolved" : decision.reason,
        detail: decision.detail,
      });
      continue;
    }

    // Apply the lifted FX rule for this trigger kind.
    let ruleLegs: FxPostingLeg[];
    switch (p.kind) {
      case "FilInstrumentCreated":
        ruleLegs = postFxInitialRecognitionLegs(
          e.payload as unknown as FilInstrumentCreatedPayload,
        );
        break;
      case "FilInstrumentAmended":
        ruleLegs = postFxRevaluationLegs(e.payload as unknown as FilInstrumentAmendedPayload);
        break;
      case "FilInstrumentTerminated":
        ruleLegs = postFxCloseLegs(e.payload as unknown as FilInstrumentTerminatedPayload);
        break;
    }

    for (const leg of ruleLegs) {
      // Posting-date window gate — identical to the GlPostingEmitted fold.
      if (!leg.postingDate) continue;
      if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;
      legs.push({ ...leg, filEventId: e.event_id });
    }
  }

  return { legs, skipped };
}
