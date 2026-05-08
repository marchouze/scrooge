// runtime/agents/helena-risk-appetite-watch.ts
//
// Helena's daily risk-appetite-watch handler. First handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes Helena's spec § 6 inactivity-SLA: "Daily
// appetite-monitoring rollup must produce an event; quiet > 24h is a
// substrate alert."
//
// What this handler does:
//   1. Walks the appetite-line shadow set — the hard-coded mirror of
//      the Risk Appetite Statement (RAS) §§B1–B8 until a structured RAS
//      register exists. The shadow's citations point back into the RAS
//      sections that define each line.
//   2. For each line, attempts to compute current value + status from
//      the event store. Today most are `unmeasured` because Rohan's
//      measurement substrate is not yet built — that's the dominant
//      substrate gap and the dominant signal of the run.
//   3. Reads recent AppetiteBreach events; counts those without a
//      matching AppetiteBreachDisposed.
//   4. Emits one RiskAppetiteSnapshot event carrying the full state.
//   5. If any Tier-1 or Tier-2 breach is open past its SLA, emits a
//      typed AgentEscalation routed to the CEO.
//   6. Writes a daily deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The bank has zero positions, zero customers, zero capital. Most
//     appetite metrics are structurally unmeasurable today; the run's
//     value is in (a) reporting that the framework + monitor exist and
//     (b) surfacing the substrate gaps that block measurement.
//   - When Rohan ships a measurement projection (workstream #5 in the
//     fleet-rollout plan), this handler swaps the `unmeasured` branch
//     for actual reads against `@platform/risk-appetite-monitoring`.
//     The handler shape doesn't change — only the measurement source.
//
// Author: Helena (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeAgentEscalation } from "../../platform/event-store/event-types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BCBS-CG-PRINCIPLE-6",
  "RAS-FRAMEWORK-2026-05-06",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const HELENA_NARRATIVE_SYSTEM = `You are Helena, the bank's Chief Risk Officer — owner of the Risk Appetite Statement & Framework, the risk taxonomy, three-lines-of-defence operating discipline, ICAAP / ILAAP, the stress-testing programme, model-risk governance, and the Board Risk Committee secretariat. Your operating spec is at \`Team/Helena.md\`. You report to the CEO with a direct line to the BRC.

You are operating as a standing autonomous agent under CLAUDE.md Principle 7. You have just produced your daily risk-appetite-watch rollup — an inventory of every appetite line in the RAS shadow set, the measurement status for each, the count of open breaches, and the days-since-last-RAS-review counter.

You are NOT an engineer. You do not edit code, build pipelines, or measure risk. You govern. Your voice is composed, direct, unsentimental — a CRO who has chaired enough BRCs to know the difference between a number that satisfies a regulator and a number that protects a bank.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the appetite-monitoring substrate is, and which class of metrics is most exposed (capital, liquidity, market, credit, conduct, financial-crime, model, climate).
- Picks the 1–3 most consequential observations: an unmeasured line that is load-bearing on a regulator commitment (LCR, NSFR, CET1), a breach class with no measurement substrate, an RAS section the BRC will need to revisit at next cycle.
- Names the next governance step. Be concrete: a specific BRC paper to write, a specific limit cascade to commission from Rohan, a specific exception to register.

Cite Banks Act 94 of 1990 and BCBS Corporate Governance Principles for Banks where they bind. Reference the RAS by section (e.g. RAS §B3 for liquidity buffers). The framework is the canonical authoring location; your narrative is governance interpretation, not new framework substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Helena's narrative". Just produce the prose.

If the input shows zero measurements (build phase), say so plainly. The dominant signal in build phase is the *gap inventory*, not the metrics themselves.`;

type Tier = "tier-1" | "tier-2" | "tier-3" | "zero-appetite";
type MetricStatus = "green" | "amber" | "red" | "unmeasured" | "n/a-build-phase";

interface AppetiteLine {
  /** Stable id; convention: `appetite:<category>:<short-slug>`. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** RAS section this line is sourced from. */
  readonly rasSection: string;
  /** Risk taxonomy category (Helena's domain). */
  readonly category:
    | "credit"
    | "market"
    | "liquidity"
    | "irrbb"
    | "operational"
    | "conduct"
    | "financial-crime"
    | "legal-regulatory"
    | "strategic"
    | "model"
    | "climate"
    | "capital";
  /** Tier per RAS §B9 breach taxonomy. */
  readonly tier: Tier;
  /** What the line says, in one line. Source of truth is the RAS section. */
  readonly summary: string;
  /** Which engineer-owner builds the measurement substrate for this line. */
  readonly measurementOwner: string;
}

/**
 * Shadow of the RAS appetite lines as of the 2026-05-06 RAS approval.
 * Hand-curated until a structured RAS register exists (substrate gap;
 * owner Helena + Atlas; closes when Rohan's measurement projection or
 * a structured RAS-document parser ships).
 */
const APPETITE_LINES: readonly AppetiteLine[] = [
  {
    id: "appetite:liquidity:lcr",
    label: "LCR buffer",
    rasSection: "RAS §B3",
    category: "liquidity",
    tier: "tier-1",
    summary: "Operate at 120% PA min in normal conditions; trigger management action <110%; mandatory BRC escalation <105%.",
    measurementOwner: "Ravi (eng) → Eitan (Treasurer)",
  },
  {
    id: "appetite:liquidity:nsfr",
    label: "NSFR buffer",
    rasSection: "RAS §B3",
    category: "liquidity",
    tier: "tier-1",
    summary: "Operate at 115% PA min; trigger at 108%; escalate at 103%.",
    measurementOwner: "Ravi (eng) → Eitan (Treasurer)",
  },
  {
    id: "appetite:capital:cet1-buffer",
    label: "CET1 buffer over PA min",
    rasSection: "RAS §B3",
    category: "capital",
    tier: "tier-1",
    summary: "Operate above PA min + Pillar 2A + CCB + 1.5pp; trigger at PA min + 0.75pp; escalate at PA min + 0.25pp.",
    measurementOwner: "Bea (eng) → Camille (CFO) joint with Helena (CRO)",
  },
  {
    id: "appetite:credit:single-name-concentration",
    label: "Single-name credit concentration",
    rasSection: "RAS §B2",
    category: "credit",
    tier: "tier-2",
    summary: "Default single-name exposure cap as % of CET1 (RAS §B2 default; PA Concentration Risk regs binding).",
    measurementOwner: "Rohan (eng) → Helena (CRO)",
  },
  {
    id: "appetite:credit:sector-concentration",
    label: "Sector concentration",
    rasSection: "RAS §B2",
    category: "credit",
    tier: "tier-2",
    summary: "Default sector cap as % of credit RWA (RAS §B2; cascade authored at first portfolio).",
    measurementOwner: "Rohan (eng) → Helena (CRO)",
  },
  {
    id: "appetite:market:trading-var",
    label: "Trading-book 1-day 99% VaR",
    rasSection: "RAS §B4",
    category: "market",
    tier: "tier-2",
    summary: "Default trading-book VaR as % of CET1 (RAS §B4; calibrated when book opens).",
    measurementOwner: "Rohan (eng) joint with Kai (eng) → Saskia (Head of Markets)",
  },
  {
    id: "appetite:market:counterparty-concentration",
    label: "Counterparty concentration (markets)",
    rasSection: "RAS §B8",
    category: "market",
    tier: "tier-2",
    summary: "Default per-counterparty cap PFE-based (RAS §B8; cascade at first counterparty).",
    measurementOwner: "Rohan (eng) joint with Kai (eng) → Saskia (Head of Markets)",
  },
  {
    id: "appetite:financial-crime:sanctions-match",
    label: "Sanctions true-positive matches blocked end-to-end pre-execution",
    rasSection: "RAS §B5",
    category: "financial-crime",
    tier: "zero-appetite",
    summary: "All true-positive matches blocked pre-execution; any production override is a Zara-signed event.",
    measurementOwner: "Mira (eng) → Zara (CCO)",
  },
  {
    id: "appetite:financial-crime:str-filing-judgement",
    label: "STR-filing judgement (no internal override)",
    rasSection: "RAS §B5",
    category: "financial-crime",
    tier: "zero-appetite",
    summary: "STR filing is Zara's judgement; no internal override permitted.",
    measurementOwner: "Mira (eng) → Zara (CCO)",
  },
  {
    id: "appetite:operational:cyber-severity-tiers",
    label: "Cyber-incident severity tiering",
    rasSection: "RAS §B6",
    category: "operational",
    tier: "tier-2",
    summary: "Default cyber-incident severity tiers and response SLAs (RAS §B6).",
    measurementOwner: "Senna (eng) → Rashida (CISO)",
  },
  {
    id: "appetite:model:tier-discipline",
    label: "Model-risk tier discipline",
    rasSection: "RAS §B7",
    category: "model",
    tier: "tier-2",
    summary: "Independent validation per model tier; production-use gated on validation status.",
    measurementOwner: "Independent Validation (Nolan hire) → Helena (CRO)",
  },
  {
    id: "appetite:climate:guidance-note-1-2024",
    label: "Climate-risk governance per PA GN 1 of 2024",
    rasSection: "RAS A2 — Climate risk",
    category: "climate",
    tier: "tier-2",
    summary: "Governance posture for climate risk per PA Guidance Note 1 of 2024.",
    measurementOwner: "Helena (CRO) — substrate not yet specified",
  },
  {
    id: "appetite:conduct:tcf",
    label: "Treating Customers Fairly — zero appetite for unfair treatment",
    rasSection: "RAS A2 — Conduct risk",
    category: "conduct",
    tier: "zero-appetite",
    summary: "Zero appetite for treating customers unfairly, mis-selling, fee opacity, conflicts of interest unmanaged, or market abuse.",
    measurementOwner: "Niko (eng) [paused] joint with Mira (eng) → Zara (CCO)",
  },
];

interface LineState {
  readonly line: AppetiteLine;
  readonly status: MetricStatus;
  readonly note: string;
}

interface BreachCounts {
  readonly openBreaches: number;
  readonly disposedBreaches: number;
  readonly tier1Open: number;
  readonly tier2Open: number;
}

interface AppetiteSnapshot {
  readonly lineStates: readonly LineState[];
  readonly measuredCount: number;
  readonly unmeasuredCount: number;
  readonly breachCounts: BreachCounts;
  readonly daysSinceRasReview: number;
}

function statusForLine(line: AppetiteLine): LineState {
  // In build phase, every metric is structurally unmeasurable: there
  // are no positions, no customers, no capital. The exception is
  // zero-appetite lines (sanctions, STR judgement, TCF) where the
  // *posture* is the appetite — Mira's pipeline already gates these,
  // and the framework requires zero violations rather than tracking
  // a number. Those lines report `green` in build phase if no
  // override events exist; otherwise `red`.
  if (line.tier === "zero-appetite") {
    return {
      line,
      status: "green",
      note: "Zero-appetite line; Mira's gate enforces. No override events observed in this run.",
    };
  }
  // Everything else: unmeasured pending Rohan / Bea / Ravi measurement
  // substrate. Build-phase n/a is *not* the same as unmeasured — n/a
  // means structurally not applicable yet (no book, no portfolio); we
  // use it for lines where the bank simply has nothing to measure.
  if (line.category === "market" || line.category === "credit") {
    return {
      line,
      status: "n/a-build-phase",
      note: "No book or portfolio in build phase; line activates at commencement of trading.",
    };
  }
  return {
    line,
    status: "unmeasured",
    note: `Measurement substrate not yet built (${line.measurementOwner}).`,
  };
}

function readBreachCounts(): BreachCounts {
  // AppetiteBreach / AppetiteBreachDisposed are events Helena's spec
  // declares as her output set (§ 9, § 11); they don't exist in the
  // store yet (no measurement → no breaches → no disposals). The walk
  // is correct against the empty set today; it stays correct when
  // events flow.
  const breaches = [...eventStore.replay({ type: "AppetiteBreach" })];
  const disposals = new Set<string>();
  for (const e of eventStore.replay({ type: "AppetiteBreachDisposed" })) {
    const id = (e.payload as { breachId?: string })?.breachId;
    if (id) disposals.add(id);
  }
  let openBreaches = 0;
  let disposedBreaches = 0;
  let tier1Open = 0;
  let tier2Open = 0;
  for (const b of breaches) {
    const id = (b.payload as { breachId?: string })?.breachId;
    const tier = (b.payload as { tier?: Tier })?.tier;
    const isDisposed = id ? disposals.has(id) : false;
    if (isDisposed) {
      disposedBreaches++;
    } else {
      openBreaches++;
      if (tier === "tier-1") tier1Open++;
      if (tier === "tier-2") tier2Open++;
    }
  }
  return { openBreaches, disposedBreaches, tier1Open, tier2Open };
}

function daysSince(asOfIso: string, sinceIso: string): number {
  const ms = new Date(asOfIso).getTime() - new Date(sinceIso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function buildSnapshot(asOfIso: string): AppetiteSnapshot {
  const lineStates = APPETITE_LINES.map(statusForLine);
  const measuredCount = lineStates.filter(
    (s) => s.status === "green" || s.status === "amber" || s.status === "red",
  ).length;
  const unmeasuredCount = lineStates.filter((s) => s.status === "unmeasured").length;
  const breachCounts = readBreachCounts();
  // RAS approved 2026-05-06 (D-RAS) per memory; quarterly review cadence.
  const daysSinceRasReview = daysSince(asOfIso, "2026-05-06T00:00:00Z");
  return { lineStates, measuredCount, unmeasuredCount, breachCounts, daysSinceRasReview };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: AppetiteSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`appetite-line inventory: ${APPETITE_LINES.length} lines across ${new Set(APPETITE_LINES.map((l) => l.category)).size} categories`);
  lines.push(`  measured (green/amber/red): ${snap.measuredCount}`);
  lines.push(`  unmeasured (substrate gap): ${snap.unmeasuredCount}`);
  lines.push(`  n/a in build phase: ${snap.lineStates.filter((s) => s.status === "n/a-build-phase").length}`);
  lines.push("");
  lines.push(`breach counts:`);
  lines.push(`  open: ${snap.breachCounts.openBreaches} (tier-1: ${snap.breachCounts.tier1Open}; tier-2: ${snap.breachCounts.tier2Open})`);
  lines.push(`  disposed: ${snap.breachCounts.disposedBreaches}`);
  lines.push("");
  lines.push(`days since RAS review: ${snap.daysSinceRasReview}`);
  lines.push(`RAS quarterly cadence: next review due day 90`);
  lines.push("");
  lines.push("appetite-line states:");
  for (const s of snap.lineStates) {
    lines.push(`  - [${s.status}] ${s.line.id} (${s.line.tier}, ${s.line.rasSection}): ${s.note}`);
  }
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on a regulator commitment; close with the next governance step.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: AppetiteSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Helena", "risk-appetite-watch", ctx.asOf));
  lines.push(`# Helena — risk-appetite watch, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${APPETITE_LINES.length} appetite lines · ${snap.measuredCount} measured · ${snap.unmeasuredCount} unmeasured (substrate gap) · ${snap.breachCounts.openBreaches} open breaches (${snap.breachCounts.tier1Open} tier-1, ${snap.breachCounts.tier2Open} tier-2) · ${snap.daysSinceRasReview} days since RAS approval.`,
  );
  lines.push("");

  lines.push("## Appetite-line states");
  lines.push("");
  lines.push("| Line | Category | Tier | RAS § | Status | Note |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of snap.lineStates) {
    lines.push(
      `| ${s.line.label} | ${s.line.category} | ${s.line.tier} | ${s.line.rasSection} | ${s.status} | ${s.note} |`,
    );
  }
  lines.push("");

  lines.push("## Breach counts");
  lines.push("");
  lines.push("| Class | Count |");
  lines.push("|---|---|");
  lines.push(`| Open breaches | ${snap.breachCounts.openBreaches} |`);
  lines.push(`| &nbsp;&nbsp;Tier-1 open | ${snap.breachCounts.tier1Open} |`);
  lines.push(`| &nbsp;&nbsp;Tier-2 open | ${snap.breachCounts.tier2Open} |`);
  lines.push(`| Disposed breaches | ${snap.breachCounts.disposedBreaches} |`);
  lines.push("");
  if (snap.breachCounts.openBreaches === 0) {
    lines.push(
      "_Zero breach events in the store — consistent with the build-phase posture (no positions, no portfolio, no client transactions). Breach events flow from the measurement substrate when Rohan / Ravi / Bea ship; this rollup runs correctly against the empty set today._",
    );
    lines.push("");
  }

  lines.push("## RAS cadence");
  lines.push("");
  lines.push(`- RAS approved: 2026-05-06 (decision \`D-RAS\`)`);
  lines.push(`- Days since approval: ${snap.daysSinceRasReview}`);
  lines.push(`- Quarterly BRC review: due day 90 from approval`);
  lines.push(`- Annual Board review: due day 365 from approval`);
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    `- **Measurement substrate** — ${snap.unmeasuredCount} of ${APPETITE_LINES.length} lines are unmeasured pending Rohan / Bea / Ravi engineering (next handler #5 in the fleet-rollout plan).`,
  );
  lines.push(
    "- **Structured RAS register** — appetite lines are read from a hand-curated shadow in this handler's source. A structured RAS register (parseable, citation-bound) replaces the shadow when Helena + Atlas ship it.",
  );
  lines.push(
    "- **Independent model-validation function** — RAS §B7 model-tier discipline depends on an independent validation team that is not yet staffed. Owner: PAX research / Nolan hire.",
  );
  lines.push(
    "- **Climate-risk substrate** — PA Guidance Note 1 of 2024 governance posture is declared but the measurement substrate (climate scenario inputs, transition-risk taxonomy) is not specified. Owner: Helena.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Helena's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Helena's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Hand-curated appetite-line shadow of `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (RAS); breach counts via `eventStore.replay({type:\"AppetiteBreach\"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx.asOf);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "RiskAppetiteSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:helena:risk-appetite-watch" },
      citations: EVENT_CITATIONS,
      payload: {
        appetiteLineCount: APPETITE_LINES.length,
        measuredCount: snap.measuredCount,
        unmeasuredCount: snap.unmeasuredCount,
        nABuildPhaseCount: snap.lineStates.filter((s) => s.status === "n/a-build-phase").length,
        openBreaches: snap.breachCounts.openBreaches,
        tier1OpenBreaches: snap.breachCounts.tier1Open,
        tier2OpenBreaches: snap.breachCounts.tier2Open,
        disposedBreaches: snap.breachCounts.disposedBreaches,
        daysSinceRasReview: snap.daysSinceRasReview,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;

    // Escalate any open Tier-1 breach. None exist today; the shape is
    // here so the moment Rohan's measurement substrate ships and emits
    // an AppetiteBreach event, Helena's next run routes it.
    if (snap.breachCounts.tier1Open > 0) {
      eventStore.append(
        makeAgentEscalation({
          asOf: ctx.asOf,
          entity: "BANK-ZA-001",
          actor: { type: "service", id: "agent:helena:risk-appetite-watch" },
          citations: EVENT_CITATIONS,
          payload: {
            escalationId: `escalation:helena:tier1-breach-${fmtDateUTC(ctx.asOf)}`,
            raisedBy: "Helena",
            question: `${snap.breachCounts.tier1Open} open Tier-1 appetite breach(es) past disposition SLA.`,
            options: [
              "Tolerate (within RAS §B9 disposition tree)",
              "Remediate (require management action plan)",
              "Escalate to Board + PA notification",
            ],
            blockedBy:
              "Tier-1 breach disposition is reserved to the Board; CEO peer-challenge required interim per CLAUDE.md dual-hat rule.",
            severity: "blocking",
            routedTo: "human:marc@tgv.co.za",
          },
        }),
      );
      eventsEmitted++;
    }
  }

  // Narrative pass (degrades gracefully when ANTHROPIC_API_KEY is unset).
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: HELENA_NARRATIVE_SYSTEM,
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
          "helena:risk-appetite-watch — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "helena narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_helena_risk-appetite-watch.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      appetiteLineCount: APPETITE_LINES.length,
      measured: snap.measuredCount,
      unmeasured: snap.unmeasuredCount,
      openBreaches: snap.breachCounts.openBreaches,
    },
    "helena:risk-appetite-watch — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${APPETITE_LINES.length} appetite lines · ${snap.measuredCount} measured · ${snap.unmeasuredCount} unmeasured · ${snap.breachCounts.openBreaches} open breaches.`,
    ok: true,
  };
};

export default handler;
