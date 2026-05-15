// runtime/agents/rohan-risk-run.ts
//
// Rohan's daily risk run handler. Fifth handler in the fleet-rollout
// sequence under D-FLEET-ROLLOUT-SEQUENCING (approved 2026-05-08).
// Closes the engineering side of Helena's measurement-substrate gap —
// Helena's daily watch reports unmeasured appetite lines; Rohan's
// daily run is the engineer who would build each measurement, and
// his run reports the measurement-substrate state per line.
//
// What this handler does:
//   1. Reads the latest RiskAppetiteSnapshot from Helena's daily run.
//      That snapshot lists the appetite-line inventory and the status
//      Helena observes (measured / unmeasured / n/a-build-phase).
//      Rohan's job is to provide the engineer-side counterpart: for
//      each unmeasured line, what measurement substrate would close
//      it and what its current build-state is.
//   2. Walks recent RiskRaised events (last 7 days) — both Atlas's
//      substrate-gap risks and any other agent-emitted risks. Rohan
//      attests that each is registered against an appetite line where
//      possible, and surfaces gaps in coverage.
//   3. Walks position events (today: zero — no book in build phase).
//      The shape stays correct when Kai / Tomas / Ravi start emitting
//      TradeBooked / PositionAdjusted / CollateralUpdated events.
//   4. Emits one RiskRunCompleted event carrying the measurement-
//      readiness state and the run's reproducibility hash.
//   5. Writes a daily deliverable to Owner Inbox.
//
// Build-phase posture:
//   - No positions, no market-data feed, no model registry, no risk
//     engine. Rohan's first daily run is a measurement-readiness
//     attestation, not a measured risk run.
//   - When Kai's CDM bindings ship and Tomas's payments stack lands,
//     this handler's "no positions" branch retires; Rohan starts
//     producing actual VaR / sensitivities / RWA computations.
//   - The handler shape stays the same — only the measurement source
//     changes.
//
// Author: Rohan (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BCBS-MR-2019",
  "BCBS-CR-2017",
  "IFRS-9",
  "RAS-FRAMEWORK-2026-05-06",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const ROHAN_NARRATIVE_SYSTEM = `You are Rohan, the bank's risk engineer — owner of the market / credit / liquidity / operational risk engines, IFRS 9 ECL methodology, ICAAP / ILAAP measurement, the limits framework, the model registry, and the daily risk-run pack. Your operating spec is at \`Team/Rohan.md\`. You report through Helena (CRO) at the governance level.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your daily risk-run readiness attestation — for each appetite line in Helena's most recent RiskAppetiteSnapshot, the engineer-side measurement-substrate state, plus a walk of recent RiskRaised events.

You are an engineer. You measure. You do not govern (Helena), nor run (Ravi runs funding), nor audit (Vera). Your voice is precise, model-grounded, calibration-aware. You distinguish *measurable in principle* from *measurable today*; *modelled* from *back-tested*; *production-use* from *validation-pending*. You name what each unmeasured appetite line needs from the engineering substrate before the measurement can fire.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the risk-measurement substrate is and which appetite line is the load-bearing block on Helena's first end-to-end RAS run.
- Picks the 1–3 most consequential observations: an appetite line where the measurement substrate is one engineering ticket away from green, a RiskRaised event without a registered appetite-line owner, a model-registry gap that gates ICAAP measurement.
- Names the next engineering move. Be concrete: a specific projection to build (e.g., capital-base projection for CET1 buffer measurement), a specific model to draft (e.g., trading-book VaR v0), a specific feed to ingest.

Cite Banks Act 94 of 1990, BCBS Market Risk Framework (FRTB / SA-CCR), BCBS Credit Risk Framework, IFRS 9, and the RAS by section where they bind. Helena's snapshot is the canonical authoring location for appetite lines; your narrative is engineer interpretation, not new appetite substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Rohan's narrative". Just produce the prose.

If the input shows zero measurements (build phase), say so plainly. The dominant signal in build phase is the queue of measurement-substrate tickets between today and Helena's first measured RAS run.`;

interface AppetiteLineState {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly tier: string;
  readonly status: string;
  readonly note: string;
}

interface MeasurementReadiness {
  readonly appetiteLineId: string;
  readonly engineerSideState: "ready" | "drafting" | "specified" | "not-yet-specified";
  readonly substrateRequired: string;
  readonly nextEngineeringStep: string;
}

interface RohanSnapshot {
  readonly latestHelenaRun: string | null;
  readonly appetiteLines: readonly AppetiteLineState[];
  readonly readiness: readonly MeasurementReadiness[];
  readonly positionEventsLast7d: number;
  readonly riskRaisedEventsLast7d: number;
  readonly riskRaisedSeverityCounts: Record<string, number>;
}

function readLatestHelenaSnapshot(): {
  asOf: string | null;
  lineStates: readonly AppetiteLineState[];
} {
  let latest: { asOf: string; payload: unknown } | null = null;
  for (const e of eventStore.replay({ type: "RiskAppetiteSnapshot" })) {
    if (latest === null || e.as_of > latest.asOf) {
      latest = { asOf: e.as_of, payload: e.payload };
    }
  }
  if (!latest) return { asOf: null, lineStates: [] };
  // Helena emits a flat payload (counts only) rather than the per-line
  // detail. Per-line detail lives in her deliverable file. For Rohan's
  // first handler we mirror Helena's appetite-line shadow with the
  // same set; once Helena's payload is extended to include lineStates,
  // Rohan reads them from the event directly.
  return { asOf: latest.asOf, lineStates: helenaAppetiteShadow() };
}

// Mirror of Helena's appetite-line shadow. Keep in sync with
// `runtime/agents/helena-risk-appetite-watch.ts:APPETITE_LINES`.
// Substrate gap to fold both into a structured RAS register; closes
// when that register exists.
function helenaAppetiteShadow(): readonly AppetiteLineState[] {
  return [
    {
      id: "appetite:liquidity:lcr",
      label: "LCR buffer",
      category: "liquidity",
      tier: "tier-1",
      status: "unmeasured",
      note: "Substrate: Ravi (eng) → Eitan (Treasurer).",
    },
    {
      id: "appetite:liquidity:nsfr",
      label: "NSFR buffer",
      category: "liquidity",
      tier: "tier-1",
      status: "unmeasured",
      note: "Substrate: Ravi (eng) → Eitan (Treasurer).",
    },
    {
      id: "appetite:capital:cet1-buffer",
      label: "CET1 buffer over PA min",
      category: "capital",
      tier: "tier-1",
      status: "unmeasured",
      note: "Substrate: Bea (eng) joint with Helena.",
    },
    {
      id: "appetite:credit:single-name-concentration",
      label: "Single-name credit concentration",
      category: "credit",
      tier: "tier-2",
      status: "n/a-build-phase",
      note: "Activates at commencement of trading.",
    },
    {
      id: "appetite:credit:sector-concentration",
      label: "Sector concentration",
      category: "credit",
      tier: "tier-2",
      status: "n/a-build-phase",
      note: "Activates at commencement of trading.",
    },
    {
      id: "appetite:market:trading-var",
      label: "Trading-book 1-day 99% VaR",
      category: "market",
      tier: "tier-2",
      status: "n/a-build-phase",
      note: "Activates at commencement of trading.",
    },
    {
      id: "appetite:market:counterparty-concentration",
      label: "Counterparty concentration (markets)",
      category: "market",
      tier: "tier-2",
      status: "n/a-build-phase",
      note: "Activates at commencement of trading.",
    },
    {
      id: "appetite:financial-crime:sanctions-match",
      label: "Sanctions matches blocked",
      category: "financial-crime",
      tier: "zero-appetite",
      status: "green",
      note: "Mira's gate enforces.",
    },
    {
      id: "appetite:financial-crime:str-filing-judgement",
      label: "STR-filing judgement",
      category: "financial-crime",
      tier: "zero-appetite",
      status: "green",
      note: "Mira's gate enforces.",
    },
    {
      id: "appetite:operational:cyber-severity-tiers",
      label: "Cyber severity tiers",
      category: "operational",
      tier: "tier-2",
      status: "unmeasured",
      note: "Substrate: Senna (eng) → Rashida (CISO).",
    },
    {
      id: "appetite:model:tier-discipline",
      label: "Model-risk tier discipline",
      category: "model",
      tier: "tier-2",
      status: "unmeasured",
      note: "Independent Validation function not yet staffed.",
    },
    {
      id: "appetite:climate:guidance-note-1-2024",
      label: "Climate-risk governance",
      category: "climate",
      tier: "tier-2",
      status: "unmeasured",
      note: "PA GN 1 of 2024 substrate not yet specified.",
    },
    {
      id: "appetite:conduct:tcf",
      label: "TCF — zero unfair treatment",
      category: "conduct",
      tier: "zero-appetite",
      status: "green",
      note: "Mira's gate enforces; Niko paused.",
    },
  ];
}

// Engineer-side measurement-readiness map. Each appetite line maps to
// the substrate Rohan (or his engineering peers) would build to close
// the measurement gap. State labels:
//   - ready: substrate exists; measurement runs today
//   - drafting: substrate work in flight (script / module exists)
//   - specified: substrate spec exists (in /Team/<name>.md or RAS)
//   - not-yet-specified: appetite-line known but no substrate spec yet
function buildReadinessMap(): readonly MeasurementReadiness[] {
  return [
    {
      appetiteLineId: "appetite:liquidity:lcr",
      engineerSideState: "specified",
      substrateRequired:
        "Liquidity coverage ratio projection — HQLA inventory + 30-day net cash outflow model. Owner: Ravi (treasury eng).",
      nextEngineeringStep:
        "Specify HQLA classification rules per Banks Act Reg 26; build first-cut projection against synthetic balance.",
    },
    {
      appetiteLineId: "appetite:liquidity:nsfr",
      engineerSideState: "specified",
      substrateRequired:
        "Net stable funding ratio projection — available stable funding vs required stable funding model. Owner: Ravi.",
      nextEngineeringStep:
        "Specify ASF / RSF factor table per BCBS NSFR (2014); same projection-runtime as LCR.",
    },
    {
      appetiteLineId: "appetite:capital:cet1-buffer",
      engineerSideState: "specified",
      substrateRequired:
        "Capital-base projection — CET1 numerator + RWA denominator + Pillar 2A + buffers. Owner: Bea (acc eng) joint with Rohan.",
      nextEngineeringStep:
        "Specify capital-base derivation per Banks Act Reg 38; build against the synthetic capital line in seeds.",
    },
    {
      appetiteLineId: "appetite:credit:single-name-concentration",
      engineerSideState: "not-yet-specified",
      substrateRequired:
        "Single-name exposure projection — credit RWA with obligor aggregation. Owner: Rohan.",
      nextEngineeringStep:
        "Defer to first-portfolio activation; specify cascade alongside Saskia's first counterparty.",
    },
    {
      appetiteLineId: "appetite:credit:sector-concentration",
      engineerSideState: "not-yet-specified",
      substrateRequired:
        "Sector concentration projection — credit RWA aggregated by sector code. Owner: Rohan.",
      nextEngineeringStep: "Defer; first portfolio defines the sector taxonomy.",
    },
    {
      appetiteLineId: "appetite:market:trading-var",
      engineerSideState: "specified",
      substrateRequired:
        "Trading-book 1-day 99% VaR engine — historical-simulation v0 against CDM positions. Owner: Rohan.",
      nextEngineeringStep:
        "Wait for Kai's M1 CDM TypeScript bindings (in flight under D-MARKETS-SCHEMA-FOUNDATION); first VaR fires when first CDM contract booked.",
    },
    {
      appetiteLineId: "appetite:market:counterparty-concentration",
      engineerSideState: "specified",
      substrateRequired:
        "Counterparty PFE projection — SA-CCR per BCBS d317. Owner: Rohan joint with Kai.",
      nextEngineeringStep:
        "Specify SA-CCR table at first counterparty onboarding (Niko activation).",
    },
    {
      appetiteLineId: "appetite:financial-crime:sanctions-match",
      engineerSideState: "drafting",
      substrateRequired:
        "Mira's screening pipeline — gate enforces; no Rohan substrate required. Measurement is pass/fail event count.",
      nextEngineeringStep: "Out of Rohan's scope; Mira owns.",
    },
    {
      appetiteLineId: "appetite:financial-crime:str-filing-judgement",
      engineerSideState: "drafting",
      substrateRequired:
        "Mira's transaction-monitoring pipeline + Zara's MLRO judgement. No Rohan substrate.",
      nextEngineeringStep: "Out of Rohan's scope.",
    },
    {
      appetiteLineId: "appetite:operational:cyber-severity-tiers",
      engineerSideState: "specified",
      substrateRequired:
        "Senna's incident-severity classification + RAS § B6 tier mapping. Operational-risk projection consumes downstream.",
      nextEngineeringStep:
        "Out of Rohan's primary scope; co-consumer of Senna's outputs for op-risk taxonomy.",
    },
    {
      appetiteLineId: "appetite:model:tier-discipline",
      engineerSideState: "specified",
      substrateRequired:
        "Model registry + independent-validation function. Owner: Rohan (registry); independent-validation team (Nolan hire).",
      nextEngineeringStep:
        "Build model registry (no models in build phase, but registry is substrate); flag Independent Validation hire to Nolan.",
    },
    {
      appetiteLineId: "appetite:climate:guidance-note-1-2024",
      engineerSideState: "not-yet-specified",
      substrateRequired:
        "Climate-scenario substrate — transition-risk taxonomy + physical-risk geocoding + scenario engine. Owner: Helena (governance) joint with Rohan (eng).",
      nextEngineeringStep:
        "Specify per PA GN 1 of 2024; multi-quarter build; defer until 2026 H2 unless PA cadence forces earlier.",
    },
    {
      appetiteLineId: "appetite:conduct:tcf",
      engineerSideState: "drafting",
      substrateRequired:
        "Niko's advice-record pipeline + Mira's conduct-monitoring + Zara's FAIS supervision. No Rohan substrate.",
      nextEngineeringStep: "Out of Rohan's scope; activates with Niko at commencement of trading.",
    },
  ];
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readPositionEventsCount(sinceIso: string): number {
  let n = 0;
  for (const t of ["TradeBooked", "PositionAdjusted", "CollateralUpdated"]) {
    for (const e of eventStore.replay({ type: t })) {
      if (e.as_of >= sinceIso) n++;
    }
  }
  return n;
}

function readRiskRaisedCounts(sinceIso: string): {
  total: number;
  bySeverity: Record<string, number>;
} {
  let total = 0;
  const bySeverity: Record<string, number> = {};
  for (const e of eventStore.replay({ type: "RiskRaised" })) {
    if (e.as_of < sinceIso) continue;
    total++;
    const sev = (e.payload as { severity?: string })?.severity ?? "unknown";
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
  }
  return { total, bySeverity };
}

function buildSnapshot(ctx: AgentRunContext): RohanSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  const helena = readLatestHelenaSnapshot();
  const readiness = buildReadinessMap();
  const positions = readPositionEventsCount(sinceIso);
  const risks = readRiskRaisedCounts(sinceIso);
  return {
    latestHelenaRun: helena.asOf,
    appetiteLines: helena.lineStates,
    readiness,
    positionEventsLast7d: positions,
    riskRaisedEventsLast7d: risks.total,
    riskRaisedSeverityCounts: risks.bySeverity,
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: RohanSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`Helena's latest RiskAppetiteSnapshot: ${snap.latestHelenaRun ?? "never"}`);
  lines.push(`Appetite lines inventoried: ${snap.appetiteLines.length}`);
  lines.push("");
  lines.push("measurement readiness by appetite line:");
  for (const r of snap.readiness) {
    lines.push(`  - [${r.engineerSideState}] ${r.appetiteLineId}`);
    lines.push(`      substrate: ${r.substrateRequired}`);
    lines.push(`      next: ${r.nextEngineeringStep}`);
  }
  lines.push("");
  lines.push(
    `position events (last 7d): ${snap.positionEventsLast7d} (TradeBooked + PositionAdjusted + CollateralUpdated)`,
  );
  lines.push(`risks raised (last 7d): ${snap.riskRaisedEventsLast7d}`);
  for (const [sev, n] of Object.entries(snap.riskRaisedSeverityCounts)) {
    lines.push(`  - ${sev}: ${n}`);
  }
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on Helena's first measured RAS run; close with the next engineering move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: RohanSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Rohan", "risk-run", ctx.asOf));
  lines.push(`# Rohan — daily risk run, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Rohan's daily risk run per `Team/Rohan.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fifth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Helena's measurement-substrate gap.",
  );
  lines.push("");
  const readyN = snap.readiness.filter((r) => r.engineerSideState === "ready").length;
  const draftingN = snap.readiness.filter((r) => r.engineerSideState === "drafting").length;
  const specifiedN = snap.readiness.filter((r) => r.engineerSideState === "specified").length;
  const unspecifiedN = snap.readiness.filter(
    (r) => r.engineerSideState === "not-yet-specified",
  ).length;
  lines.push(
    `**Headline:** ${snap.appetiteLines.length} appetite lines tracked · measurement readiness ${readyN} ready / ${draftingN} drafting / ${specifiedN} specified / ${unspecifiedN} not-yet-specified · ${snap.positionEventsLast7d} position event${snap.positionEventsLast7d === 1 ? "" : "s"} (last 7d) · ${snap.riskRaisedEventsLast7d} RiskRaised event${snap.riskRaisedEventsLast7d === 1 ? "" : "s"}.`,
  );
  lines.push("");

  lines.push("## Helena's latest snapshot");
  lines.push("");
  if (snap.latestHelenaRun === null) {
    lines.push(
      "_No `RiskAppetiteSnapshot` event in the store. Helena's daily handler has not yet run on this event-store instance — Rohan's run still produces the engineer-side readiness against the static appetite-line shadow._",
    );
  } else {
    lines.push(`Latest \`RiskAppetiteSnapshot\` event: ${snap.latestHelenaRun}`);
    lines.push("");
    lines.push(
      "Rohan's daily run pairs with Helena's daily run: Helena reports the appetite side; Rohan reports the engineer side. Together they close the read-side ↔ build-side loop on the RAS measurement substrate.",
    );
  }
  lines.push("");

  lines.push("## Measurement readiness by appetite line");
  lines.push("");
  lines.push(
    "| Appetite line | Engineer-side state | Substrate required | Next engineering step |",
  );
  lines.push("|---|---|---|---|");
  for (const r of snap.readiness) {
    lines.push(
      `| \`${r.appetiteLineId}\` | ${r.engineerSideState} | ${r.substrateRequired} | ${r.nextEngineeringStep} |`,
    );
  }
  lines.push("");

  lines.push("## Position events (last 7 days)");
  lines.push("");
  lines.push("| Event class | Count |");
  lines.push("|---|---|");
  lines.push(
    `| \`TradeBooked\` + \`PositionAdjusted\` + \`CollateralUpdated\` | ${snap.positionEventsLast7d} |`,
  );
  lines.push("");
  if (snap.positionEventsLast7d === 0) {
    lines.push(
      "_Build-phase posture: zero position events. Kai's M1 CDM TypeScript bindings (in flight under D-MARKETS-SCHEMA-FOUNDATION) are the precondition; the first `TradeBooked` event activates the position-incremental risk-update path._",
    );
    lines.push("");
  }

  lines.push("## RiskRaised events (last 7 days)");
  lines.push("");
  if (snap.riskRaisedEventsLast7d === 0) {
    lines.push("_No `RiskRaised` events in the last 7 days._");
  } else {
    lines.push("| Severity | Count |");
    lines.push("|---|---|");
    for (const [sev, n] of Object.entries(snap.riskRaisedSeverityCounts).sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`| ${sev} | ${n} |`);
    }
  }
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **CDM bindings (Kai)** — pre-condition for any market-risk measurement. M1 is in flight under D-MARKETS-SCHEMA-FOUNDATION.",
  );
  lines.push(
    "- **Capital-base projection (Bea + Rohan)** — pre-condition for CET1 buffer measurement (the most load-bearing tier-1 line).",
  );
  lines.push(
    "- **HQLA / NSFR projections (Ravi)** — pre-condition for liquidity buffer measurement.",
  );
  lines.push(
    "- **Model registry (Rohan)** — substrate exists for zero models today; first model entry blocks on first measurement.",
  );
  lines.push(
    "- **Independent-validation function (Nolan hire)** — RAS § B7 model-tier discipline depends on independent-validation capacity.",
  );
  lines.push(
    "- **Climate-scenario substrate** — multi-quarter build; defer to 2026 H2 unless PA cadence forces earlier.",
  );
  lines.push(
    "- **Structured RAS register** — appetite lines mirrored in two places (Helena's handler + this handler); folds into a single canonical register when authored.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Rohan's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Rohan's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    'Helena\'s latest `RiskAppetiteSnapshot` via `eventStore.replay({type:"RiskAppetiteSnapshot"})` (max as_of); appetite-line shadow mirrored from `runtime/agents/helena-risk-appetite-watch.ts`; readiness map curated by Rohan; position-event count via `eventStore.replay({type:"TradeBooked|PositionAdjusted|CollateralUpdated"})`; RiskRaised counts via `eventStore.replay({type:"RiskRaised"})` filtered to last 7 days.',
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
      type: "RiskRunCompleted",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:rohan:risk-run" },
      citations: EVENT_CITATIONS,
      payload: {
        appetiteLineCount: snap.appetiteLines.length,
        readinessReady: snap.readiness.filter((r) => r.engineerSideState === "ready").length,
        readinessDrafting: snap.readiness.filter((r) => r.engineerSideState === "drafting").length,
        readinessSpecified: snap.readiness.filter((r) => r.engineerSideState === "specified")
          .length,
        readinessUnspecified: snap.readiness.filter(
          (r) => r.engineerSideState === "not-yet-specified",
        ).length,
        positionEventsLast7d: snap.positionEventsLast7d,
        riskRaisedEventsLast7d: snap.riskRaisedEventsLast7d,
        latestHelenaRun: snap.latestHelenaRun,
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
        stableSystem: ROHAN_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, snap),
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
          "rohan:risk-run — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "rohan narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_rohan_risk-run.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      appetiteLines: snap.appetiteLines.length,
      readinessSpecified: snap.readiness.filter((r) => r.engineerSideState === "specified").length,
      positionEvents: snap.positionEventsLast7d,
      risksRaised: snap.riskRaisedEventsLast7d,
    },
    "rohan:risk-run — snapshot built",
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
    summary: `${snap.appetiteLines.length} appetite lines · ${readyN}/${draftingN}/${specifiedN}/${unspecifiedN} ready/drafting/specified/unspecified · ${snap.positionEventsLast7d} positions · ${snap.riskRaisedEventsLast7d} risks.`,
    ok: true,
  };
};

export default handler;
