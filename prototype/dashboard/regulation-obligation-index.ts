// dashboard/regulation-obligation-index.ts
//
// The bidirectional join at the heart of the unified Regulations module.
//
// Plane A (regulatory knowledge: graph.db + structured JSON) and Plane B
// (event-sourced bank obligations: event.db) are kept separate by
// D-REGULATORY-ARCHITECTURE-TWO-PLANE. The forward link is already stored ONCE:
// a bank obligation's `derivesFrom` (in the ObligationAdopted event payload),
// plus the graph's `EXPRESSES` edges (provision → source obligation). This
// module computes the REVERSE index at read time — provision → the adopted
// bank obligations that trace back to it — so a regulation viewer can surface
// the obligations it generated WITHOUT duplicating the link (Principle 1: a
// pure query over events + reference graph, never stored state).
//
// Each ref is enriched with the three emphases the surface foregrounds:
//   - lifecycle status      (BankObligation.status / lastTransition)
//   - applicability verdict (W8 ApplicabilityAssessment* fold — shared helper)
//   - owner seat TITLE      (domain-ownership map; Title only, never the agent
//                            personal name — the V2 UI masking rule)
//
// Author: Atlas (Core banking platform architect, engineering).

import type { Database } from "bun:sqlite";

import type { EventStore } from "../platform/event-store/store";
import { obligationTitle } from "../platform/obligations/presentation";
import { loadBankObligations } from "../platform/obligations/projection";
import {
  SEAT_AGENT,
  type Seat,
  seatForObligation,
} from "../platform/regulatory/domain-ownership-map";
import { getDb } from "../platform/regulatory/graph/db";
import {
  type LatestApplicability,
  foldLatestApplicabilityBySubject,
} from "./obligation-applicability";

/**
 * Resolve a seat to its public TITLE (position). Returns null for an
 * unclassifiable obligation. The agent personal NAME is never returned — the
 * V2 UI surfaces seats by title only.
 */
export function seatTitle(seat: Seat | null): string | null {
  return seat ? SEAT_AGENT[seat].position : null;
}

/** One adopted bank obligation as it appears back-populated onto a provision. */
export interface EnrichedObligationRef {
  /** Bank obligation id (e.g. `ORG-FC-02`) — links to the obligation drill-down. */
  id: string;
  /** Short obligation NAME (not the requirement prose). */
  title: string;
  /** Current lifecycle status (adopted → … → attested). */
  status: string;
  /** Most recent lifecycle transition label, when any. */
  lastTransition?: string;
  /** Latest W8 applicability verdict, when the obligation has a concluded one. */
  applicability?: LatestApplicability;
  /** Accountable seat TITLE (masked — never the agent name); null if unclassifiable. */
  ownerSeatTitle: string | null;
  /** The source provision id(s) this obligation derives from (the stored link). */
  derivesFrom: readonly string[];
}

export interface RegulationObligationIndex {
  /**
   * Provision id → adopted obligations tracing back to it. Keys span BOTH
   * provision-id spaces in play, so a reader can look up whichever id it holds:
   *   - graph `EXPRESSES` edge ids (`PROV-<SLUG>-s<n>`)
   *   - structured-doc ids carried in `derivesFrom` (`<slug>-<num>`, tick-flow)
   */
  byProvision: Map<string, EnrichedObligationRef[]>;
  /** Obligation id → its enriched ref (for the forward list + dedup). */
  byObligationId: Map<string, EnrichedObligationRef>;
  /** Obligation id → the provision ids it traces to (the backward jump target). */
  provisionsForObligation: Map<string, string[]>;
}

/**
 * Build the reverse index from the event store (Plane B) and the regulatory
 * graph (Plane A). One EXPRESSES sweep, one applicability fold — no per-row
 * graph queries.
 *
 * @param db injectable graph handle (defaults to the shared `getDb()`
 *   singleton) so the builder is unit-testable against an in-memory graph.
 */
export function buildRegulationObligationIndex(
  store: EventStore,
  db: Database = getDb(),
): RegulationObligationIndex {
  const adopted = loadBankObligations(store).filter((o) => o.adopted);
  const applicabilityBySubject = foldLatestApplicabilityBySubject(store);

  // EXPRESSES sweep: provision (from_id) → OBL-<id> (to_id). One query for the
  // whole population, indexed by bare obligation id.
  const provisionsByObl = new Map<string, Set<string>>();
  const edgeRows = db
    .prepare(
      `SELECT from_id AS prov, to_id AS obl FROM graph_edges
       WHERE edge_type = 'EXPRESSES' AND to_id LIKE 'OBL-%'`,
    )
    .all() as Array<{ prov: string; obl: string }>;
  for (const r of edgeRows) {
    const id = r.obl.replace(/^OBL-/, "");
    const set = provisionsByObl.get(id) ?? new Set<string>();
    set.add(r.prov);
    provisionsByObl.set(id, set);
  }

  const byProvision = new Map<string, EnrichedObligationRef[]>();
  const byObligationId = new Map<string, EnrichedObligationRef>();
  const provisionsForObligation = new Map<string, string[]>();

  for (const o of adopted) {
    const seat = seatForObligation({
      id: o.id,
      citation: o.citation,
      requirement: o.requirement,
    });
    const applicability = applicabilityBySubject.get(o.id);
    const ref: EnrichedObligationRef = {
      id: o.id,
      title: obligationTitle(o),
      status: o.status,
      ...(o.lastTransition ? { lastTransition: o.lastTransition.transition } : {}),
      ...(applicability ? { applicability } : {}),
      ownerSeatTitle: seatTitle(seat),
      derivesFrom: o.derivesFrom,
    };
    byObligationId.set(o.id, ref);

    // Provision ids from BOTH spaces — graph EXPRESSES edges + the obligation's
    // own derivesFrom (tick-flow obligations carry structured-doc provision ids
    // directly and have no EXPRESSES edge).
    const provs = new Set<string>(provisionsByObl.get(o.id) ?? []);
    for (const p of o.derivesFrom) provs.add(p);

    provisionsForObligation.set(o.id, [...provs].sort());
    for (const p of provs) {
      const list = byProvision.get(p) ?? [];
      list.push(ref);
      byProvision.set(p, list);
    }
  }

  return { byProvision, byObligationId, provisionsForObligation };
}
