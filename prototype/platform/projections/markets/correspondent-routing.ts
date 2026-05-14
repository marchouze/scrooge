// platform/projections/markets/correspondent-routing.ts
//
// Slice 5 — CorrespondentRoutingProjection (Tomas).
//
// Provides a static routing table for the bank's five operating currencies
// with Herstatt-risk flags for non-CLS pairs. The table is seeded statically
// for the build phase; in the full substrate it would be derived from
// `SettlementInstructionRouted` events emitted by Tomas's payments pipeline.
//
// Per the bank's indirect-participant posture (memory: project_indirect_participant_posture.md):
//   - The bank does not directly join CLS or SAMOS — it accesses via sponsor
//     / correspondent banks.
//   - ZAR settles via SARB/SAMOS (RTGS); no CLS participation for ZAR.
//   - USD/EUR/GBP/JPY settle via CLS-member correspondents.
//
// Principle 1 — this projection is a derived cache; event-sourced updates
//   fold `SettlementInstructionRouted` events when they exist.
// Principle 2 — Herstatt-risk and CLS eligibility cite FMA-S5 (FMA Settlement
//   Risk Framework) and the bank's indirect-participant posture decision.
//
// Authors: Tomas (Operations & payments engineer)
// Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5;
//            D-FX-CORRESPONDENT-PAIR-NAMING (CEO approved 2026-05-09)

import type { Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Row type (public API)
// ---------------------------------------------------------------------------

export type SchemeType = "SWIFT" | "SAMOS" | "CLS" | "BankservAfrica" | "Bilateral";
export type HerstattRisk = "low" | "managed" | "high";

export interface CorrespondentRoutingRow {
  currency: string; // ISO 4217
  correspondentBank: string;
  scheme: SchemeType;
  clsEligible: boolean;
  herstattRisk: HerstattRisk;
  flagBilateral: boolean; // true if non-CLS fallback applies
}

// ---------------------------------------------------------------------------
// Static seed routing table
//
// Per the indirect-participant operating posture and Devon + Tomas named-
// correspondent-pair proposal (PR #58). Correspondent names are generic
// during the build phase; licence-day populates real correspondent LEIs.
// ---------------------------------------------------------------------------

const STATIC_ROUTING_TABLE: readonly CorrespondentRoutingRow[] = [
  {
    currency: "ZAR",
    correspondentBank: "SARB / SAMOS",
    scheme: "SAMOS",
    clsEligible: false,
    herstattRisk: "low",
    flagBilateral: false, // SAMOS is RTGS — zero Herstatt window
  },
  {
    currency: "USD",
    correspondentBank: "Correspondent USD bank",
    scheme: "CLS",
    clsEligible: true,
    herstattRisk: "managed",
    flagBilateral: false,
  },
  {
    currency: "EUR",
    correspondentBank: "Correspondent EUR bank",
    scheme: "CLS",
    clsEligible: true,
    herstattRisk: "managed",
    flagBilateral: false,
  },
  {
    currency: "GBP",
    correspondentBank: "Correspondent GBP bank",
    scheme: "CLS",
    clsEligible: true,
    herstattRisk: "managed",
    flagBilateral: false,
  },
  {
    currency: "JPY",
    correspondentBank: "Correspondent JPY bank",
    scheme: "CLS",
    clsEligible: true,
    herstattRisk: "managed",
    flagBilateral: false,
  },
];

// ---------------------------------------------------------------------------
// In-memory state — overlay from SettlementInstructionRouted events
// ---------------------------------------------------------------------------

/** Mutable overlay on top of the static seed. Keyed by currency. */
const _overlay = new Map<string, Partial<CorrespondentRoutingRow>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rebuild the projection by folding relevant events.
 * Currently folds `SettlementInstructionRouted` events — if none exist,
 * the static seed table is returned unchanged.
 */
export function rebuildCorrespondentRouting(events: readonly Event[]): void {
  _overlay.clear();
  for (const e of events) {
    if (e.type !== "SettlementInstructionRouted") continue;
    const p = e.payload as Record<string, unknown>;
    const currency = typeof p.currency === "string" ? p.currency : null;
    if (!currency) continue;
    // Merge event-derived fields into the overlay
    _overlay.set(currency, {
      ..._overlay.get(currency),
      ...(typeof p.correspondentBank === "string"
        ? { correspondentBank: p.correspondentBank }
        : {}),
      ...(typeof p.scheme === "string" ? { scheme: p.scheme as SchemeType } : {}),
      ...(typeof p.clsEligible === "boolean" ? { clsEligible: p.clsEligible } : {}),
      ...(typeof p.herstattRisk === "string"
        ? { herstattRisk: p.herstattRisk as HerstattRisk }
        : {}),
      ...(typeof p.flagBilateral === "boolean" ? { flagBilateral: p.flagBilateral } : {}),
    });
  }
}

/**
 * Returns the correspondent routing table (static seed merged with any
 * event-derived overrides).
 */
export function getCorrespondentRouting(): CorrespondentRoutingRow[] {
  return STATIC_ROUTING_TABLE.map((row) => {
    const overlay = _overlay.get(row.currency);
    if (!overlay) return row;
    return { ...row, ...overlay };
  });
}
