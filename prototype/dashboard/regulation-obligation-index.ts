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
import { loadStructuredDocBySlug } from "../platform/regulatory/structured-doc-loader";
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

/** A provision the obligation traces to, qualified by its owning regulation. */
export interface OwnedProvision {
  slug: string;
  provId: string;
}

const KEY_SEP = "::";

/**
 * Compose the qualified key used by `byProvision`. Provision ids alone are NOT
 * globally unique — a bare section id like "s4-1" recurs across regulations, so
 * an obligation tracing to banks-d7-2023 §4.1 must not surface under another
 * instrument's §4.1. Qualifying by slug eliminates that collision.
 */
export function provisionKey(slug: string, provId: string): string {
  return `${slug}${KEY_SEP}${provId}`;
}

/**
 * Parse the owning slug out of a GRAPH provision node id. SA provisions are
 * `PROV-<SLUG-UPPER>-s<n>`; BCBS are `urn:reg:bcbs:<chapter>:<para>`. Returns
 * null when the id carries no resolvable slug (then the obligation's anchor
 * regulation is used instead).
 */
export function graphProvisionSlug(provId: string): string | null {
  const sa = provId.match(/^PROV-(.+?)-s[^-]*$/i);
  if (sa?.[1]) return sa[1].toLowerCase();
  const bcbs = provId.match(/^urn:reg:bcbs:([a-z]+):/i);
  if (bcbs?.[1]) return `bcbs-${bcbs[1].toLowerCase()}`;
  return null;
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
   * `provisionKey(slug, provId)` → adopted obligations tracing back to that
   * provision. The key is QUALIFIED by the owning regulation slug so a bare
   * section id (e.g. "s4-1") cannot collide across instruments. A reader looks
   * up `provisionKey(itsSlug, candidateId)` for each candidate provision id.
   */
  byProvision: Map<string, EnrichedObligationRef[]>;
  /** Obligation id → its enriched ref (for the forward list + dedup). */
  byObligationId: Map<string, EnrichedObligationRef>;
  /**
   * Obligation id → the provisions it traces to, each qualified by its owning
   * regulation slug (the backward "view in source regulation" jump target).
   */
  provisionsForObligation: Map<string, OwnedProvision[]>;
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
  const provisionsForObligation = new Map<string, OwnedProvision[]>();

  // Memoise "is this citation a structured-doc slug?" — distinct citations are
  // few (~one per instrument) so this caps the file probes loadStructuredDocBySlug
  // would otherwise do per obligation.
  const slugCitationCache = new Map<string, boolean>();
  const citationIsSlug = (c: string): boolean => {
    if (!c) return false;
    const cached = slugCitationCache.get(c);
    if (cached !== undefined) return cached;
    const ok = loadStructuredDocBySlug(c) !== null;
    slugCitationCache.set(c, ok);
    return ok;
  };

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

    // Resolve each provision to its OWNING regulation slug:
    //   - graph EXPRESSES edges carry a slug in the node id itself.
    //   - derivesFrom ids (tick-flow) belong to the obligation's anchor
    //     regulation = its `citation` when that is a structured-doc slug. This
    //     correctly attributes bare ids (e.g. "s4-1") that would otherwise
    //     collide with same-numbered sections in unrelated instruments.
    const anchorSlug = citationIsSlug(o.citation) ? o.citation : null;
    const owned: OwnedProvision[] = [];
    const seen = new Set<string>();
    const add = (slug: string | null, provId: string) => {
      if (!slug) return;
      const key = provisionKey(slug, provId);
      if (seen.has(key)) return;
      seen.add(key);
      owned.push({ slug, provId });
    };
    for (const fromId of provisionsByObl.get(o.id) ?? []) {
      add(graphProvisionSlug(fromId), fromId);
    }
    for (const p of o.derivesFrom) {
      add(anchorSlug ?? graphProvisionSlug(p), p);
    }

    provisionsForObligation.set(
      o.id,
      [...owned].sort((a, b) =>
        a.slug !== b.slug ? a.slug.localeCompare(b.slug) : a.provId.localeCompare(b.provId),
      ),
    );
    for (const { slug, provId } of owned) {
      const key = provisionKey(slug, provId);
      const list = byProvision.get(key) ?? [];
      list.push(ref);
      byProvision.set(key, list);
    }
  }

  return { byProvision, byObligationId, provisionsForObligation };
}
