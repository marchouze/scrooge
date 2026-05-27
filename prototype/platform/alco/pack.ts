// platform/alco/pack.ts
//
// ALCO pack generator — assembles a typed ALCOPack from the event store.
//
// Reads the most recent event for each of the eight ALCO sections and
// assembles a single ALCOPack object. Each section is nullable — if no
// relevant event is found the section is set to null and the section name
// is added to `sectionsWithNoData`.
//
// This is intentionally tolerant of an empty event store (build-phase
// posture: all queries will return nothing, all sections will be null,
// `overallTreasuryStatus` will be "no-positions").
//
// Sections:
//   1. Liquidity     — LCRComputed + NSFRComputed (latest)
//   2. HQLA          — CollateralInventorySnapshotted (latest)
//   3. ALM/IRRBB     — ALMRunCompleted (latest)
//   4. Intraday      — IntradayHQLAStressProjection (latest, scenario=stress)
//   5. FTP curve     — FtpCurvePublished (latest)
//   6. ILAAP summary — ILAAPSummaryCompleted (latest)
//   7. Open risk     — AppetiteBreach + HQLACompositionDrift (past 30 days)
//   8. Proposed      — placeholder (to be completed by Eitan at ALCO)
//
// Authority: D-TREASURY-GAPS-WAVE1; BA 325; BA 326; BCBS d365;
//   Banks Act 94 of 1990.
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import type { IntradayHQLAStressProjectionPayload } from "../event-store/event-types/alco";
import type { ALMRunCompletedPayload } from "../event-store/event-types/alm";
import type { CollateralInventorySnapshotPayload } from "../event-store/event-types/collateral";
import type { FtpCurvePublishedPayload } from "../event-store/event-types/ftp";
import type { ILAAPSummaryCompletedPayload } from "../event-store/event-types/ilaap";
import type { LCRComputedPayload, NSFRComputedPayload } from "../event-store/event-types/liquidity";
import type {
  AppetiteBreachPayload,
  HQLACompositionDriftPayload,
} from "../event-store/event-types/risk-treasury-extended";

// ---------------------------------------------------------------------------
// Section types
// ---------------------------------------------------------------------------

export interface LiquiditySection {
  readonly lcr: LCRComputedPayload;
  readonly nsfr: NSFRComputedPayload;
}

export interface HQLASection {
  readonly snapshot: CollateralInventorySnapshotPayload;
}

export interface ALMSection {
  readonly run: ALMRunCompletedPayload;
}

export interface IntradaySection {
  readonly projection: IntradayHQLAStressProjectionPayload;
}

export interface FTPSection {
  readonly curve: FtpCurvePublishedPayload;
}

export interface ILAAPSection {
  readonly summary: ILAAPSummaryCompletedPayload;
}

export interface RiskItem {
  readonly type: "AppetiteBreach" | "HQLACompositionDrift";
  readonly id: string;
  readonly domain: string;
  readonly severity: string;
  readonly detectedAt: string;
  readonly description: string;
}

export interface RiskItemSection {
  readonly items: readonly RiskItem[];
}

// ---------------------------------------------------------------------------
// ALCOPack — the assembled pack
// ---------------------------------------------------------------------------

export interface ALCOPack {
  readonly asOf: string;
  readonly cycleLabel: string;
  readonly liquidity: LiquiditySection | null;
  readonly hqlaComposition: HQLASection | null;
  readonly almIRRBB: ALMSection | null;
  readonly intradayLiquidity: IntradaySection | null;
  readonly ftpCurve: FTPSection | null;
  readonly ilaapSummary: ILAAPSection | null;
  readonly openRiskItems: RiskItemSection;
  readonly proposedResolutions: string;
  readonly sectionsWithNoData: string[];
  readonly overallTreasuryStatus: "green" | "amber" | "red" | "no-positions";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ISO 8601 date 30 days before `asOf`.
 */
function thirtyDaysBeforeAsOf(asOf: string): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString();
}

/**
 * Derives the cycle label from asOf.
 * Example: "2026-05-19T00:00:00Z" → "2026-05 Monthly".
 */
function deriveCycleLabel(asOf: string): string {
  const d = new Date(asOf);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month} Monthly`;
}

/**
 * Compute overall treasury status from the available sections.
 *
 * Priority:
 *   - If no sections have data → "no-positions"
 *   - If any section has a red-equivalent status → "red"
 *   - If any section has an amber-equivalent status → "amber"
 *   - Otherwise → "green"
 */
function deriveOverallStatus(pack: {
  liquidity: LiquiditySection | null;
  hqlaComposition: HQLASection | null;
  almIRRBB: ALMSection | null;
  intradayLiquidity: IntradaySection | null;
  openRiskItems: RiskItemSection;
}): "green" | "amber" | "red" | "no-positions" {
  if (
    pack.liquidity === null &&
    pack.hqlaComposition === null &&
    pack.almIRRBB === null &&
    pack.intradayLiquidity === null
  ) {
    return "no-positions";
  }

  // Check for red conditions
  if (
    pack.liquidity?.lcr.status === "below-minimum" ||
    pack.liquidity?.nsfr.status === "below-minimum" ||
    pack.hqlaComposition?.snapshot.l2bCapBreached === true ||
    pack.almIRRBB?.run.overallStatus === "red" ||
    pack.intradayLiquidity?.projection.status === "red"
  ) {
    return "red";
  }

  // Check for amber conditions
  if (
    pack.liquidity?.lcr.status === "at-minimum" ||
    pack.liquidity?.nsfr.status === "at-minimum" ||
    pack.hqlaComposition?.snapshot.l2CapBreached === true ||
    pack.almIRRBB?.run.overallStatus === "amber" ||
    pack.intradayLiquidity?.projection.status === "amber" ||
    pack.openRiskItems.items.some((i) => i.severity === "breach" || i.severity === "critical")
  ) {
    return "amber";
  }

  return "green";
}

// ---------------------------------------------------------------------------
// generateALCOPack
// ---------------------------------------------------------------------------

/**
 * Reads from the event store and assembles a typed ALCOPack.
 *
 * Each section queries the event store for the most recent relevant event.
 * If no event is found, the section is null and the name is added to
 * `sectionsWithNoData`.
 *
 * This function never throws — it handles empty event stores gracefully.
 */
export function generateALCOPack(asOf: string): ALCOPack {
  const cycleLabel = deriveCycleLabel(asOf);
  const sectionsWithNoData: string[] = [];

  // -----------------------------------------------------------------------
  // 1. Liquidity — latest LCRComputed + NSFRComputed
  // -----------------------------------------------------------------------

  let liquidity: LiquiditySection | null = null;
  let latestLCR: LCRComputedPayload | null = null;
  let latestNSFR: NSFRComputedPayload | null = null;

  try {
    for (const evt of eventStore.replay({ type: "LCRComputed", asOf })) {
      latestLCR = evt.payload as LCRComputedPayload;
    }
    for (const evt of eventStore.replay({ type: "NSFRComputed", asOf })) {
      latestNSFR = evt.payload as NSFRComputedPayload;
    }
    if (latestLCR !== null && latestNSFR !== null) {
      liquidity = { lcr: latestLCR, nsfr: latestNSFR };
    } else {
      sectionsWithNoData.push("liquidity");
    }
  } catch {
    sectionsWithNoData.push("liquidity");
  }

  // -----------------------------------------------------------------------
  // 2. HQLA Composition — latest CollateralInventorySnapshotted
  // -----------------------------------------------------------------------

  let hqlaComposition: HQLASection | null = null;
  let latestCollateral: CollateralInventorySnapshotPayload | null = null;

  try {
    for (const evt of eventStore.replay({ type: "CollateralInventorySnapshotted", asOf })) {
      latestCollateral = evt.payload as CollateralInventorySnapshotPayload;
    }
    if (latestCollateral !== null) {
      hqlaComposition = { snapshot: latestCollateral };
    } else {
      sectionsWithNoData.push("hqlaComposition");
    }
  } catch {
    sectionsWithNoData.push("hqlaComposition");
  }

  // -----------------------------------------------------------------------
  // 3. ALM / IRRBB — latest ALMRunCompleted
  // -----------------------------------------------------------------------

  let almIRRBB: ALMSection | null = null;
  let latestALMRun: ALMRunCompletedPayload | null = null;

  try {
    for (const evt of eventStore.replay({ type: "ALMRunCompleted", asOf })) {
      latestALMRun = evt.payload as ALMRunCompletedPayload;
    }
    if (latestALMRun !== null) {
      almIRRBB = { run: latestALMRun };
    } else {
      sectionsWithNoData.push("almIRRBB");
    }
  } catch {
    sectionsWithNoData.push("almIRRBB");
  }

  // -----------------------------------------------------------------------
  // 4. Intraday Liquidity — latest IntradayHQLAStressProjection (stress)
  // -----------------------------------------------------------------------

  let intradayLiquidity: IntradaySection | null = null;
  let latestIntraday: IntradayHQLAStressProjectionPayload | null = null;

  try {
    for (const evt of eventStore.replay({ type: "IntradayHQLAStressProjection", asOf })) {
      const p = evt.payload as IntradayHQLAStressProjectionPayload;
      if (p.scenario === "stress") {
        latestIntraday = p;
      }
    }
    if (latestIntraday !== null) {
      intradayLiquidity = { projection: latestIntraday };
    } else {
      sectionsWithNoData.push("intradayLiquidity");
    }
  } catch {
    sectionsWithNoData.push("intradayLiquidity");
  }

  // -----------------------------------------------------------------------
  // 5. FTP Curve — latest FtpCurvePublished
  // -----------------------------------------------------------------------

  let ftpCurve: FTPSection | null = null;
  let latestCurve: FtpCurvePublishedPayload | null = null;

  try {
    for (const evt of eventStore.replay({ type: "FtpCurvePublished", asOf })) {
      latestCurve = evt.payload as FtpCurvePublishedPayload;
    }
    if (latestCurve !== null) {
      ftpCurve = { curve: latestCurve };
    } else {
      sectionsWithNoData.push("ftpCurve");
    }
  } catch {
    sectionsWithNoData.push("ftpCurve");
  }

  // -----------------------------------------------------------------------
  // 6. ILAAP Summary — latest ILAAPSummaryCompleted
  // -----------------------------------------------------------------------

  let ilaapSummary: ILAAPSection | null = null;
  let latestILAAP: ILAAPSummaryCompletedPayload | null = null;

  try {
    for (const evt of eventStore.replay({ type: "ILAAPSummaryCompleted", asOf })) {
      latestILAAP = evt.payload as ILAAPSummaryCompletedPayload;
    }
    if (latestILAAP !== null) {
      ilaapSummary = { summary: latestILAAP };
    } else {
      sectionsWithNoData.push("ilaapSummary");
    }
  } catch {
    sectionsWithNoData.push("ilaapSummary");
  }

  // -----------------------------------------------------------------------
  // 7. Open Risk Items — AppetiteBreach + HQLACompositionDrift (30 days)
  // -----------------------------------------------------------------------

  const openRiskItems: RiskItem[] = [];
  const windowStart = thirtyDaysBeforeAsOf(asOf);

  try {
    for (const evt of eventStore.replay({ type: "AppetiteBreach", asOf })) {
      if (evt.as_of >= windowStart) {
        const p = evt.payload as AppetiteBreachPayload;
        openRiskItems.push({
          type: "AppetiteBreach",
          id: p.breachId,
          domain: p.riskDomain,
          severity: p.severity,
          detectedAt: p.detectedAt,
          description: `${p.limitName}: actual ${p.actualValue.toFixed(2)}, limit ${p.limitValue.toFixed(2)} (${p.breachPct.toFixed(1)}% breach)`,
        });
      }
    }
  } catch {
    // No AppetiteBreach events — acceptable
  }

  try {
    for (const evt of eventStore.replay({ type: "HQLACompositionDrift", asOf })) {
      if (evt.as_of >= windowStart) {
        const p = evt.payload as HQLACompositionDriftPayload;
        openRiskItems.push({
          type: "HQLACompositionDrift",
          id: p.alertId,
          domain: "HQLA composition",
          severity: p.severity,
          detectedAt: p.detectedAt,
          description: `${p.policyBandBreached ?? "cap breached"} — L1: ${(p.l1HQLAPct ?? 0).toFixed(1)}%, L2a: ${(p.l2aHQLAPct ?? 0).toFixed(1)}%, L2b: ${(p.l2bHQLAPct ?? 0).toFixed(1)}%`,
        });
      }
    }
  } catch {
    // No HQLACompositionDrift events — acceptable
  }

  // -----------------------------------------------------------------------
  // Assemble pack
  // -----------------------------------------------------------------------

  const packDraft = {
    liquidity,
    hqlaComposition,
    almIRRBB,
    intradayLiquidity,
    openRiskItems: { items: openRiskItems },
  };

  const overallTreasuryStatus = deriveOverallStatus(packDraft);

  return {
    asOf,
    cycleLabel,
    liquidity,
    hqlaComposition,
    almIRRBB,
    intradayLiquidity,
    ftpCurve,
    ilaapSummary,
    openRiskItems: { items: openRiskItems },
    proposedResolutions: "To be completed by Eitan at ALCO.",
    sectionsWithNoData,
    overallTreasuryStatus,
  };
}
