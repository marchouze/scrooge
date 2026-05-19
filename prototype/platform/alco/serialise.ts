// platform/alco/serialise.ts
//
// ALCO pack serialiser — converts an ALCOPack to a structured markdown string.
//
// The output is a text-only, human-readable markdown document suitable for
// filing as a record via RecordFiled. No emoji characters; status values
// are expressed in UPPER-CASE (GREEN / AMBER / RED / NO-POSITIONS).
//
// Section structure:
//   ## 1. Liquidity Position
//   ## 2. HQLA Composition
//   ## 3. ALM / IRRBB
//   ## 4. Intraday Liquidity
//   ## 5. FTP Curve
//   ## 6. ILAAP Summary
//   ## 7. Open Risk Items
//   ## 8. Proposed Resolutions / Decisions
//
// Authority: D-TREASURY-GAPS-WAVE1.
// Author: Atlas (Core banking platform architect, engineering)

import type { ALCOPack } from "./pack";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusText(status: ALCOPack["overallTreasuryStatus"]): string {
  return status.toUpperCase().replace("-", "-");
}

function liqStatus(status: string): string {
  switch (status) {
    case "above-minimum":
      return "ABOVE-MINIMUM";
    case "at-minimum":
      return "AT-MINIMUM";
    case "below-minimum":
      return "BELOW-MINIMUM";
    case "no-positions":
      return "NO-POSITIONS";
    default:
      return status.toUpperCase();
  }
}

function zarMillions(value: number): string {
  if (value === 0) return "0";
  return (value / 1_000_000).toFixed(2);
}

function pct(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(2)}`;
}

function rateLookup(
  curve: { tenors: Array<{ tenor: string; rate: number }> },
  tenor: string,
): string {
  const found = curve.tenors.find((t) => t.tenor === tenor);
  if (found === undefined) return "N/A";
  return `${(found.rate * 100).toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// serialiseALCOPack
// ---------------------------------------------------------------------------

/**
 * Converts an ALCOPack to a structured markdown string.
 *
 * - No emoji characters in output.
 * - Status values expressed in UPPER-CASE text.
 * - Null sections produce a "No data" subsection note.
 */
export function serialiseALCOPack(pack: ALCOPack): string {
  const lines: string[] = [];

  lines.push(`# ALCO Pack — ${pack.cycleLabel} (as of ${pack.asOf})`);
  lines.push("");
  lines.push(`Overall treasury status: ${statusText(pack.overallTreasuryStatus)}`);
  lines.push("");

  // -----------------------------------------------------------------------
  // 1. Liquidity Position
  // -----------------------------------------------------------------------
  lines.push("## 1. Liquidity Position");
  lines.push("");
  if (pack.liquidity !== null) {
    const { lcr, nsfr } = pack.liquidity;
    lines.push(
      `LCR: ${pct(lcr.lcrRatioPct)}% (${liqStatus(lcr.status)}) | NSFR: ${pct(nsfr.nsfrRatioPct)}% (${liqStatus(nsfr.status)})`,
    );
    lines.push(
      `HQLA: ZAR ${zarMillions(lcr.hqlaZar)}m | Net cash outflows: ZAR ${zarMillions(lcr.netCashOutflowsZar)}m`,
    );
    lines.push(`ASF: ZAR ${zarMillions(nsfr.asfZar)}m | RSF: ZAR ${zarMillions(nsfr.rsfZar)}m`);
  } else {
    lines.push("No data — build phase (no LCRComputed or NSFRComputed events in store).");
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // 2. HQLA Composition
  // -----------------------------------------------------------------------
  lines.push("## 2. HQLA Composition");
  lines.push("");
  if (pack.hqlaComposition !== null) {
    const s = pack.hqlaComposition.snapshot;
    const total = s.totalHQLAZar;
    const l1Pct = total > 0 ? ((s.l1Zar / total) * 100).toFixed(1) : "0.0";
    const l2aPct = total > 0 ? ((s.l2aZar / total) * 100).toFixed(1) : "0.0";
    const l2bPct = total > 0 ? ((s.l2bZar / total) * 100).toFixed(1) : "0.0";
    lines.push(
      `Total HQLA: ZAR ${zarMillions(total)}m | L1: ${l1Pct}% | L2a: ${l2aPct}% | L2b: ${l2bPct}%`,
    );
    lines.push(
      `L2 cap: ${s.l2CapBreached ? "BREACHED" : "COMPLIANT"} | L2b cap: ${s.l2bCapBreached ? "BREACHED" : "COMPLIANT"}`,
    );
    lines.push(`Securities: ${s.securityCount}`);
  } else {
    lines.push("No data — build phase (no CollateralInventorySnapshot events in store).");
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // 3. ALM / IRRBB
  // -----------------------------------------------------------------------
  lines.push("## 3. ALM / IRRBB");
  lines.push("");
  if (pack.almIRRBB !== null) {
    const run = pack.almIRRBB.run;
    lines.push(
      `Worst-case DEVE: ZAR ${zarMillions(run.eveWorstDeltaZar)}m | Worst-case DNII: ZAR ${zarMillions(run.niiWorstDeltaZar)}m`,
    );
    lines.push(`Repricing gap status: ${run.repricingGapStatus.toUpperCase()}`);
    lines.push(`Overall ALM status: ${run.overallStatus.toUpperCase()}`);
  } else {
    lines.push("No data — build phase (no ALMRunCompleted events in store).");
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // 4. Intraday Liquidity
  // -----------------------------------------------------------------------
  lines.push("## 4. Intraday Liquidity");
  lines.push("");
  if (pack.intradayLiquidity !== null) {
    const proj = pack.intradayLiquidity.projection;
    lines.push(
      `Stress scenario window: ${proj.windowLabel} | HQLA projected: ZAR ${zarMillions(proj.projectedHQLAZar)}m | Floor: ZAR ${zarMillions(proj.floorZar)}m | Status: ${proj.status.toUpperCase()}`,
    );
    lines.push(`Scenario: ${proj.scenario}`);
  } else {
    lines.push("No data — build phase (no IntradayHQLAStressProjection events in store).");
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // 5. FTP Curve
  // -----------------------------------------------------------------------
  lines.push("## 5. FTP Curve");
  lines.push("");
  if (pack.ftpCurve !== null) {
    const curve = pack.ftpCurve.curve;
    lines.push(
      `Curve ID: ${curve.curveId} | Effective: ${curve.effectiveDate} | Methodology: ${curve.methodology}`,
    );
    lines.push(
      `ON: ${rateLookup(curve, "1D")}% | 3M: ${rateLookup(curve, "3M")}% | 1Y: ${rateLookup(curve, "1Y")}% | 5Y: ${rateLookup(curve, "5Y")}% | 10Y: ${rateLookup(curve, "10Y")}%`,
    );
  } else {
    lines.push("No data — build phase (no FtpCurvePublished events in store).");
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // 6. ILAAP Summary
  // -----------------------------------------------------------------------
  lines.push("## 6. ILAAP Summary");
  lines.push("");
  if (pack.ilaapSummary !== null) {
    const s = pack.ilaapSummary.summary;
    lines.push(
      `Worst-case survival: ${s.worstCaseSurvivalDays} days (${s.worstCaseScenario}) | Overall: ${s.overallStatus.toUpperCase()}`,
    );
    lines.push(`Recommended action: ${s.recommendedAction}`);
  } else {
    lines.push("No data — build phase (no ILAAPSummaryCompleted events in store).");
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // 7. Open Risk Items
  // -----------------------------------------------------------------------
  lines.push("## 7. Open Risk Items");
  lines.push("");
  const items = pack.openRiskItems.items;
  if (items.length === 0) {
    lines.push("0 open items: None");
  } else {
    lines.push(`${items.length} open item${items.length === 1 ? "" : "s"}:`);
    lines.push("");
    for (const item of items) {
      lines.push(
        `- [${item.severity.toUpperCase()}] ${item.type} — ${item.domain}: ${item.description} (detected ${item.detectedAt})`,
      );
    }
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // 8. Proposed Resolutions / Decisions
  // -----------------------------------------------------------------------
  lines.push("## 8. Proposed Resolutions / Decisions");
  lines.push("");
  lines.push(pack.proposedResolutions);
  lines.push("");

  // -----------------------------------------------------------------------
  // Footer
  // -----------------------------------------------------------------------
  lines.push("---");
  if (pack.sectionsWithNoData.length > 0) {
    lines.push(`Sections with no data (build phase): ${pack.sectionsWithNoData.join(", ")}`);
  } else {
    lines.push("All sections have data.");
  }
  lines.push(`Generated: ${pack.asOf}`);

  return lines.join("\n");
}
