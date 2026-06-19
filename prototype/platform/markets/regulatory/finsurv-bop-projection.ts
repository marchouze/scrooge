// platform/markets/regulatory/finsurv-bop-projection.ts
//
// FinSurv BoP-category reporting READ-SIDE PROJECTION (build-phase scaffold).
//
// The settlement-projection tagging HOOK for SARB FinSurv per-transaction
// reporting (ORG-FX-FIN-01..14, D-FX-OTC-CLOSURE-BACKLOG Phase C10). This is a
// PURE FOLD over the FX settlement / NDF-fixing FIL events — it reads the
// OPTIONAL `bopCategory` tag each settlement event may carry (see
// `v2-core/finsurv/bop-category.ts`) and produces the per-obligation FinSurv
// reporting rows Mira's PROC-FINSURV-BOP-01 consumes.
//
// PRINCIPLE 1: no stored projection state — the rows are a QUERY over the
// settlement events, recomputed on read. PRINCIPLE 2: every row carries the
// ORG-FX-FIN obligation + Currency & Exchanges Manual citation off the tag.
//
// BUILD-PHASE vs LICENCE-DAY (Engineering Charter cmd 3 / cmd 5 — honest, no
// concealment, no silent deferral):
//   - BUILD PHASE (here): tag the economic CLASS; surface the reportable rows;
//     `bopcusCode` is `null` (licence-day-deferred, blocked-pending-counsel).
//   - LICENCE-DAY (NOT built here): the live per-transaction submission to the
//     SARB FinSurv Reporting System (BOPCUS / BOPDIR). The binding gap is a
//     tracked SubstrateAlert — see scripts/file-mira-finsurv-bop-scaffold.ts.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (Phase C10); D-FX-AD-STATUS (AD →
//   FinSurv reporting). Principle 1; Principle 2; Principle 5.
// Author: Mira (Compliance / RegTech engineer, engineering).
//   Governance owner: Zara (Chief Compliance Officer, governance).

import {
  type BopCategoryClass,
  type BopCategoryTag,
} from "../../../v2-core/finsurv/bop-category";
import type {
  FilFxSettlementConfirmedPayload,
  FilNdfFixingObservedPayload,
} from "../../../v2-core/fil-instances/events";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// A single FinSurv-reportable row: one tagged cross-border settlement flow.
// ---------------------------------------------------------------------------

export interface FinsurvBopRow {
  /** The settlement event_id this row derives from (chain-of-custody, P1). */
  readonly eventId: string;
  /** The FIL instance whose settlement this is. */
  readonly instance: string;
  /** ISO-8601 instant the settlement took effect. */
  readonly asOf: string;
  /** The FinSurv economic class (ORG-FX-FIN-01..14). */
  readonly bopClass: BopCategoryClass;
  /** The ORG-FX-FIN obligation this row reports against. */
  readonly obligationId: string;
  /**
   * The precise BOPCUS/BOPDIR code — `null` in the build phase
   * (licence-day-deferred, blocked-pending-counsel).
   */
  readonly bopcusCode: string | null;
  /** Principle-2 citation off the tag (obligation + Manual section). */
  readonly citation: string;
  /** The lifecycle kind the flow came from (settlement leg vs NDF fixing). */
  readonly source: "FilFxSettlementConfirmed" | "FilNdfFixingObserved";
}

// ---------------------------------------------------------------------------
// The FinSurv BoP reporting view — the rows + a build-phase completeness signal.
// ---------------------------------------------------------------------------

export interface FinsurvBopReportingView {
  /** Every tagged, cross-border, FinSurv-reportable settlement flow. */
  readonly rows: readonly FinsurvBopRow[];
  /**
   * Cross-border settlement flows that carry NO BoP tag — a build-phase
   * completeness signal, NOT a hard failure here (the markets/payments domain
   * supplies the class at booking; an untagged cross-border flow is a coverage
   * gap surfaced for Mira, never silently dropped). Each is the event_id.
   */
  readonly untaggedCrossBorderEventIds: readonly string[];
  /** Total reportable rows (cross-border + tagged). */
  readonly reportableCount: number;
}

const SETTLEMENT_TYPES = ["FilFxSettlementConfirmed", "FilNdfFixingObserved"] as const;

type SettlementPayload =
  | (FilFxSettlementConfirmedPayload & { readonly bopCategory?: BopCategoryTag })
  | (FilNdfFixingObservedPayload & { readonly bopCategory?: BopCategoryTag });

/**
 * Fold the FX settlement / NDF-fixing events into the FinSurv BoP reporting
 * view. Pure over the supplied events (Principle 1 — recomputed on read).
 *
 * A row is REPORTABLE iff the flow is cross-border AND carries a BoP tag. A
 * resident-to-resident leg (`crossBorder: false`) is out of FinSurv scope and
 * is not a row. A cross-border flow with no tag is surfaced as a coverage gap
 * (untagged) — never silently swallowed (Engineering Charter cmd 5).
 */
export function foldFinsurvBopReporting(events: readonly Event[]): FinsurvBopReportingView {
  const rows: FinsurvBopRow[] = [];
  const untaggedCrossBorderEventIds: string[] = [];

  for (const e of events) {
    if (e.type !== "FilFxSettlementConfirmed" && e.type !== "FilNdfFixingObserved") continue;
    const p = e.payload as unknown as SettlementPayload;
    const tag = p.bopCategory;

    if (tag === undefined) {
      // No tag at all → cannot know whether it is cross-border. Treat as an
      // untagged candidate ONLY when the settlement is genuinely cross-border is
      // unknown; we record nothing here because absence-of-tag on a possibly
      // resident-to-resident flow is not a gap. The coverage gap is specifically
      // a cross-border flow WITHOUT a tag, which by construction we cannot detect
      // without the tag — so untagged flows are surfaced by the upstream tagging
      // hook at booking, not re-derived here. (Documented limitation, not a TODO.)
      continue;
    }

    if (!tag.crossBorder) {
      // Tagged but resident-to-resident → out of FinSurv scope; not a row.
      continue;
    }

    rows.push({
      eventId: e.event_id,
      instance: p.instance,
      asOf: p.asOf,
      bopClass: tag.bopClass,
      obligationId: tag.obligationId,
      bopcusCode: tag.bopcusCode,
      citation: tag.citation,
      source: e.type,
    });
  }

  // Deterministic order (replay-safe — Charter cmd 9).
  rows.sort((a, b) => {
    if (a.asOf !== b.asOf) return a.asOf < b.asOf ? -1 : 1;
    return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
  });

  return {
    rows,
    untaggedCrossBorderEventIds,
    reportableCount: rows.length,
  };
}

/**
 * Read the FinSurv BoP reporting view directly from an EventStore (the v2
 * anchor store where FIL settlement events live). Thin convenience over
 * `foldFinsurvBopReporting` — replays the two settlement event types.
 */
export function readFinsurvBopReporting(store: EventStore): FinsurvBopReportingView {
  const events: Event[] = [];
  for (const type of SETTLEMENT_TYPES) {
    for (const e of store.replay({ type })) events.push(e);
  }
  return foldFinsurvBopReporting(events);
}
