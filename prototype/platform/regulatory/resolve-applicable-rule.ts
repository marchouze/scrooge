// platform/regulatory/resolve-applicable-rule.ts
//
// The resolution primitive: "Basel baseline, superseded when local regulation
// requires it." For a given (jurisdiction, Basel provision, as-of date), return
// the rule that actually governs — the local adoption if one is in force on
// that date, otherwise the Basel baseline (the fallback that makes Basel the
// operating base for any jurisdiction that has not spoken).
//
// This is a PURE function over the typed adoption registry (basel-adoption.ts),
// which is the "register" projection of the regulatory graph. It is the seam a
// later full-runtime-wiring slice plugs into; today it is a queryable, tested
// provenance function, not yet on the engine hot path.
//
// Authority: D-BASEL-CATALOGUE-PILLAR-1 (CEO session-delegation 2026-06-04).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { parseUrn } from "../citation/urn";
import {
  type AdoptionEdge,
  type AdoptionType,
  ADOPTION_EDGES,
  type BaselProvision,
  findBaselProvision,
} from "./basel-adoption";

/** Where the governing rule came from. */
export type RuleSource = "local" | "basel-baseline";

export interface ResolvedRule {
  /** "local" when a jurisdiction adoption edge governs; otherwise the Basel fallback. */
  readonly source: RuleSource;
  /** The Basel baseline provision (always present — the spine of the resolution). */
  readonly baseline: BaselProvision;
  /** The citation URN that governs: the local instrument when source==="local", else the Basel provision. */
  readonly citation: string;
  /** Adoption relationship when a local edge governs. */
  readonly adoptionType?: AdoptionType;
  /** Typed variation, when the local edge is MODIFIES / GOLD_PLATES / SUPERSEDES. */
  readonly delta?: string;
  /** True when the governing local rule is stricter than Basel (GOLD_PLATES). */
  readonly stricter?: boolean;
  /** The local instrument URN, when source==="local". */
  readonly localInstrument?: string;
}

export type ResolveError = { readonly error: string };

export type ResolveResult = ResolvedRule | ResolveError;

/** Narrowing helper for callers. */
export function isResolved(r: ResolveResult): r is ResolvedRule {
  return (r as ResolvedRule).baseline !== undefined;
}

function edgeInForce(edge: AdoptionEdge, asOfDate: string): boolean {
  if (edge.effectiveFrom > asOfDate) return false;
  if (edge.effectiveTo !== undefined && edge.effectiveTo <= asOfDate) return false;
  return true;
}

/**
 * Resolve the rule governing `provisionUrn` in `jurisdiction` on `asOfDate`.
 *
 * @param jurisdiction lowercase jurisdiction code, e.g. "za", "kw".
 * @param provisionUrn a catalogued Basel provision URN, e.g. "urn:reg:bcbs:lcr:20.1".
 * @param asOfDate     ISO date (YYYY-MM-DD); resolution is date-scoped so a
 *                     supersession returns the rule effective on that date.
 *
 * Returns the local rule when an ADOPTS/MODIFIES/GOLD_PLATES/SUPERSEDES edge is
 * in force on `asOfDate`; otherwise the Basel baseline (SILENT → fallback).
 * Returns `{ error }` if the provision URN is malformed or not catalogued.
 */
export function resolveApplicableRule(
  jurisdiction: string,
  provisionUrn: string,
  asOfDate: string,
): ResolveResult {
  const parsed = parseUrn(provisionUrn);
  if (parsed.kind === "error") {
    return { error: `invalid provision URN: ${parsed.reason}` };
  }
  if (parsed.urnClass !== "reg" || !provisionUrn.startsWith("urn:reg:bcbs:")) {
    return { error: `provision URN must be a Basel baseline (urn:reg:bcbs:...): ${provisionUrn}` };
  }

  const baseline = findBaselProvision(provisionUrn);
  if (baseline === undefined) {
    return { error: `Basel provision not catalogued: ${provisionUrn}` };
  }

  const jur = jurisdiction.toLowerCase();
  const candidates = ADOPTION_EDGES.filter(
    (e) => e.jurisdiction === jur && e.baselProvision === provisionUrn && edgeInForce(e, asOfDate),
  );

  if (candidates.length === 0) {
    // SILENT — no local adoption in force on this date; Basel governs by default.
    return { source: "basel-baseline", baseline, citation: baseline.urn };
  }

  // Most-recently-effective edge wins when several are in force (handles
  // staged supersession: the latest effectiveFrom on/before asOfDate governs).
  const governing = candidates.reduce((latest, e) =>
    e.effectiveFrom > latest.effectiveFrom ? e : latest,
  );

  return {
    source: "local",
    baseline,
    citation: governing.localInstrument,
    adoptionType: governing.adoptionType,
    delta: governing.delta,
    stricter: governing.stricter,
    localInstrument: governing.localInstrument,
  };
}
