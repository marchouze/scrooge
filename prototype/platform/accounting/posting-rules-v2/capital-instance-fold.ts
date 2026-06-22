// platform/accounting/posting-rules-v2/capital-instance-fold.ts
//
// STATE-DRIVEN CAPITAL GL derivation (the capital sub-step of Step C/D,
// D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
//
// THE SHIFT THIS MAKES
// --------------------
// `foldCapitalContributionLegs` (`./capital-fold.ts`) derives the capital GL legs
// by REPLAYING the raw `FilInstrumentCreated` / `FilInstrumentTerminated` (capital)
// lifecycle events and dispatching a per-event `kind` switch. That is the same
// anti-pattern the FIL consumer surface exists to remove (and that Step C already
// removed for FX): the accounting consumer re-implements a lifecycle walk the FIL
// register already owns, and has to "remember" each event type to know which
// instances exist and what their terminal treatment is.
//
// `deriveCapitalInstanceLegs` derives the SAME legs from the FIL STATE register
// (`foldFilInstances`): it folds the register, selects capital rows by their type
// (`isCapitalPostingInstance(row.type)`), and reads each instance's `stage` to
// decide the terminal treatment. Which rows are capital, and whether an instance
// has reached a terminal stage — STATE — come from the register, NEVER from an
// event scan.
//
// STATE vs FLOW — the boundary the brief draws
// --------------------------------------------
// `stage` and the set of capital instances — STATE — come from the register. The
// recognition / redemption leg AMOUNTS are per-event FLOW facts:
//   - Issuance legs read the CREATED event's `economicTerms` (notional + the
//     `qualifyingCapital` tier) — the register intentionally collapses to
//     latest-terms (an amendment would overwrite `economicTerms`), but the capital
//     event fold posts the ORIGINAL created notional and ignores amendments
//     (FilInstrumentAmended carries no capital posting arithmetic yet — a tracked
//     gap). Sourcing issuance from the created event keeps the derived net
//     byte-identical to the event fold even when an amendment has collapsed the
//     register row's terms.
//   - Redemption legs read the TERMINATED event payload (today a zero-amount memo,
//     byte-symmetric with the FX-close memo — proceeds are a tracked deferred gap).
// So the per-instance legs are sourced from the instance's grouped lifecycle event
// payloads (FLOW amounts), while the STATE that drives the structure (which rows,
// whether terminal) comes solely from `foldFilInstances`. This keeps
// `deriveCapitalInstanceLegs` byte-identical in NET per `(accountCode,currency)` to
// `foldCapitalContributionLegs`, while the consumer no longer replays
// `FilInstrument*` for state.
//
// WHY NO CANCELLATION-REVERSAL (unlike FX)
// ----------------------------------------
// The FX event fold special-cases bare cancellations (reversing the opening legs)
// because an FX recognition posts a standing notional pair that must net to zero on
// cancellation. Capital has no such reversal: `postCapitalRedemptionLegs` posts a
// ZERO-AMOUNT memo for EVERY terminal stage (settled / matured / cancelled /
// terminated) — the redemption proceeds + prior-notional reversal are a tracked
// deferred gap in `v2-core/posting-rules/capital.ts`. So a terminated capital
// instance's net contribution is its issuance pair (unchanged) plus a zero memo;
// there is nothing to reverse. The register `stage` therefore drives only WHICH
// terminal memo legs to emit (the terminated event's), not a reversal — exactly
// what the event fold does, sourced from state here.
//
// DARK→WIRED: built + unit-proven byte-equivalent to the event fold, then wired
// into `gl-projection-v2.ts` replacing `foldCapitalContributionLegs` (the event
// fold REMAINS in-tree as the oracle — Step D). Nothing else changes the bytes.
//
// PACKAGE BOUNDARY: v1 side (`platform/`) — MAY import from `v2-core/`.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-V2-UI-VISIBILITY-REMEDIATION; D-CAPITAL-ASSET-CLASS-V1;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   D-ENGINEERING-INTEGRITY-CHARTER (root-cause; fail-closed; replay-safe).
//   IAS-32-§22; IAS-32-§33; IFRS-9-§3.1.1; IFRS-9-§4.2.1; Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRegister,
  foldFilInstances,
} from "../../../v2-core/fil-instances";
import type {
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import {
  type CapitalPostingLeg,
  isCapitalPostingInstance,
  postCapitalIssuanceLegs,
  postCapitalRedemptionLegs,
} from "../../../v2-core/posting-rules/capital";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";
import type { CapitalFoldLeg, CapitalFoldResult } from "./capital-fold";

// ---------------------------------------------------------------------------
// Capital FIL lifecycle event family — same set the event fold reads, used here
// to (a) build the state register and (b) source per-event FLOW amounts.
// ---------------------------------------------------------------------------

const CAPITAL_FIL_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

// The register projection folds the three kernel lifecycle kinds in lifecycle
// order (Created → Amended → Terminated) for a replay-stable, latest-wins fold.
const REGISTER_EVENT_KIND_LIST = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

export interface CapitalInstanceFoldArgs {
  /** Store holding the capital FIL lifecycle events (the canonical event store). */
  readonly eventStore: EventStore;
  /** Entity short-id the capital instances belong to. */
  readonly entity: string;
  /** Inclusive posting-date window lower bound (ISO date). */
  readonly periodStart: string;
  /** Inclusive posting-date window upper bound (ISO date). */
  readonly periodEnd: string;
  /**
   * Provenance lens for the derivation. Defaults to `defaultProvenanceFilter()`
   * (the operating-book read), matching `foldCapitalContributionLegs` exactly so
   * the cutover is byte-stable and the equivalence proof compares like for like.
   */
  readonly filter?: ProvenanceFilter;
}

// ---------------------------------------------------------------------------
// The minimal payload shape the derivation reads off each lifecycle event.
// ---------------------------------------------------------------------------

interface FilLifecyclePayloadMinimal {
  readonly kind?: string;
  readonly type?: string;
  readonly instance?: string;
}

/** One lifecycle event grouped under its instance, in deterministic order. */
interface GroupedFilEvent {
  readonly event: Event;
  readonly payload: FilLifecyclePayloadMinimal;
}

// ---------------------------------------------------------------------------
// deriveCapitalInstanceLegs — STATE-driven derivation.
//
// 1. Read the capital FIL lifecycle events under the provenance lens (same
//    admission as the event fold), build the STATE register via `foldFilInstances`
//    from the FULL register-kind stream, and group the lens-admitted events per
//    instance for FLOW-amount sourcing.
// 2. Iterate the REGISTER. For each capital row (`isCapitalPostingInstance(row.type)`):
//    emit the per-instance legs from the grouped events (issuance from the created
//    event's terms; the terminal memo from the terminated event). The register
//    `stage` confirms terminal state without an event scan.
// ---------------------------------------------------------------------------

export function deriveCapitalInstanceLegs(args: CapitalInstanceFoldArgs): CapitalFoldResult {
  const filter = args.filter ?? defaultProvenanceFilter();

  // (1a) Read the capital FIL lifecycle events under the provenance lens, in the
  // SAME cross-type ordering the event fold uses (as_of, then event_id), so the
  // derived legs are emitted in an identical sequence. These are the lens-admitted
  // FLOW events that produce LEGS.
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

  // (1b) Build the STATE register from the FULL register-kind stream (entity-scoped,
  // NO provenance filter). The register `stage` is the surface that replaces the
  // event-scan for terminal detection; sourcing it from the full stream keeps the
  // state read provenance-independent while leg emission stays lens-scoped (the FX
  // derivation makes the same decision). Iterate the register kinds in lifecycle
  // order so the projection applies creation before any amendment / termination.
  const registerEvents: FilInstanceLifecycleEvent[] = [];
  for (const t of REGISTER_EVENT_KIND_LIST) {
    for (const e of args.eventStore.replay({ entity: args.entity, type: t })) {
      registerEvents.push(e.payload as unknown as FilInstanceLifecycleEvent);
    }
  }
  const stateRegister: FilInstanceRegister = foldFilInstances(registerEvents);

  // Group every lens-admitted lifecycle event by instance, preserving the global
  // sort order. The FLOW legs are sourced from these grouped payloads.
  const eventsByInstance = new Map<string, GroupedFilEvent[]>();
  for (const e of filEvents) {
    const payload = e.payload as unknown as FilLifecyclePayloadMinimal;
    const instance = payload.instance ?? "";
    const acc = eventsByInstance.get(instance) ?? [];
    acc.push({ event: e, payload });
    eventsByInstance.set(instance, acc);
  }

  const legs: CapitalFoldLeg[] = [];

  // (2) Iterate the REGISTER. The register's insertion order follows creation
  // order; the per-(accountCode,currency) net is order-independent, so this is the
  // stable per-instance walk.
  for (const [instanceUrn, row] of stateRegister) {
    // Capital rows only — selected off the STATE row's type (NOT an event scan).
    if (!isCapitalPostingInstance(row.type)) continue;

    const grouped = eventsByInstance.get(instanceUrn) ?? [];
    if (grouped.length === 0) continue; // register row with no lens-admitted event

    for (const g of grouped) {
      const kind = g.payload.kind ?? g.event.type;
      let ruleLegs: CapitalPostingLeg[];
      if (kind === "FilInstrumentCreated") {
        // Issuance — read the created event's economic terms (FLOW).
        ruleLegs = postCapitalIssuanceLegs(
          g.event.payload as unknown as FilInstrumentCreatedPayload,
        );
      } else if (kind === "FilInstrumentTerminated") {
        // Terminal memo — the register `stage` confirms this instance reached a
        // terminal stage; the leg amounts come from the terminated event (FLOW).
        ruleLegs = postCapitalRedemptionLegs(
          g.event.payload as unknown as FilInstrumentTerminatedPayload,
        );
      } else {
        // FilInstrumentAmended — no capital posting arithmetic yet (tracked gap),
        // mirroring the event fold's amended handling.
        continue;
      }

      for (const leg of ruleLegs) {
        if (!leg.postingDate) continue;
        if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;
        legs.push({ ...leg, filEventId: g.event.event_id });
      }
    }
  }

  return { legs };
}
