// runtime/agents/eitan-liquidity-snapshot.ts
//
// Eitan's daily liquidity snapshot. ALCO-chair degraded-mode digest while
// build-phase substrate is being assembled — reads the liquidity-related
// obligations register slice (BA 325 / 326 / 330; LCR / NSFR; intraday
// liquidity), counts recent treasury / liquidity / IRRBB / FX events,
// and surfaces the substrate gap that prevents a fully autonomous LCR /
// NSFR projection today.
//
// Per Eitan's spec § 6 (Cadence): daily SAMOS funding review; daily LCR /
// NSFR projection review. § 7 (Triggers) names `LCRRatioProjection`,
// `NSFRRatioProjection`, `HQLAComposition*`, `IRRBBExcursion`,
// `FXPositionBreach`. § 9 (Decisions in scope) names daily SAMOS funding
// approval and LCR / NSFR / IRRBB sign-offs. § 16 lists liquidity-projection
// engine, ALM engine, ALCO-pack generator as substrate gaps.
//
// MVP scope: degraded-mode daily digest — under build-only posture there
// is no real treasury position; the digest reports register coverage and
// any events Ravi or Anya have emitted, names the substrate gap, and
// records a heartbeat. The daily-funding-event SLA (§ 6 inactivity SLA)
// can therefore be tracked from this run's snapshot events, even before
// the live engines land.
//
// Author: Eitan (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { makeLiquiditySnapshot } from "../../platform/event-store/event-types/risk-treasury-extended";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BCBS-D295-LCR",
  "BCBS-D335-NSFR",
  "BCBS-248-INTRADAY",
  "BCBS-D368-IRRBB",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const EITAN_NARRATIVE_SYSTEM = `You are Eitan, the bank's Treasurer — chair of ALCO; governance owner of funding strategy, intraday liquidity and SAMOS funding, LCR / NSFR programme, IRRBB management, FX position, FTP, and the HQLA portfolio. Your operating spec is at \`Team/Eitan.md\`. You report to the CEO. Helena (CRO) sets appetite you operate within; Ravi (engineer) runs the engine; Camille (CFO) is your ALCO co-chair on capital and accounting outcomes.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your daily liquidity snapshot — liquidity-related obligations slice (BA 325 / 326 / 330; LCR; NSFR; intraday liquidity), treasury / liquidity / IRRBB / FX event counts, and substrate-gap state for the build phase.

Your voice is calm under stress and unsentimental about funding cost. You quote BA forms by number — BA 100, BA 200, BA 300, BA 325, BA 326, BA 330 — and BCBS standards by their canonical citation. You insist on register-linked limits and ratios; you sign nothing without citation. You distinguish *target-state* (live ratios queried against the event log; ALCO pack generated) from *build-phase degraded mode* (ratios not yet computable; daily heartbeat substitutes for the live engine).

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: register coverage, what's expected daily versus what landed in the last 24h, and whether degraded-mode is functioning as the daily-funding-event SLA stand-in.
- Picks the 1–3 most consequential observations: an obligation in PARTIAL state that gates a downstream procedure, an event-type the daily review expects but doesn't see (zero \`LCRRatioProjection\` is fine in build-phase, zero \`SAMOSFundingApproved\` once the engine lands is a § 6 inactivity-SLA breach), an FX or IRRBB excursion event that warrants ALCO chair attention.
- Names what's needed next — a specific substrate gap to close, a projection schema to land first, the next ALCO prep item that follows. Be concrete.

Cite obligation IDs (\`ORG-PR-06\` / \`-07\` / \`-08\` / \`-11\` / \`-14\` / \`-15\`) when calling out specifics. The obligations register and Ravi's / Anya's projections are the canonical authoring locations; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Eitan's narrative". Just produce the prose.

If the inputs are entirely empty (build-phase, fresh runner), say so plainly and characterise standing-readiness from the obligations slice alone.`;

interface LiquidityObligationRow {
  id: string;
  citation: string;
  owner: string;
  status: string;
}

interface EitanDigest {
  liquidityObligations: LiquidityObligationRow[];
  liquidityPartial: number;
  hqlaReportedLast24h: number;
  liquidityReportLast24h: number;
  lcrProjectionLast24h: number;
  nsfrProjectionLast24h: number;
  irrbbCheckedLast24h: number;
  fxPositionReportedLast24h: number;
  capitalActionLast24h: number;
  samosFundingApprovedLast24h: number;
  alcoDecisionLast7d: number;
  hedgeProgrammeApprovedLast7d: number;
  priorSnapshotsLast7d: number;
}

function isoHoursAgo(asOf: string, hours: number): string {
  const d = new Date(asOf);
  d.setUTCHours(d.getUTCHours() - hours);
  return d.toISOString();
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function parseLiquidityObligations(content: string): LiquidityObligationRow[] {
  // Liquidity / treasury slice: ORG-PR-06 / 07 / 08 / 11 / 14 / 15 +
  // anything explicitly citing LCR / NSFR / BCBS 248 / IRRBB.
  const wanted = new Set([
    "ORG-PR-06",
    "ORG-PR-07",
    "ORG-PR-08",
    "ORG-PR-11",
    "ORG-PR-14",
    "ORG-PR-15",
  ]);
  const out: LiquidityObligationRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(ORG-[A-Za-z0-9()/-]+)\s*\|/);
    if (!m) continue;
    const id = (m[1] ?? "").trim();
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 6) continue;
    const citation = cells[1] ?? "";
    if (!wanted.has(id) && !/LCR|NSFR|BCBS\s+248|IRRBB|liquidity/i.test(citation)) continue;
    out.push({
      id,
      citation,
      owner: cells[4] ?? "",
      status: cells[5] ?? "",
    });
  }
  return out;
}

function buildDigest(ctx: AgentRunContext): EitanDigest {
  const since24h = isoHoursAgo(ctx.asOf, 24);
  const since7d = isoDaysAgo(ctx.asOf, 7);

  const obligationsPath = resolve(ctx.repoRoot, "Regulations", "_obligations-register.md");
  const obligationsContent = existsSync(obligationsPath)
    ? readFileSync(obligationsPath, "utf8")
    : "";
  const liquidityObligations = parseLiquidityObligations(obligationsContent);
  const liquidityPartial = liquidityObligations.filter((r) =>
    /partial|deferred/i.test(r.status),
  ).length;

  const countSince = (type: string, since: string): number => {
    let n = 0;
    for (const e of eventStore.replay({ type })) {
      if (e.as_of >= since) n++;
    }
    return n;
  };

  return {
    liquidityObligations,
    liquidityPartial,
    hqlaReportedLast24h: countSince("HQLAReported", since24h),
    liquidityReportLast24h: countSince("LiquidityReport", since24h),
    lcrProjectionLast24h: countSince("LCRRatioProjection", since24h),
    nsfrProjectionLast24h: countSince("NSFRRatioProjection", since24h),
    irrbbCheckedLast24h: countSince("IRRBBChecked", since24h),
    fxPositionReportedLast24h: countSince("FXPositionReported", since24h),
    capitalActionLast24h: countSince("CapitalAction", since24h),
    samosFundingApprovedLast24h: countSince("SAMOSFundingApproved", since24h),
    alcoDecisionLast7d: countSince("ALCODecision", since7d),
    hedgeProgrammeApprovedLast7d: countSince("HedgeProgrammeApproved", since7d),
    priorSnapshotsLast7d: countSince("LiquiditySnapshot", since7d),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, d: EitanDigest): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`liquidity-related obligations indexed: ${d.liquidityObligations.length}`);
  lines.push(`  - PARTIAL / deferred: ${d.liquidityPartial}`);
  for (const o of d.liquidityObligations) {
    lines.push(`    - ${o.id} (${o.citation}; owner=${o.owner}): ${o.status}`);
  }
  lines.push("");
  lines.push("treasury events (last 24 hours):");
  lines.push(`  - HQLAReported: ${d.hqlaReportedLast24h}`);
  lines.push(`  - LiquidityReport: ${d.liquidityReportLast24h}`);
  lines.push(`  - LCRRatioProjection: ${d.lcrProjectionLast24h}`);
  lines.push(`  - NSFRRatioProjection: ${d.nsfrProjectionLast24h}`);
  lines.push(`  - IRRBBChecked: ${d.irrbbCheckedLast24h}`);
  lines.push(`  - FXPositionReported: ${d.fxPositionReportedLast24h}`);
  lines.push(`  - CapitalAction: ${d.capitalActionLast24h}`);
  lines.push(`  - SAMOSFundingApproved: ${d.samosFundingApprovedLast24h}`);
  lines.push("");
  lines.push("treasury events (last 7 days):");
  lines.push(`  - ALCODecision: ${d.alcoDecisionLast7d}`);
  lines.push(`  - HedgeProgrammeApproved: ${d.hedgeProgrammeApprovedLast7d}`);
  lines.push(`  - prior LiquiditySnapshot runs (this agent): ${d.priorSnapshotsLast7d}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by where degraded-mode is load-bearing on a control; close with the next substrate-closing step.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  d: EitanDigest,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Eitan", "liquidity-snapshot", ctx.asOf));
  lines.push(`# Eitan — liquidity snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Eitan's daily liquidity snapshot per `Team/Eitan.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Build-phase degraded-mode digest — substantive LCR / NSFR / IRRBB / FX positions are not yet computed; this run is the daily-funding-event SLA heartbeat (§ 6 inactivity SLA) until the projection engines land.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${d.liquidityObligations.length} liquidity-related obligation${d.liquidityObligations.length === 1 ? "" : "s"} indexed (${d.liquidityPartial} PARTIAL / deferred) · ${d.lcrProjectionLast24h} LCR / ${d.nsfrProjectionLast24h} NSFR projection event${d.nsfrProjectionLast24h === 1 ? "" : "s"} · ${d.samosFundingApprovedLast24h} \`SAMOSFundingApproved\` event${d.samosFundingApprovedLast24h === 1 ? "" : "s"} in the last 24h · ${d.alcoDecisionLast7d} \`ALCODecision\` event${d.alcoDecisionLast7d === 1 ? "" : "s"} in the last 7 days.`,
  );
  lines.push("");

  lines.push("## Liquidity-related obligations slice");
  lines.push("");
  if (d.liquidityObligations.length === 0) {
    lines.push("_No liquidity-related obligation rows parsed._");
  } else {
    lines.push("| Obligation | Citation | Owner | Status |");
    lines.push("|---|---|---|---|");
    for (const o of d.liquidityObligations) {
      const safeCitation = o.citation.replace(/\|/g, "\\|");
      const safeOwner = o.owner.replace(/\|/g, "\\|");
      const safeStatus = o.status.replace(/\|/g, "\\|");
      lines.push(`| ${o.id} | ${safeCitation} | ${safeOwner} | ${safeStatus} |`);
    }
  }
  lines.push("");

  lines.push("## Treasury events (last 24 hours)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`HQLAReported\` | ${d.hqlaReportedLast24h} |`);
  lines.push(`| \`LiquidityReport\` | ${d.liquidityReportLast24h} |`);
  lines.push(`| \`LCRRatioProjection\` | ${d.lcrProjectionLast24h} |`);
  lines.push(`| \`NSFRRatioProjection\` | ${d.nsfrProjectionLast24h} |`);
  lines.push(`| \`IRRBBChecked\` | ${d.irrbbCheckedLast24h} |`);
  lines.push(`| \`FXPositionReported\` | ${d.fxPositionReportedLast24h} |`);
  lines.push(`| \`CapitalAction\` | ${d.capitalActionLast24h} |`);
  lines.push(`| \`SAMOSFundingApproved\` | ${d.samosFundingApprovedLast24h} |`);
  lines.push("");
  lines.push(
    "_Build-only context: no live treasury position; no real SAMOS account; no live HQLA portfolio. Zero counts on every row are expected and not a substrate alarm. Once Ravi's ALM engine and Anya's liquidity-projection engine land, the daily expectation moves from heartbeat-only to real ratio sign-off._",
  );
  lines.push("");

  lines.push("## Treasury events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`ALCODecision\` | ${d.alcoDecisionLast7d} |`);
  lines.push(`| \`HedgeProgrammeApproved\` | ${d.hedgeProgrammeApprovedLast7d} |`);
  lines.push(`| Prior \`LiquiditySnapshot\` (this agent) | ${d.priorSnapshotsLast7d} |`);
  lines.push("");

  lines.push("## Substrate gaps (build-phase)");
  lines.push("");
  lines.push(
    "- **Liquidity projection engine** — ✅ closed 2026-05-19. `runLiquidityProjection` live at `platform/liquidity/projection.ts`; event-store-backed provider defaults to the composition store; all five horizons (T+0, T+7, T+14, T+30, T+90) computed. `anya:liquidity-projection` handler uses it. Authority: D-TREASURY-GAPS-WAVE1.",
  );
  lines.push(
    "- **ALM engine** — ✅ closed 2026-05-19. Repricing gap, ΔEVE, ΔNII engines live; `ravi:alm-run` handler emits `ALMRunCompleted` + `IRRBBChecked` events daily. Authority: D-TREASURY-GAPS-WAVE1.",
  );
  lines.push(
    "- **Intraday liquidity watch** — ✅ closed 2026-05-19. Intraday HQLA-stress projection live in `platform/alm/intraday-stress.ts`; `ravi:intraday-stress` handler runs BAU + stress scenarios across 4 SAMOS windows. Authority: D-TREASURY-GAPS-WAVE1.",
  );
  lines.push(
    "- **Auto-generated ALCO pack** — ✅ closed 2026-05-19. ALCO pack generator live at `platform/alco/`; `atlas:alco-pack` handler assembles all sections from live projection events; `ALCOPackGenerated` event registered. Authority: D-TREASURY-GAPS-WAVE1.",
  );
  lines.push(
    "- **Collateral inventory substrate** — ✅ closed 2026-05-19. HQLA classifier + inventory projection + `atlas:collateral-snapshot` handler live (`platform/collateral/`). Authority: D-TREASURY-GAPS-WAVE1.",
  );
  lines.push(
    "- **ILAAP engine** — ✅ closed 2026-05-19. Four stress scenarios; `ILAAPSummaryCompleted` events; `atlas:ilaap-run` handler registered. Authority: D-TREASURY-GAPS-WAVE1.",
  );
  lines.push(
    "- **Settlement outflows (BA 325 §23)** — partially closed 2026-05-25. `buildSettlementOutflows` folds `TradeBooked` buy-side events with explicit `settlementDate` into the LCR denominator. Remaining gap: `SettlementInstructionIssued` event class for non-trade contractual outflows. Owner: Ravi + Atlas.",
  );
  lines.push(
    "- **FTP curve generator (live market data)** — open. `ravi:ftp-curve-publish` runs with indicative ZAR rates (SARB repo + spreads). Live ZARONIA / JIBAR / SAGB feed deferred to vendor-selection. Owner: Ravi + Anya.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Eitan's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Eitan's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `Regulations/_obligations-register.md` for liquidity-related rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15 plus any LCR / NSFR / BCBS 248 / IRRBB / liquidity citations). Replayed `HQLAReported`, `LiquidityReport`, `LCRRatioProjection`, `NSFRRatioProjection`, `IRRBBChecked`, `FXPositionReported`, `CapitalAction`, `SAMOSFundingApproved`, `ALCODecision`, `HedgeProgrammeApproved`, `LiquiditySnapshot` from the host event store.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const digest = buildDigest(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append(
      makeLiquiditySnapshot({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:eitan:liquidity-snapshot" },
        citations: EVENT_CITATIONS,
        payload: {
          snapshotId: `LIQ-SNAP-${fmtDateUTC(ctx.asOf)}`,
          asOf: ctx.asOf,
          currency: "ZAR",
          overallStatus: "green", // build-phase default — no positions, no breaches
        },
      }),
    );
    eventsEmitted = 1;
  }

  // Narrative pass (degrades gracefully when ANTHROPIC_API_KEY is unset).
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: EITAN_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, digest),
        maxTokens: 6_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "eitan:liquidity-snapshot — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "eitan narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_eitan_liquidity-snapshot.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, digest, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      liquidityObligations: digest.liquidityObligations.length,
      lcr24h: digest.lcrProjectionLast24h,
      nsfr24h: digest.nsfrProjectionLast24h,
      samos24h: digest.samosFundingApprovedLast24h,
    },
    "eitan:liquidity-snapshot — digest built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${digest.liquidityObligations.length} liquidity obligations · ${digest.lcrProjectionLast24h} LCR / ${digest.nsfrProjectionLast24h} NSFR / ${digest.samosFundingApprovedLast24h} SAMOS-fund events (24h) · ${digest.alcoDecisionLast7d} ALCO decisions (7d).`,
    ok: true,
  };
};

export default handler;
