// platform/accounting/posting-rules-v2/fx-conversion-fold.ts
//
// FX REALISATION leg derivation (D-FX-REALISATION-COMPLETION-V1, Item 2).
//
// The FCY→ZAR conversion posting logic (`postFxConversionLegs`, PR-FX-CONVERT-V2)
// has existed since D-FX-PNL-FCY-EXPOSURE-REVALUATION but was wired to NO lifecycle
// event — exercised only by recon harnesses + the leg-structure registry, so
// realised FX P&L was never struck end-to-end (Nadia's Lane-4b residual). This
// module is the missing trigger wiring: it folds the born-V2 `FxConversionExecuted`
// event into the GL by calling `postFxConversionLegs` with the realisation terms
// the event carries.
//
// WHY A STANDALONE PASS (not threaded through the FX-instance fold)
// ----------------------------------------------------------------
// A conversion is unambiguously a REALISATION — it needs no FX-treatment /
// IFRS-election resolution (those bind the open derivative's measurement; a
// realisation is the terminal cash-out). It keys on a CASH holding, not an FX
// instance, so it does not fit the `isFxInstance`-guarded treatment loop the
// settlement / NDF events flow through. Folding it as its own pure-payload pass
// (the NDF model — a self-contained flow event) keeps the byte-equivalent
// FX-instance / event folds untouched and the realisation legs additive.
//
// BALANCE. Every leg `postFxConversionLegs` emits is in the REPORTING currency
// (ZAR) — the cash exchange, the realised-P&L strike, and the unrealised→realised
// reclassification all settle in ZAR (proven balanced per currency by
// `fx-settlement.test.ts`). So the realisation contribution self-balances per
// currency and never perturbs the per-currency trial-balance invariant.
//
// PROVENANCE. The events are admitted under the SAME provenance lens as the rest
// of the GL fold (the conversion folds in the SAME partition as the FCY cash
// position it closes — the cancel/settlement-within-same-partition lesson).
//
// Authority: D-FX-REALISATION-COMPLETION-V1; D-FX-PNL-FCY-EXPOSURE-REVALUATION;
//   Engineering Charter (cmd 1 root-cause; cmd 4 source-don't-duplicate). IAS 21
//   §28; IFRS 9 §5.7.1.
// Author: Kai (Trading systems engineer, engineering — Lane 5a).

import type { FxConversionExecutedPayload } from "../../../v2-core/fil-instances/fx-conversion";
import type { FxPostingLeg } from "../../../v2-core/posting-rules/fx";
import { postFxConversionLegs } from "../../../v2-core/posting-rules/fx-settlement";
import type { EventStore } from "../../event-store/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";

export interface FxConversionFoldArgs {
  readonly eventStore: EventStore;
  /** Inclusive posting-date window lower bound (ISO date). */
  readonly periodStart: string;
  /** Inclusive posting-date window upper bound (ISO date). */
  readonly periodEnd: string;
  /** Provenance lens. Defaults to the operating-book read. */
  readonly filter?: ProvenanceFilter;
}

/**
 * Derive the realised-FX GL legs from the `FxConversionExecuted` events admitted
 * under the provenance lens + posting-date window. Each event's legs come purely
 * from `postFxConversionLegs` (PR-FX-CONVERT-V2) — the proven, balanced conversion
 * rule. The conversion's `asOf` date drives the posting period (consistent with the
 * settlement / NDF path: the FX fold derives `postingDate` from the event `asOf`).
 */
export function deriveFxConversionLegs(args: FxConversionFoldArgs): FxPostingLeg[] {
  const filter = args.filter ?? defaultProvenanceFilter();
  const legs: FxPostingLeg[] = [];

  for (const e of args.eventStore.replay({ type: "FxConversionExecuted" })) {
    if (!eventMatchesProvenanceFilter(e, filter)) continue;
    const p = e.payload as unknown as FxConversionExecutedPayload;
    const postingDate = p.asOf.substring(0, 10);
    // Posting-date window gate (same as the GlPostingEmitted / FX-fold passes).
    if (postingDate < args.periodStart || postingDate > args.periodEnd) continue;

    for (const leg of postFxConversionLegs({
      instanceId: p.cashInstance,
      tenantId: p.tenant,
      postingDate,
      fcyCurrency: p.fcyCurrency,
      reportingCurrency: p.reportingCurrency,
      fcyAmount: p.fcyAmount.amount,
      zarProceeds: p.zarProceeds.amount,
      zarCostBasis: p.zarCostBasis.amount,
      accumulatedUnrealised: p.accumulatedUnrealised.amount,
    })) {
      legs.push(leg);
    }
  }

  return legs;
}

/** True iff a posting-rule id is a conversion-sourced (realisation) leg. Used by
 *  the GL projection to avoid double-counting a materialised conversion
 *  GlPostingEmitted (none today — the conversion folds in memory). */
export function isFxConversionSourcedGlPosting(postingRuleId: string | undefined): boolean {
  return postingRuleId === "PR-FX-CONVERT-V2";
}
