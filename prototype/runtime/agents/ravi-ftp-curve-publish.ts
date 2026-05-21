// runtime/agents/ravi-ftp-curve-publish.ts
//
// Ravi's daily FTP curve publication handler.
//
// Publishes a new FTP curve each morning by:
//   1. Constructing the ZAR tenor/rate grid from the prevailing rate
//      environment (ZARONIA O/N + JIBAR 3M + SAGB yields at key tenors).
//      In build phase, rates are indicative / synthetic — no live market
//      data feed is wired yet (deferred to vendor-selection per
//      ravi-alm-readiness substrate gaps).
//   2. Emitting a FtpCurvePublished event with the curve.
//   3. Writing a brief deliverable to Owner Inbox.
//
// The curve uses "matched-maturity" methodology — each loan/bond/deposit
// is attributed a rate from the curve at the closest comparable tenor.
//
// Build-phase posture:
//   - No live ZARONIA / JIBAR / SAGB data feeds. Rates are indicative
//     proxies calibrated to the prevailing SARB repo rate (8.25% as of
//     2026-05-15) + typical spreads for each tenor bucket.
//   - Once Ravi's market-data connector lands (vendor-selection phase),
//     this handler will replace the indicative grid with live quotes.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeFtpCurvePublished } from "../../platform/event-store/event-types/ftp";
import type { FtpTenorRate } from "../../platform/event-store/event-types/ftp";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["BANKS-ACT-94-1990", "BANKS-REG-26", "BANKS-REG-27", "BCBS-D365-IRRBB"];

/**
 * Build the indicative ZAR FTP tenor grid for the given date.
 *
 * Calibrated to SARB repo rate 8.25% (2026-05-15) + typical spreads.
 * Short tenors track ZARONIA O/N; medium tenors track JIBAR;
 * long tenors track SAGB yields.
 *
 * Replace with live market-data feed once vendor contract lands.
 */
function buildIndicativeZarTenors(asOf: string): FtpTenorRate[] {
  // Base: SARB repo rate 8.25% as of 2026-05-15.
  // Short end: ZARONIA O/N historically trades 10–15bps below repo.
  // 3M JIBAR: historically 25–40bps above repo for institutional.
  // Long end: SAGB yields interpolated from the on-the-run curve.
  void asOf; // reserved for live-data enrichment once feeds land
  return [
    { tenor: "1D", rate: 0.081, basis: "ZARONIA" },
    { tenor: "1W", rate: 0.0815, basis: "ZARONIA" },
    { tenor: "1M", rate: 0.082, basis: "JIBAR" },
    { tenor: "3M", rate: 0.0858, basis: "JIBAR" },
    { tenor: "6M", rate: 0.089, basis: "JIBAR" },
    { tenor: "1Y", rate: 0.092, basis: "JIBAR" },
    { tenor: "2Y", rate: 0.095, basis: "SAGB-YIELD" },
    { tenor: "5Y", rate: 0.099, basis: "SAGB-YIELD" },
    { tenor: "10Y", rate: 0.103, basis: "SAGB-YIELD" },
  ];
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);
  const curveId = `FTP-ZAR-${date}`;
  const tenors = buildIndicativeZarTenors(ctx.asOf);

  let eventsEmitted = 0;

  if (!ctx.dryRun) {
    const event = makeFtpCurvePublished({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:ravi:ftp-curve-publish" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        curveId,
        currency: "ZAR",
        effectiveDate: date,
        tenors,
        methodology: "matched-maturity",
        publishedBy: "ravi",
        publishedAt: ctx.asOf,
      },
    });
    eventStore.append(event);
    eventsEmitted = 1;
  }

  // Write a brief deliverable
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${date}_ravi_ftp-curve-publish.md`;
    const lines: string[] = [];
    lines.push(frontmatter("Ravi", "ftp-curve-publish", ctx.asOf));
    lines.push(`# Ravi — FTP curve published, ${date}`);
    lines.push("");
    lines.push(
      `Daily FTP curve publication — matched-maturity methodology, ZAR, effective ${date}.`,
    );
    lines.push("Rates are indicative (build phase — live ZARONIA/JIBAR/SAGB feeds pending).");
    lines.push("");
    lines.push(`**Curve ID:** \`${curveId}\``);
    lines.push("");
    lines.push("| Tenor | Rate (annualised) | Basis |");
    lines.push("|---|---|---|");
    for (const t of tenors) {
      lines.push(`| ${t.tenor} | ${(t.rate * 100).toFixed(2)}% | ${t.basis} |`);
    }
    lines.push("");
    lines.push("## Substrate gaps");
    lines.push("");
    lines.push(
      "- Live ZARONIA / JIBAR / SAGB data feeds not yet connected. Rates are indicative until vendor-selection phase.",
    );
    lines.push(
      "- Once live feeds land, this handler replaces the indicative grid with quoted market rates.",
    );
    lines.push("");
    writeFileSync(resolve(ctx.ownerInboxDir, filename), lines.join("\n"), "utf8");
  }

  logger.info(
    { curveId, tenorCount: tenors.length, dryRun: ctx.dryRun },
    "ravi:ftp-curve-publish — curve published",
  );

  return {
    eventsEmitted,
    summary: `FTP curve published: ${curveId} — ${tenors.length} tenors (ZAR, matched-maturity). Build-phase indicative rates; live feeds pending.`,
    ok: true,
  };
};

export default handler;
