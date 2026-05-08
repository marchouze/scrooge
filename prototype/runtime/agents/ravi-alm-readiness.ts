// runtime/agents/ravi-alm-readiness.ts
//
// Ravi's daily ALM readiness handler. Seventeenth handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING. Engineer-side
// counterpart to Eitan's `LiquiditySnapshot`: Eitan reports counts of
// liquidity / treasury events the ALCO chair would consume; Ravi reports
// the substrate-readiness state for each ALM pipeline (LCR, NSFR, IRRBB,
// FX position, FTP, collateral, SAMOS funding) the engineer would build
// to make those events real. Helena ↔ Rohan is the model; Eitan ↔ Ravi
// follows the same shape.
//
// What this handler does:
//   1. Reads the latest LiquiditySnapshot from Eitan's run. That snapshot
//      lists the 24h liquidity / treasury event counts the ALCO chair
//      cares about. Ravi's job is the engineer-side counterpart: for
//      each ALM pipeline that *would* emit those events, what's the
//      build-state of the projection / engine / connector behind it.
//   2. Walks Ravi-owned obligations from `_obligations-register.md`:
//      LCR (BA 325 / Banks Act Reg 26), NSFR (BA 326 / Banks Act Reg 27),
//      IRRBB (BCBS d365), intraday liquidity (BCBS 248), Excon FX
//      position (Currency & Exchanges Manual). Includes ORG-PR-06 / -07
//      / -08 / -11 / -14 / -15 and ORG-MK-08.
//   3. For each ALM pipeline, reports engineer-side readiness state:
//      ready / drafting / specified / not-yet-specified.
//   4. Counts ALM-domain events in last 7 days: `HQLAObserved`,
//      `LCRComputed`, `NSFRComputed`, `IRRBBChecked`, `FXPositionReported`,
//      `CollateralUpdated`, `FundingDrawnDown`. All zero in build phase.
//   5. Emits one `ALMReadinessSnapshot` event.
//   6. Writes the daily ALM-readiness deliverable.
//
// Build-phase posture:
//   - No real liquidity, no real funding, no real HQLA portfolio
//     (CLAUDE.md "build phase vs licence-day").
//   - Indirect-participant model (memory:
//     `project_indirect_participant_posture.md`): the bank does not
//     directly join SAMOS or CLS — it accesses SAMOS via a sponsor /
//     correspondent bank. Reflected in the SAMOS row of the readiness
//     map: the "connector" Ravi specifies is a correspondent-bank API
//     contract, not a direct SAMOS membership.
//   - Once Anya's liquidity-projection engine, Atlas's ALM engine,
//     Tomas's correspondent-bank connector, and Bea's hedge-accounting
//     boundary land, this handler retires the "specified / not-yet-
//     specified" branches and starts emitting computed-pipeline state.
//
// Author: Ravi (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BANKS-REG-26",
  "BANKS-REG-27",
  "BCBS-D365-IRRBB",
  "CURRENCY-EXCHANGES-MANUAL",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const RAVI_NARRATIVE_SYSTEM = `You are Ravi, the bank's treasury / ALM engineer — owner of the funding, liquidity (LCR / NSFR), IRRBB, FX position, FTP, collateral, and SAMOS funding engines that Eitan (Treasurer) consumes at ALCO. Your operating spec is at \`Team/Ravi.md\`. You report through Eitan at the governance level.

You are operating as a standing autonomous agent under CLAUDE.md Principle 7. You have just produced your daily ALM-readiness attestation — for each ALM pipeline that Eitan's daily LiquiditySnapshot expects events from, the engineer-side substrate-readiness state, plus a walk of recent ALM-domain events and the Ravi-owned obligations slice.

You are an engineer. You build the engines that turn the event log into LCR / NSFR / IRRBB / FX position / collateral / SAMOS funding-plan numbers. You do not govern (Eitan signs ALCO papers; Helena owns RAS appetite); you do not measure RWA / VaR (Rohan); you do not post hedge accounting (Bea). Your voice is precise, projection-aware, indirect-participant-aware. You distinguish *projectable in principle* from *projectable today*; *engine drafted* from *engine wired to the postable-event stream*; *direct SAMOS access* from *correspondent-bank-mediated SAMOS access*.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the ALM-projection substrate is, which pipeline is the load-bearing block on Eitan's first end-to-end live LCR / NSFR sign-off, and whether degraded-mode is functioning as the daily-funding-event SLA stand-in.
- Picks the 1–3 most consequential observations: a pipeline where the projection substrate is one engineering ticket away from green, an obligation in PARTIAL state that gates a downstream procedure, an ALM-domain event-type the daily expectation watches that a deferred connector blocks (correspondent-bank API for SAMOS; market-rate feeds for FTP curves).
- Names the next engineering move. Be concrete: a specific projection to wire (e.g., HQLA-classification rules per Banks Act Reg 26 against synthetic balance), a specific feed to ingest (e.g., ZARONIA / JIBAR curve sources for FTP), a specific connector contract to draft (correspondent-bank SAMOS-mediation API).

Cite Banks Act 94 of 1990, Banks Act Regulations 26 and 27, BCBS d365 (IRRBB), BCBS 248 (intraday), and the Currency & Exchanges Manual where they bind. Cite obligation IDs (\`ORG-PR-06\` / \`-07\` / \`-08\` / \`-11\` / \`-14\` / \`-15\`; \`ORG-MK-08\`) when calling out specifics. Eitan's snapshot and the obligations register are canonical authoring locations; your narrative is engineer interpretation, not new appetite or obligation substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Ravi's narrative". Just produce the prose.

If the input shows zero events (build phase), say so plainly. The dominant signal in build phase is the queue of substrate tickets — projection engines, market-rate feeds, correspondent-bank connector — between today and Eitan's first measured LCR / NSFR sign-off.`;

interface EitanLiquidityShadow {
  readonly hqlaReportedLast24h: number;
  readonly liquidityReportLast24h: number;
  readonly lcrProjectionLast24h: number;
  readonly nsfrProjectionLast24h: number;
  readonly irrbbCheckedLast24h: number;
  readonly fxPositionReportedLast24h: number;
  readonly samosFundingApprovedLast24h: number;
}

interface PipelineReadiness {
  readonly id: string;
  readonly label: string;
  readonly engineerSideState: "ready" | "drafting" | "specified" | "not-yet-specified";
  readonly substrateRequired: string;
  readonly nextEngineeringStep: string;
}

interface RaviObligationRow {
  id: string;
  citation: string;
  owner: string;
  status: string;
}

interface AlmEventCounts {
  readonly hqlaObservedLast7d: number;
  readonly lcrComputedLast7d: number;
  readonly nsfrComputedLast7d: number;
  readonly irrbbCheckedLast7d: number;
  readonly fxPositionReportedLast7d: number;
  readonly collateralUpdatedLast7d: number;
  readonly fundingDrawnDownLast7d: number;
}

interface RaviSnapshot {
  readonly latestEitanRun: string | null;
  readonly eitanShadow: EitanLiquidityShadow | null;
  readonly raviObligations: readonly RaviObligationRow[];
  readonly raviObligationsPartial: number;
  readonly readiness: readonly PipelineReadiness[];
  readonly almEvents: AlmEventCounts;
  readonly priorRaviSnapshotsLast7d: number;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readLatestEitanSnapshot(): {
  asOf: string | null;
  shadow: EitanLiquidityShadow | null;
} {
  let latest: { asOf: string; payload: Record<string, unknown> } | null = null;
  for (const e of eventStore.replay({ type: "LiquiditySnapshot" })) {
    if (latest === null || e.as_of > latest.asOf) {
      latest = { asOf: e.as_of, payload: e.payload as Record<string, unknown> };
    }
  }
  if (!latest) return { asOf: null, shadow: null };
  const p = latest.payload;
  const num = (k: string): number => (typeof p[k] === "number" ? (p[k] as number) : 0);
  return {
    asOf: latest.asOf,
    shadow: {
      hqlaReportedLast24h: num("hqlaReportedLast24h"),
      liquidityReportLast24h: num("liquidityReportLast24h"),
      lcrProjectionLast24h: num("lcrProjectionLast24h"),
      nsfrProjectionLast24h: num("nsfrProjectionLast24h"),
      irrbbCheckedLast24h: num("irrbbCheckedLast24h"),
      fxPositionReportedLast24h: num("fxPositionReportedLast24h"),
      samosFundingApprovedLast24h: num("samosFundingApprovedLast24h"),
    },
  };
}

function parseRaviObligations(content: string): RaviObligationRow[] {
  // Ravi-owned (or Ravi-co-owned) slice: liquidity / IRRBB / Excon FX.
  // ORG-PR-06 (LCR), ORG-PR-07 (NSFR), ORG-PR-08 (intraday), ORG-PR-11
  // (IRRBB), ORG-PR-14 (ILAAP), ORG-PR-15 (CFP), ORG-MK-08 (Excon FX).
  const wanted = new Set([
    "ORG-PR-06",
    "ORG-PR-07",
    "ORG-PR-08",
    "ORG-PR-11",
    "ORG-PR-14",
    "ORG-PR-15",
    "ORG-MK-08",
  ]);
  const out: RaviObligationRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(ORG-[A-Za-z0-9()/-]+)\s*\|/);
    if (!m) continue;
    const id = (m[1] ?? "").trim();
    if (!wanted.has(id)) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 6) continue;
    out.push({
      id,
      citation: cells[1] ?? "",
      owner: cells[4] ?? "",
      status: cells[5] ?? "",
    });
  }
  return out;
}

// Engineer-side ALM pipeline readiness map. Each pipeline maps to the
// substrate Ravi (or his engineering peers) would build to close the
// gap between today's degraded-mode heartbeat and Eitan's first live
// ratio sign-off. State labels match Rohan's convention:
//   - ready: substrate exists; pipeline runs today
//   - drafting: substrate work in flight (script / module exists)
//   - specified: substrate spec exists (in /Team/Ravi.md or RAS)
//   - not-yet-specified: pipeline known but no substrate spec yet
function buildPipelineReadiness(): readonly PipelineReadiness[] {
  return [
    {
      id: "alm:hqla-inventory",
      label: "HQLA inventory + classification (LCR numerator)",
      engineerSideState: "specified",
      substrateRequired:
        "HQLA inventory projection + Banks Act Reg 26 Level-1 / Level-2A / Level-2B classification + haircut application. Owner: Ravi + Atlas.",
      nextEngineeringStep:
        "Specify HQLA-eligibility table per Banks Act Reg 26; build inventory projection against the synthetic capital line; emit `HQLAObserved`.",
    },
    {
      id: "alm:lcr-net-outflow",
      label: "30-day net cash outflow + LCR ratio",
      engineerSideState: "specified",
      substrateRequired:
        "30-day stressed cash-outflow model (run-off rates per Banks Act Reg 26 / BCBS D295) + LCR ratio engine consuming HQLA inventory. Owner: Ravi + Anya (projection runtime).",
      nextEngineeringStep:
        "Wait for HQLA inventory projection (above); first `LCRComputed` event fires once inventory + outflow model both wired.",
    },
    {
      id: "alm:nsfr-asf",
      label: "Available stable funding (NSFR numerator)",
      engineerSideState: "specified",
      substrateRequired:
        "ASF factor table per Banks Act Reg 27 / BCBS D335, applied to liabilities by tenor / counterparty type. Owner: Ravi + Anya.",
      nextEngineeringStep:
        "Specify ASF factor table; first ASF projection fires once synthetic liability book exists in the event log.",
    },
    {
      id: "alm:nsfr-rsf",
      label: "Required stable funding (NSFR denominator)",
      engineerSideState: "specified",
      substrateRequired:
        "RSF factor table per Banks Act Reg 27 / BCBS D335, applied to assets by tenor / encumbrance / quality. Owner: Ravi + Anya.",
      nextEngineeringStep:
        "Specify RSF factor table alongside ASF; same projection runtime; first `NSFRComputed` event fires once both wired.",
    },
    {
      id: "alm:irrbb-repricing-gap",
      label: "Repricing-gap engine (IRRBB / EVE / NII)",
      engineerSideState: "specified",
      substrateRequired:
        "Repricing-gap projection per BCBS d365 — bucket banking-book positions by repricing tenor; compute EVE shock and NII sensitivity. Owner: Ravi joint with Rohan (measurement).",
      nextEngineeringStep:
        "Specify EVE shock scenarios per BCBS d365; build first-cut against synthetic banking-book positions; emit `IRRBBChecked`.",
    },
    {
      id: "alm:fx-position",
      label: "FX position projection (Excon)",
      engineerSideState: "specified",
      substrateRequired:
        "FX position projection by currency + entity per Currency & Exchanges Manual. Owner: Ravi (projection); Mira (Excon classification co-owner).",
      nextEngineeringStep:
        "Specify Excon position categories per Currency & Exchanges Manual section A.4; first `FXPositionReported` event fires once first FX-denominated event lands.",
    },
    {
      id: "alm:ftp-attribution",
      label: "FTP attribution engine (transaction-level)",
      engineerSideState: "drafting",
      substrateRequired:
        "FTP-curve register + per-postable-event attribution module subscribing to `TradePosted` / `FundingDrawn` / `DepositReceived`. Owner: Ravi.",
      nextEngineeringStep:
        "Curve registry drafted; market-rate feed integrations (ZARONIA, JIBAR, OIS, FX) deferred to vendor-selection phase — currently the binding gap on first FTP cycle.",
    },
    {
      id: "alm:collateral-inventory",
      label: "Collateral inventory + haircut application",
      engineerSideState: "specified",
      substrateRequired:
        "Collateral-eligibility register + per-counterparty inventory projection + haircut application engine. Owner: Ravi + Atlas. Mandatory pre-condition for repo book.",
      nextEngineeringStep:
        "Specify eligibility schedule alignment with ISDA / GMRA collateral annexes (Imani co-owns); first `CollateralUpdated` event fires once first repo / GMRA contract executed.",
    },
    {
      id: "alm:samos-funding",
      label: "SAMOS funding-window position (correspondent-mediated)",
      engineerSideState: "specified",
      substrateRequired:
        "Correspondent-bank API contract for SAMOS-mediated funding (per indirect-participant posture — `project_indirect_participant_posture.md`). Owner: Tomas (connector); Ravi (funding-plan logic). NOT direct SAMOS membership.",
      nextEngineeringStep:
        "Draft correspondent-bank API contract with Tomas; first `FundingDrawnDown` event fires once correspondent connector lands. Direct SAMOS membership is explicitly out of scope under indirect-participant operating posture.",
    },
  ];
}

function readAlmEventCounts(sinceIso: string): AlmEventCounts {
  const countSince = (type: string): number => {
    let n = 0;
    for (const e of eventStore.replay({ type })) {
      if (e.as_of >= sinceIso) n++;
    }
    return n;
  };
  return {
    hqlaObservedLast7d: countSince("HQLAObserved"),
    lcrComputedLast7d: countSince("LCRComputed"),
    nsfrComputedLast7d: countSince("NSFRComputed"),
    irrbbCheckedLast7d: countSince("IRRBBChecked"),
    fxPositionReportedLast7d: countSince("FXPositionReported"),
    collateralUpdatedLast7d: countSince("CollateralUpdated"),
    fundingDrawnDownLast7d: countSince("FundingDrawnDown"),
  };
}

function buildSnapshot(ctx: AgentRunContext): RaviSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);

  const obligationsPath = resolve(ctx.repoRoot, "Regulations", "_obligations-register.md");
  const obligationsContent = existsSync(obligationsPath)
    ? readFileSync(obligationsPath, "utf8")
    : "";
  const raviObligations = parseRaviObligations(obligationsContent);
  const raviObligationsPartial = raviObligations.filter((r) =>
    /partial|deferred|drafting/i.test(r.status),
  ).length;

  const eitan = readLatestEitanSnapshot();
  const readiness = buildPipelineReadiness();
  const almEvents = readAlmEventCounts(sinceIso);

  let priorRaviSnapshotsLast7d = 0;
  for (const e of eventStore.replay({ type: "ALMReadinessSnapshot" })) {
    if (e.as_of >= sinceIso) priorRaviSnapshotsLast7d++;
  }

  return {
    latestEitanRun: eitan.asOf,
    eitanShadow: eitan.shadow,
    raviObligations,
    raviObligationsPartial,
    readiness,
    almEvents,
    priorRaviSnapshotsLast7d,
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: RaviSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`Eitan's latest LiquiditySnapshot: ${snap.latestEitanRun ?? "never"}`);
  if (snap.eitanShadow) {
    lines.push("Eitan's shadow (last 24h):");
    lines.push(`  - HQLAReported: ${snap.eitanShadow.hqlaReportedLast24h}`);
    lines.push(`  - LiquidityReport: ${snap.eitanShadow.liquidityReportLast24h}`);
    lines.push(`  - LCRRatioProjection: ${snap.eitanShadow.lcrProjectionLast24h}`);
    lines.push(`  - NSFRRatioProjection: ${snap.eitanShadow.nsfrProjectionLast24h}`);
    lines.push(`  - IRRBBChecked: ${snap.eitanShadow.irrbbCheckedLast24h}`);
    lines.push(`  - FXPositionReported: ${snap.eitanShadow.fxPositionReportedLast24h}`);
    lines.push(`  - SAMOSFundingApproved: ${snap.eitanShadow.samosFundingApprovedLast24h}`);
  }
  lines.push("");
  lines.push(`Ravi-owned obligations indexed: ${snap.raviObligations.length}`);
  lines.push(`  - PARTIAL / deferred / drafting: ${snap.raviObligationsPartial}`);
  for (const o of snap.raviObligations) {
    lines.push(`    - ${o.id} (${o.citation}; owner=${o.owner}): ${o.status}`);
  }
  lines.push("");
  lines.push("ALM pipeline readiness:");
  for (const r of snap.readiness) {
    lines.push(`  - [${r.engineerSideState}] ${r.id} — ${r.label}`);
    lines.push(`      substrate: ${r.substrateRequired}`);
    lines.push(`      next: ${r.nextEngineeringStep}`);
  }
  lines.push("");
  lines.push("ALM-domain events (last 7 days):");
  lines.push(`  - HQLAObserved: ${snap.almEvents.hqlaObservedLast7d}`);
  lines.push(`  - LCRComputed: ${snap.almEvents.lcrComputedLast7d}`);
  lines.push(`  - NSFRComputed: ${snap.almEvents.nsfrComputedLast7d}`);
  lines.push(`  - IRRBBChecked: ${snap.almEvents.irrbbCheckedLast7d}`);
  lines.push(`  - FXPositionReported: ${snap.almEvents.fxPositionReportedLast7d}`);
  lines.push(`  - CollateralUpdated: ${snap.almEvents.collateralUpdatedLast7d}`);
  lines.push(`  - FundingDrawnDown: ${snap.almEvents.fundingDrawnDownLast7d}`);
  lines.push(`Prior Ravi runs (last 7d): ${snap.priorRaviSnapshotsLast7d}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on Eitan's first live LCR / NSFR sign-off; close with the next engineering move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: RaviSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Ravi", "alm-readiness", ctx.asOf));
  lines.push(`# Ravi — ALM readiness, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Ravi's daily ALM-readiness attestation per `Team/Ravi.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Seventeenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Engineer-side counterpart to Eitan's `LiquiditySnapshot` — Eitan reports counts of liquidity / treasury events the ALCO chair would consume; Ravi reports the substrate-readiness state for each ALM pipeline (LCR, NSFR, IRRBB, FX position, FTP, collateral, SAMOS funding) the engineer would build to make those events real.",
  );
  lines.push("");
  const readyN = snap.readiness.filter((r) => r.engineerSideState === "ready").length;
  const draftingN = snap.readiness.filter((r) => r.engineerSideState === "drafting").length;
  const specifiedN = snap.readiness.filter((r) => r.engineerSideState === "specified").length;
  const unspecifiedN = snap.readiness.filter(
    (r) => r.engineerSideState === "not-yet-specified",
  ).length;
  const totalAlmEvents =
    snap.almEvents.hqlaObservedLast7d +
    snap.almEvents.lcrComputedLast7d +
    snap.almEvents.nsfrComputedLast7d +
    snap.almEvents.irrbbCheckedLast7d +
    snap.almEvents.fxPositionReportedLast7d +
    snap.almEvents.collateralUpdatedLast7d +
    snap.almEvents.fundingDrawnDownLast7d;
  lines.push(
    `**Headline:** ${snap.readiness.length} ALM pipelines tracked · readiness ${readyN} ready / ${draftingN} drafting / ${specifiedN} specified / ${unspecifiedN} not-yet-specified · ${snap.raviObligations.length} Ravi-owned obligation${snap.raviObligations.length === 1 ? "" : "s"} indexed (${snap.raviObligationsPartial} PARTIAL / drafting) · ${totalAlmEvents} ALM-domain event${totalAlmEvents === 1 ? "" : "s"} (last 7d).`,
  );
  lines.push("");

  lines.push("## Eitan's latest snapshot");
  lines.push("");
  if (snap.latestEitanRun === null || snap.eitanShadow === null) {
    lines.push(
      "_No `LiquiditySnapshot` event in the store. Eitan's daily handler has not yet run on this event-store instance — Ravi's run still produces the engineer-side ALM readiness against the static pipeline shadow._",
    );
  } else {
    lines.push(`Latest \`LiquiditySnapshot\` event: ${snap.latestEitanRun}`);
    lines.push("");
    lines.push("| Eitan event class (last 24h) | Count |");
    lines.push("|---|---|");
    lines.push(`| \`HQLAReported\` | ${snap.eitanShadow.hqlaReportedLast24h} |`);
    lines.push(`| \`LiquidityReport\` | ${snap.eitanShadow.liquidityReportLast24h} |`);
    lines.push(`| \`LCRRatioProjection\` | ${snap.eitanShadow.lcrProjectionLast24h} |`);
    lines.push(`| \`NSFRRatioProjection\` | ${snap.eitanShadow.nsfrProjectionLast24h} |`);
    lines.push(`| \`IRRBBChecked\` | ${snap.eitanShadow.irrbbCheckedLast24h} |`);
    lines.push(`| \`FXPositionReported\` | ${snap.eitanShadow.fxPositionReportedLast24h} |`);
    lines.push(`| \`SAMOSFundingApproved\` | ${snap.eitanShadow.samosFundingApprovedLast24h} |`);
    lines.push("");
    lines.push(
      "Ravi's daily run pairs with Eitan's daily run: Eitan reports the ALCO-chair side; Ravi reports the engineer side. Together they close the read-side ↔ build-side loop on the ALM-projection substrate.",
    );
  }
  lines.push("");

  lines.push("## Ravi-owned obligations slice");
  lines.push("");
  if (snap.raviObligations.length === 0) {
    lines.push("_No Ravi-owned obligation rows parsed._");
  } else {
    lines.push("| Obligation | Citation | Owner | Status |");
    lines.push("|---|---|---|---|");
    for (const o of snap.raviObligations) {
      const safeCitation = o.citation.replace(/\|/g, "\\|");
      const safeOwner = o.owner.replace(/\|/g, "\\|");
      const safeStatus = o.status.replace(/\|/g, "\\|");
      lines.push(`| ${o.id} | ${safeCitation} | ${safeOwner} | ${safeStatus} |`);
    }
  }
  lines.push("");

  lines.push("## ALM pipeline readiness");
  lines.push("");
  lines.push("| Pipeline | Engineer-side state | Substrate required | Next engineering step |");
  lines.push("|---|---|---|---|");
  for (const r of snap.readiness) {
    lines.push(
      `| \`${r.id}\` (${r.label}) | ${r.engineerSideState} | ${r.substrateRequired} | ${r.nextEngineeringStep} |`,
    );
  }
  lines.push("");

  lines.push("## ALM-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`HQLAObserved\` | ${snap.almEvents.hqlaObservedLast7d} |`);
  lines.push(`| \`LCRComputed\` | ${snap.almEvents.lcrComputedLast7d} |`);
  lines.push(`| \`NSFRComputed\` | ${snap.almEvents.nsfrComputedLast7d} |`);
  lines.push(`| \`IRRBBChecked\` | ${snap.almEvents.irrbbCheckedLast7d} |`);
  lines.push(`| \`FXPositionReported\` | ${snap.almEvents.fxPositionReportedLast7d} |`);
  lines.push(`| \`CollateralUpdated\` | ${snap.almEvents.collateralUpdatedLast7d} |`);
  lines.push(`| \`FundingDrawnDown\` | ${snap.almEvents.fundingDrawnDownLast7d} |`);
  lines.push(`| Prior \`ALMReadinessSnapshot\` (this agent) | ${snap.priorRaviSnapshotsLast7d} |`);
  lines.push("");
  if (totalAlmEvents === 0) {
    lines.push(
      '_Build-phase posture: zero ALM-domain events. No real liquidity, no real funding, no real HQLA portfolio per CLAUDE.md "build phase vs licence-day". Engines exist as specs (Team/Ravi.md § 16); first computed-pipeline events fire once the projection runtime, market-rate feeds, and correspondent-bank SAMOS connector land._',
    );
    lines.push("");
  }

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Liquidity / ALM projection runtime (Anya + Ravi)** — pre-condition for `LCRComputed` and `NSFRComputed` events. HQLA inventory + ASF / RSF factor tables specified per Banks Act Reg 26 / Reg 27; not yet wired to the postable-event stream.",
  );
  lines.push(
    "- **Repricing-gap engine (Ravi joint with Rohan)** — pre-condition for `IRRBBChecked` events. EVE shocks per BCBS d365 specified; first run blocks on synthetic banking-book positions in the event log.",
  );
  lines.push(
    "- **FX position projection (Ravi joint with Mira)** — pre-condition for `FXPositionReported`. Excon position categories per Currency & Exchanges Manual specified; first event fires on first FX-denominated postable.",
  );
  lines.push(
    "- **FTP curve sources** — currently the binding gap on the first FTP cycle. Curve registry drafted; market-rate feed integrations (ZARONIA, JIBAR, OIS, FX spot/forward) deferred to vendor-selection phase.",
  );
  lines.push(
    "- **Correspondent-bank SAMOS connector (Tomas + Ravi)** — under indirect-participant operating posture (`project_indirect_participant_posture.md`), the bank does **not** join SAMOS directly; it accesses SAMOS via a sponsor / correspondent bank. The connector is therefore an API contract with the correspondent, not direct SAMOS membership. Pre-condition for `FundingDrawnDown` events.",
  );
  lines.push(
    "- **Collateral inventory substrate (Ravi + Atlas + Imani)** — mandatory for repo book. Eligibility schedule blocks on ISDA / GMRA collateral annexes (Imani's clause library).",
  );
  lines.push(
    "- **Hedge-accounting boundary (Ravi + Bea)** — designation / effectiveness substrate prototyped; Bea's posting boundary not yet wired. Activates with first hedge designation post-licence.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Ravi's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Ravi's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    'Eitan\'s latest `LiquiditySnapshot` via `eventStore.replay({type:"LiquiditySnapshot"})` (max as_of). Read `Regulations/_obligations-register.md` for Ravi-owned rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15; ORG-MK-08). Pipeline-readiness map curated by Ravi against `Team/Ravi.md` § 12 and § 16. ALM-domain event counts via `eventStore.replay({type:"HQLAObserved|LCRComputed|NSFRComputed|IRRBBChecked|FXPositionReported|CollateralUpdated|FundingDrawnDown"})` filtered to last 7 days.',
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "ALMReadinessSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:ravi:alm-readiness" },
      citations: EVENT_CITATIONS,
      payload: {
        pipelineCount: snap.readiness.length,
        readinessReady: snap.readiness.filter((r) => r.engineerSideState === "ready").length,
        readinessDrafting: snap.readiness.filter((r) => r.engineerSideState === "drafting").length,
        readinessSpecified: snap.readiness.filter((r) => r.engineerSideState === "specified")
          .length,
        readinessUnspecified: snap.readiness.filter(
          (r) => r.engineerSideState === "not-yet-specified",
        ).length,
        raviObligationsCount: snap.raviObligations.length,
        raviObligationsPartial: snap.raviObligationsPartial,
        hqlaObservedLast7d: snap.almEvents.hqlaObservedLast7d,
        lcrComputedLast7d: snap.almEvents.lcrComputedLast7d,
        nsfrComputedLast7d: snap.almEvents.nsfrComputedLast7d,
        irrbbCheckedLast7d: snap.almEvents.irrbbCheckedLast7d,
        fxPositionReportedLast7d: snap.almEvents.fxPositionReportedLast7d,
        collateralUpdatedLast7d: snap.almEvents.collateralUpdatedLast7d,
        fundingDrawnDownLast7d: snap.almEvents.fundingDrawnDownLast7d,
        priorRaviSnapshotsLast7d: snap.priorRaviSnapshotsLast7d,
        latestEitanRun: snap.latestEitanRun,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: RAVI_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, snap),
        maxTokens: 6_000,
        effort: "high",
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
          "ravi:alm-readiness — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "ravi narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_ravi_alm-readiness.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      pipelines: snap.readiness.length,
      readinessSpecified: snap.readiness.filter((r) => r.engineerSideState === "specified").length,
      raviObligations: snap.raviObligations.length,
      almEvents:
        snap.almEvents.hqlaObservedLast7d +
        snap.almEvents.lcrComputedLast7d +
        snap.almEvents.nsfrComputedLast7d +
        snap.almEvents.irrbbCheckedLast7d +
        snap.almEvents.fxPositionReportedLast7d +
        snap.almEvents.collateralUpdatedLast7d +
        snap.almEvents.fundingDrawnDownLast7d,
    },
    "ravi:alm-readiness — snapshot built",
  );

  const readyN = snap.readiness.filter((r) => r.engineerSideState === "ready").length;
  const draftingN = snap.readiness.filter((r) => r.engineerSideState === "drafting").length;
  const specifiedN = snap.readiness.filter((r) => r.engineerSideState === "specified").length;
  const unspecifiedN = snap.readiness.filter(
    (r) => r.engineerSideState === "not-yet-specified",
  ).length;
  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.readiness.length} ALM pipelines · ${readyN}/${draftingN}/${specifiedN}/${unspecifiedN} ready/drafting/specified/unspecified · ${snap.raviObligations.length} obligations (${snap.raviObligationsPartial} PARTIAL).`,
    ok: true,
  };
};

export default handler;
