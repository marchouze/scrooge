// platform/accounting/posting-rules-v2/fx-instance-fold.ts
//
// STATE-DRIVEN FX GL derivation (Step B, D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
//
// THE SHIFT THIS MAKES
// --------------------
// `foldFxContributionLegs` (`./fx-fold.ts`) derives the FX GL legs by REPLAYING
// the raw `FilInstrument*` lifecycle events and dispatching a per-event
// `switch (p.kind)` — and, crucially, it determines the CANCELLED state by a
// bespoke `findBareCancellations` scan of the terminated stream (state inferred
// from events). That is the anti-pattern the FIL surface exists to remove: the
// accounting consumer re-implements a fold the register already owns and has to
// "remember" each event type to know an instance is cancelled.
//
// `deriveFxInstanceLegs` derives the SAME legs from the FIL STATE register
// (`foldFilInstances`): it folds the register, selects FX rows by their type, and
// reads each instance's `stage` to decide the terminal treatment. The CANCELLED
// special-case is now a clean `row.stage === "cancelled"` register read — no event
// scan. A terminal `stage` needs no per-event branch: the reversal is driven
// purely by state (plan Q4).
//
// STATE vs FLOW — the boundary the brief draws
// --------------------------------------------
// `stage`, the set of FX instances, and terminal detection — STATE — come from the
// register (NEVER from an event scan). The recognition / revaluation / terminal
// leg AMOUNTS are per-event FLOW facts (each amendment posts a FULL notional pair,
// not a delta; the register intentionally collapses to latest-terms and discards
// the intermediate amendment notionals — and the settlement / NDF events are not
// folded into the register at all). So the per-instance opening / settlement legs
// are sourced from the instance's grouped lifecycle event payloads — reading FLOW
// amounts, not STATE. This keeps `deriveFxInstanceLegs` byte-identical in NET per
// `(accountCode,currency)` to `foldFxContributionLegs` while the STATE that drives
// the structure (which rows, what stage, whether to reverse) comes solely from
// `foldFilInstances`.
//
// The CANCELLATION reversal is the load-bearing difference: the event fold scans
// the terminated stream to find bare cancellations; here we simply read
// `row.stage === "cancelled"` off the register row and reverse that instance's
// accumulated opening legs. Same net, no event-scan for state.
//
// DARK (Step B): this derivation is built, unit-tested, and proven byte-equivalent
// to the event fold by `recon:gl-v2-fold-equivalence-fx`'s THIRD comparison. It is
// NOT yet wired into `gl-projection-v2.ts` (that is Step C). Nothing in the trial
// balance reads it yet.
//
// PACKAGE BOUNDARY: v1 side (`platform/`) — MAY import from `v2-core/`.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   D-ENGINEERING-INTEGRITY-CHARTER (root-cause; fail-closed; replay-safe).
//   Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRegister,
  foldFilInstances,
} from "../../../v2-core/fil-instances";
import type {
  FilFxSettlementConfirmedPayload,
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
  FilNdfFixingObservedPayload,
} from "../../../v2-core/fil-instances/events";
import type { TradeSettlementExecutedPayload } from "../../../v2-core/fil-instances/trade-settlement";
import {
  postFxDerecognitionLegs,
  postFxFvociReclassLegs,
  postFxNdfFixingLegs,
  postFxSettlementLegs,
  postFxSwapFarLegLegs,
  postFxSwapNearLegLegs,
} from "../../../v2-core/posting-rules/fx-settlement";
import { postTradeSettlementLegs } from "../../../v2-core/posting-rules/trade-settlement";
import {
  type InstanceElectionRegister,
  findInstanceElection,
} from "../../../v2-core/reporting-treatments/instance-election";
import type { ReportingTreatmentRegister } from "../../../v2-core/reporting-treatments/registry";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";
import {
  type FxElectionOverride,
  type FxPostingLeg,
  isFxInstance,
  isFxObsCommitmentLeg,
  postFxCancellationReversalLegs,
  postFxCloseLegs,
  postFxInitialRecognitionLegs,
  postFxObsCommitmentReleaseLegs,
  postFxRevaluationLegs,
} from "./fx";
import {
  type FxFoldDeviation,
  type FxFoldLeg,
  type FxFoldResult,
  type FxFoldSkip,
  decideFxTreatment,
  foldElectionRegisterFromStore,
  foldTreatmentRegisterFromStore,
} from "./fx-fold";

// ---------------------------------------------------------------------------
// The FIL FX lifecycle event family — same set the event fold reads, used here
// ONLY to (a) build the state register and (b) source per-event FLOW amounts.
// ---------------------------------------------------------------------------

const FX_FIL_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
  // DUAL-READ settlement (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 2). The fold
  // consumes the born-V2 uniform single-asset `TradeSettlementExecuted` (the
  // production settlement-of-record going forward) AND the historical
  // `FilFxSettlementConfirmed` (oracle + replay of any pre-cutover settled fixture).
  // Both route their settlement legs through the SAME per-movement primitive
  // (`postSettlementMovementLegs`), so N single-asset settlements net byte-identical
  // to the one two-leg event (proven by `recon:gl-v2-fold-equivalence-fx`). The
  // historical event is NOT removed — replay-safe & append-only.
  "TradeSettlementExecuted",
  "FilFxSettlementConfirmed",
  "FilNdfFixingObserved",
] as const;

// The register projection folds only the three kernel lifecycle kinds, in
// lifecycle order (Created → Amended → Terminated) for a replay-stable fold.
const REGISTER_EVENT_KIND_LIST = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

export interface FxInstanceFoldArgs {
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
  /**
   * Provenance lens for the derivation. Defaults to `defaultProvenanceFilter()`
   * (the operating-book read), matching `foldFxContributionLegs` exactly so the
   * equivalence gate compares like for like.
   */
  readonly filter?: ProvenanceFilter;
}

// Re-export the leg / skip / result types so consumers import from one place.
export type { FxFoldLeg, FxFoldSkip, FxFoldDeviation, FxFoldResult };

// ---------------------------------------------------------------------------
// Per-event leg adapters for the FLOW legs the register does not carry. These
// MIRROR the adapters in `fx-fold.ts` byte-for-byte (same rule inputs) so the
// derived net is identical. Kept private; the event fold owns the canonical
// copies — these exist only because the settlement / NDF / terminal economic
// terms live on the EVENT payload, not on the collapsed register row.
// ---------------------------------------------------------------------------

/** Terminal-event legs — derecognition / FVOCI reclass when the terminal event
 * carries enriched terms, else the clean zero-amount close memo. Byte-identical
 * to `fx-fold.postFxTerminationLegs`. */
function terminationLegs(payload: FilInstrumentTerminatedPayload): FxPostingLeg[] {
  const { derecognitionTerms, fvociReclassTerms } = payload;
  if (derecognitionTerms === undefined && fvociReclassTerms === undefined) {
    return postFxCloseLegs(payload);
  }
  const postingDate = payload.asOf.substring(0, 10);
  const legs: FxPostingLeg[] = [];
  if (derecognitionTerms !== undefined) {
    legs.push(
      ...postFxDerecognitionLegs({
        instanceId: payload.instance,
        tenantId: payload.tenant,
        postingDate,
        currency: derecognitionTerms.accumulatedUnrealised.currency,
        accumulatedUnrealised: derecognitionTerms.accumulatedUnrealised.amount,
      }),
    );
  }
  if (fvociReclassTerms !== undefined) {
    legs.push(
      ...postFxFvociReclassLegs({
        instanceId: payload.instance,
        tenantId: payload.tenant,
        postingDate,
        currency: fvociReclassTerms.accumulatedOci.currency,
        accumulatedOci: fvociReclassTerms.accumulatedOci.amount,
      }),
    );
  }
  return legs;
}

/** Settlement-event legs — dispatch on `legRole`. Byte-identical to
 * `fx-fold.postFxSettlementConfirmedLegs`. */
function settlementConfirmedLegs(payload: FilFxSettlementConfirmedPayload): FxPostingLeg[] {
  const settlementInput = {
    instanceId: payload.instance,
    tenantId: payload.tenant,
    postingDate: payload.asOf.substring(0, 10),
    boughtCurrency: payload.boughtBooked.currency,
    boughtBookedAmount: payload.boughtBooked.amount,
    boughtSettledAmount: payload.boughtSettled.amount,
    soldCurrency: payload.soldBooked.currency,
    soldBookedAmount: payload.soldBooked.amount,
    soldSettledAmount: payload.soldSettled.amount,
  };
  switch (payload.legRole) {
    case "spot":
      return postFxSettlementLegs(settlementInput);
    case "swap-near":
      return postFxSwapNearLegLegs(settlementInput);
    case "swap-far":
      return postFxSwapFarLegLegs(settlementInput);
  }
}

/** NDF-fixing legs. Byte-identical to `fx-fold.postFxNdfFixingObservedLegs`. */
function ndfFixingObservedLegs(payload: FilNdfFixingObservedPayload): FxPostingLeg[] {
  return postFxNdfFixingLegs({
    instanceId: payload.instance,
    tenantId: payload.tenant,
    postingDate: payload.asOf.substring(0, 10),
    settlementCurrency: payload.settlementCurrency,
    netCashDifference: payload.netCashDifference.amount,
  });
}

/**
 * Single-asset `TradeSettlementExecuted` legs (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL,
 * Slice 2). Maps ONE uniform movement onto its three GL legs through the SAME
 * per-movement primitive the two-leg FX settlement composes, so N single-asset
 * settlements of one trade net byte-identical to its single `FilFxSettlementConfirmed`
 * spot path (`recon:gl-v2-fold-equivalence-fx`). The leg `sourceEventId` is the
 * trade instance — identical to the FX settlement path's `instanceId` — so the GL
 * addressing matches.
 */
function tradeSettlementExecutedLegs(payload: TradeSettlementExecutedPayload): FxPostingLeg[] {
  return postTradeSettlementLegs(payload);
}

// ---------------------------------------------------------------------------
// The minimal payload shape the derivation reads off each lifecycle event.
// ---------------------------------------------------------------------------

interface FilLifecyclePayloadMinimal {
  readonly kind:
    | "FilInstrumentCreated"
    | "FilInstrumentAmended"
    | "FilInstrumentTerminated"
    | "TradeSettlementExecuted"
    | "FilFxSettlementConfirmed"
    | "FilNdfFixingObserved";
  readonly type?: string;
  /** The instrument URN this event keys on. Absent on `TradeSettlementExecuted`,
   * which keys on `tradeInstance` (see `groupingKeyOf`). */
  readonly instance?: string;
  /** Present on `TradeSettlementExecuted` — the trade (grouping id) this settles. */
  readonly tradeInstance?: string;
  readonly asOf?: string;
  readonly originatingEvent?: { readonly eventType: string; readonly eventId: string };
  readonly economicTerms?: { readonly productId?: string };
}

/**
 * The register-instance key an event groups under. Every lifecycle event keys on
 * `instance` EXCEPT `TradeSettlementExecuted`, whose settlement legs belong to the
 * TRADE it executes (`tradeInstance`, the grouping / booking id Slice 1 added) —
 * NOT to the settled holding. Grouping it under the trade attaches its settlement
 * legs to the FX trade row, exactly where `FilFxSettlementConfirmed{instance:trade}`
 * sat.
 */
function groupingKeyOf(payload: FilLifecyclePayloadMinimal): string {
  if (payload.kind === "TradeSettlementExecuted") return payload.tradeInstance ?? "";
  return payload.instance ?? "";
}

/** One lifecycle event grouped under its instance, in deterministic order. */
interface GroupedFilEvent {
  readonly event: Event;
  readonly payload: FilLifecyclePayloadMinimal;
}

// ---------------------------------------------------------------------------
// deriveFxInstanceLegs — STATE-driven derivation.
//
// 1. Read the FIL FX lifecycle events under the provenance lens (same admission
//    as the event fold), build the STATE register via `foldFilInstances`, and
//    group the events per instance for FLOW-amount sourcing.
// 2. Iterate the REGISTER. For each FX row (`isFxInstance(row.type)`):
//    - resolve treatment (reusing `decideFxTreatment` + the election register)
//      exactly as the event fold does — same fail-closed `FxFoldSkip` reasons;
//    - emit the per-instance legs from the grouped events (recognition from the
//      created event's terms, revaluation per amendment, settlement / NDF / close
//      from their events);
//    - if `row.stage === "cancelled"` AND the terminal event is a BARE
//      cancellation (no derecognition / FVOCI terms), append the reversal that
//      nets the accumulated opening position to zero — driven by STATE, not by a
//      terminated-stream scan.
// ---------------------------------------------------------------------------

export function deriveFxInstanceLegs(args: FxInstanceFoldArgs): FxFoldResult {
  const filter = args.filter ?? defaultProvenanceFilter();
  const treatmentStore = args.treatmentStore ?? args.eventStore;
  const register: ReportingTreatmentRegister = foldTreatmentRegisterFromStore(treatmentStore);
  const electionRegister: InstanceElectionRegister = foldElectionRegisterFromStore(treatmentStore);

  // (1a) Read the FIL FX lifecycle events under the provenance lens, in the SAME
  // cross-type ordering the event fold uses (as_of, then event_id), so the derived
  // legs are emitted in an identical sequence (entry-level stability). These are
  // the events that produce LEGS — the lens-admitted FLOW.
  const filEvents: Event[] = [];
  for (const t of FX_FIL_EVENT_TYPES) {
    for (const e of args.eventStore.replay({ type: t })) {
      if (!eventMatchesProvenanceFilter(e, filter)) continue;
      filEvents.push(e);
    }
  }
  filEvents.sort((a, b) => {
    if (a.as_of !== b.as_of) return a.as_of < b.as_of ? -1 : 1;
    return a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0;
  });

  // (1b) Build the STATE register from the FULL register-kind stream — NO
  // provenance filter. This is the load-bearing decision that reproduces the event
  // fold's PROVENANCE-DECOUPLED cancellation detection (`findBareCancellations`
  // scans the full terminated stream): a PRODUCTION creation cancelled by a
  // BUILD-PHASE-FIXTURE cancellation must STILL read back as `stage === "cancelled"`
  // so the production opening legs that DID fold under the lens are reversed. The
  // register `stage` is the surface that replaces the event-scan; sourcing it from
  // the full stream is exactly what makes the state read provenance-independent
  // while leg emission stays lens-scoped below.
  // Iterate the register kinds in lifecycle order (Created → Amended →
  // Terminated) so the projection applies creation before any amendment /
  // termination for every instance, regardless of cross-type store order. The
  // projection is latest-wins per URN, so this ordering is the replay-stable one.
  const registerEvents: FilInstanceLifecycleEvent[] = [];
  for (const t of REGISTER_EVENT_KIND_LIST) {
    for (const e of args.eventStore.replay({ type: t })) {
      registerEvents.push(e.payload as unknown as FilInstanceLifecycleEvent);
    }
  }
  const stateRegister: FilInstanceRegister = foldFilInstances(registerEvents);

  // Bare-cancellation metadata, sourced PROVENANCE-DECOUPLED from the full
  // terminated stream — byte-identical to `fx-fold.findBareCancellations`. The
  // register `stage === "cancelled"` is the trigger; this map supplies the bareness
  // determination + the deterministic reversal posting date/tenant (the EARLIEST
  // cancellation per instance), which the collapsed register row alone cannot
  // carry. Capturing it from the full stream is what reproduces the event fold's
  // cross-lens net (a production opening cancelled by a fixture cancellation).
  const bareCancellations = new Map<string, { tenant?: string; asOf: string; eventId: string }>();
  for (const e of args.eventStore.replay({ type: "FilInstrumentTerminated" })) {
    const p = e.payload as unknown as FilInstrumentTerminatedPayload;
    if (p.terminalStage !== "cancelled") continue;
    if (p.derecognitionTerms !== undefined || p.fvociReclassTerms !== undefined) continue;
    const inst = p.instance;
    if (inst === undefined || inst.length === 0) continue;
    const existing = bareCancellations.get(inst);
    const isEarlier =
      existing === undefined ||
      p.asOf < existing.asOf ||
      (p.asOf === existing.asOf && e.event_id < existing.eventId);
    if (isEarlier) {
      bareCancellations.set(inst, {
        ...(p.tenant !== undefined ? { tenant: p.tenant } : {}),
        asOf: p.asOf,
        eventId: e.event_id,
      });
    }
  }

  // Settlement / maturity termination metadata (D-FX-TRADE-DATE-FVTPL-OBS), sourced
  // PROVENANCE-DECOUPLED from the full terminated stream — byte-identical to
  // `fx-fold.findSettledTerminations`. The register `stage` ("settled" | "matured")
  // is the trigger; this map supplies the deterministic OBS-release posting date /
  // tenant (the EARLIEST settlement per instance), which the collapsed register row
  // alone cannot carry. On settlement the trade-date OBS commitment (ACC-9100-*) is
  // released; the on-BS reval is reversed separately by PR-FX-CLOSE-V2.
  const settledTerminations = new Map<string, { tenant?: string; asOf: string; eventId: string }>();
  for (const e of args.eventStore.replay({ type: "FilInstrumentTerminated" })) {
    const p = e.payload as unknown as FilInstrumentTerminatedPayload;
    if (p.terminalStage !== "settled" && p.terminalStage !== "matured") continue;
    const inst = p.instance;
    if (inst === undefined || inst.length === 0) continue;
    const existing = settledTerminations.get(inst);
    const isEarlier =
      existing === undefined ||
      p.asOf < existing.asOf ||
      (p.asOf === existing.asOf && e.event_id < existing.eventId);
    if (isEarlier) {
      settledTerminations.set(inst, {
        ...(p.tenant !== undefined ? { tenant: p.tenant } : {}),
        asOf: p.asOf,
        eventId: e.event_id,
      });
    }
  }

  // Group every lens-admitted lifecycle event by instance, preserving the global
  // sort order. The FLOW legs are sourced from these grouped payloads.
  const eventsByInstance = new Map<string, GroupedFilEvent[]>();
  for (const e of filEvents) {
    const payload = e.payload as unknown as FilLifecyclePayloadMinimal;
    // Group under the register-instance key — the trade for a TradeSettlementExecuted
    // (it settles a trade), the instrument itself for every other lifecycle event.
    const instance = groupingKeyOf(payload);
    const acc = eventsByInstance.get(instance) ?? [];
    acc.push({ event: e, payload });
    eventsByInstance.set(instance, acc);
  }

  // The instance → bound productId map (S0d) — sourced from the created / amended
  // events' `economicTerms.productId`, latest-wins, identical to the event fold.
  const boundProductIdByInstance = new Map<string, string>();
  for (const e of filEvents) {
    const payload = e.payload as unknown as FilLifecyclePayloadMinimal;
    const pid = payload.economicTerms?.productId;
    if (payload.instance !== undefined && typeof pid === "string" && pid.length > 0) {
      boundProductIdByInstance.set(payload.instance, pid);
    }
  }

  const legs: FxFoldLeg[] = [];
  const skipped: FxFoldSkip[] = [];
  const deviations: FxFoldDeviation[] = [];
  const recordedDeviations = new Set<string>();

  // (2) Iterate the REGISTER. The register's insertion order follows creation
  // order; that is the stable per-instance walk the entry-level views expect.
  for (const [instanceUrn, row] of stateRegister) {
    // FX rows only — selected off the STATE row's type (NOT an event scan).
    if (!isFxInstance(row.type)) continue;

    const grouped = eventsByInstance.get(instanceUrn) ?? [];
    if (grouped.length === 0) continue; // register row with no lens-admitted event

    // Resolve treatment ONCE per instance — reuse `decideFxTreatment` verbatim so
    // the fail-closed reasons match the event fold exactly.
    const originating = row.originatingEvent ?? { eventType: "", eventId: "" };
    const boundProductId = boundProductIdByInstance.get(instanceUrn);
    const decision = decideFxTreatment(
      row.type,
      boundProductId,
      originating,
      treatmentStore,
      register,
    );
    if (!decision.applyFxPostingRules) {
      // Surface ONE skip per instance (the event fold surfaces one per event; the
      // recon gate compares NET, and a skipped instance contributes to neither
      // side — so a single representative skip is faithful and non-divergent).
      const firstKind = grouped[0]?.payload.kind ?? "FilInstrumentCreated";
      skipped.push({
        instance: instanceUrn,
        kind: firstKind,
        reason: decision.reason === "ok" ? "treatment-unresolved" : decision.reason,
        detail: decision.detail,
      });
      continue;
    }

    // Per-instance election override (FX3) — identical to the event fold.
    const ifrsElection = findInstanceElection(electionRegister, instanceUrn, "ifrs-classification");
    let electionOverride: FxElectionOverride | undefined;
    if (ifrsElection?.ifrsCategory !== undefined) {
      electionOverride = { ifrsCategory: ifrsElection.ifrsCategory };
      const devKey = `${instanceUrn}::ifrs-classification`;
      if (!recordedDeviations.has(devKey)) {
        recordedDeviations.add(devKey);
        deviations.push({
          instance: instanceUrn,
          facet: "ifrs-classification",
          detail: `IFRS classification elected to ${ifrsElection.ifrsCategory} (overrides product default)`,
          cites: ifrsElection.cites,
        });
      }
    }

    // Accumulated window-passing OPENING legs (recognition + revaluation) — needed
    // for the state-driven cancellation reversal below.
    const openingLegs: FxPostingLeg[] = [];

    for (const g of grouped) {
      let ruleLegs: FxPostingLeg[];
      let isOpening = false;
      switch (g.payload.kind) {
        case "FilInstrumentCreated":
          ruleLegs = postFxInitialRecognitionLegs(
            g.event.payload as unknown as FilInstrumentCreatedPayload,
          );
          isOpening = true;
          break;
        case "FilInstrumentAmended":
          ruleLegs = postFxRevaluationLegs(
            g.event.payload as unknown as FilInstrumentAmendedPayload,
            electionOverride,
          );
          isOpening = true;
          break;
        case "FilInstrumentTerminated":
          ruleLegs = terminationLegs(g.event.payload as unknown as FilInstrumentTerminatedPayload);
          break;
        case "TradeSettlementExecuted":
          // DUAL-READ (Slice 2): the born-V2 uniform single-asset settlement. Same
          // primitive as the two-leg FX path → byte-identical net per (account,ccy).
          ruleLegs = tradeSettlementExecutedLegs(
            g.event.payload as unknown as TradeSettlementExecutedPayload,
          );
          break;
        case "FilFxSettlementConfirmed":
          ruleLegs = settlementConfirmedLegs(
            g.event.payload as unknown as FilFxSettlementConfirmedPayload,
          );
          break;
        case "FilNdfFixingObserved":
          ruleLegs = ndfFixingObservedLegs(
            g.event.payload as unknown as FilNdfFixingObservedPayload,
          );
          break;
      }

      for (const leg of ruleLegs) {
        if (!leg.postingDate) continue;
        if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;
        legs.push({ ...leg, filEventId: g.event.event_id });
        if (isOpening) openingLegs.push(leg);
      }
    }

    // (3a) STATE-DRIVEN OBS-commitment release. When the register row reached a
    // SETTLED / MATURED terminal stage, release the trade-date OBS commitment by
    // reversing the OBS subset (ACC-9100-*) of the opening legs that folded under
    // THIS lens (D-FX-TRADE-DATE-FVTPL-OBS). A cancelled instance's OBS is released
    // by the cancellation reversal in (3) below, not here.
    const settled = settledTerminations.get(instanceUrn);
    if (
      (row.stage === "settled" || row.stage === "matured") &&
      settled !== undefined &&
      openingLegs.some(isFxObsCommitmentLeg)
    ) {
      const termination = {
        instance: instanceUrn,
        ...(settled.tenant !== undefined ? { tenant: settled.tenant } : {}),
        asOf: settled.asOf,
      };
      for (const leg of postFxObsCommitmentReleaseLegs(openingLegs, termination)) {
        if (!leg.postingDate) continue;
        if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;
        legs.push({ ...leg, filEventId: `${instanceUrn}::obs-commitment-release` });
      }
    }

    // (3) STATE-DRIVEN cancellation reversal. The register row's `stage` is the
    // trigger: when `stage === "cancelled"`, the instance was bare-cancelled (a
    // settled-with-reval termination reaches `stage "settled"`, never "cancelled",
    // and an enriched cancellation is excluded from `bareCancellations` by its
    // terms). The provenance-decoupled `bareCancellations` map supplies the
    // deterministic posting date / tenant (the collapsed register row cannot carry
    // the earliest-cancellation detail). We reverse exactly the opening legs that
    // folded under THIS lens — so a production opening cancelled by a fixture
    // cancellation still nets to zero (the bytes the event fold produces).
    const bare = bareCancellations.get(instanceUrn);
    if (row.stage === "cancelled" && bare !== undefined && openingLegs.length > 0) {
      const cancellation = {
        instance: instanceUrn,
        ...(bare.tenant !== undefined ? { tenant: bare.tenant } : {}),
        asOf: bare.asOf,
      };
      for (const leg of postFxCancellationReversalLegs(openingLegs, cancellation)) {
        if (!leg.postingDate) continue;
        if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;
        legs.push({ ...leg, filEventId: `${instanceUrn}::cancellation-reversal` });
      }
    }
  }

  return { legs, skipped, deviations };
}
