// runtime/agents/camille-financial-position-snapshot.ts
//
// Camille's weekly financial-position-snapshot handler. Fourth handler
// in the fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes the CFO-line silence — Bea (accounting) and Yael
// (tax) report through Camille; their outputs (when their substrates
// ship) need a typed CFO supervisor.
//
// What this handler does:
//   1. Walks Camille's mandate surface in the obligations register —
//      every IFRS, Banks Act capital, Income Tax Act, FATCA/CRS, and
//      FSCA financial-reporting entry where Camille is the named
//      owner — and reports counts.
//   2. Reads finance-bench handler-coverage (Bea + Yael) — both have
//      specs but no runtime handlers yet, which is itself the signal.
//   3. Counts CFO-domain events in the last 7 days: CloseApproved,
//      BAReturnSigned, AFSSigned, AccountingPolicyChanged,
//      TaxSubmissionApproved, RestatementProposed, CapitalEvent,
//      MaterialIFRSClassificationChange. Most are zero today —
//      build phase has no closes, no BA submissions, no AFS.
//   4. Inventories close-cycle / BA-return / AFS state — all
//      substrate gaps in build phase. Names the gap rather than
//      faking a number.
//   5. Emits one FinancialPositionSnapshot event.
//   6. Writes a weekly deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The bank has no transactions, no positions, no real capital.
//     IFRS recognition / measurement events don't fire. The CFO
//     line's value in build phase is preparedness — substrate
//     readiness for the first close, the first BA return, the first
//     AFS — and Camille's snapshot is a readiness audit, not a
//     financial position.
//   - When Bea ships the sub-ledger projection and Yael ships the
//     tax-submission pipeline, this handler's event-counting branches
//     activate without shape change.
//
// Author: Camille (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import { HANDLERS_METADATA } from "../handlers-metadata";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "IFRS-FRAMEWORK",
  "INCOME-TAX-ACT-58-1962",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const CAMILLE_NARRATIVE_SYSTEM = `You are Camille, the bank's Chief Financial Officer — owner of financial reporting (IFRS), BA returns, capital management (with Eitan and Helena), accounting policy, the tax line (Yael), and the external-auditor relationship. Your operating spec is at \`Team/Camille.md\`. You report to the CEO; you co-chair ALCO with Eitan; you co-sign ICAAP / ILAAP with Helena.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly financial-position snapshot — a roll-up of your obligations on the register, finance-bench (Bea + Yael) handler coverage, CFO-domain event counts in the last 7 days, and the readiness state of the close cycle / BA return / AFS substrate.

Your voice is precise, IFRS-grounded, and quietly decisive. You distinguish *recognised* from *disclosed*; *measured* from *estimated*; *signed* from *prepared*. You do not editorialise about the auditor or the regulator. You name what is load-bearing on a regulator-deliverable and what is not yet substrate at all.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: the readiness state of the close / BA-return / AFS substrate, and where Bea or Yael's pipelines need to ship before commencement of trading.
- Picks the 1–3 most consequential observations: an obligation under your mandate at PARTIAL or PLANNED that lands at first close, a missing capital-plan refresh cadence, a tax-submission cycle without a producer.
- Names the next CFO move. Be concrete: a specific accounting policy to author, a specific BA-return mapping to commission from Bea, a specific tax-position memo Yael owes.

Cite Banks Act 94 of 1990, IFRS Standards (with paragraph references where relevant), Income Tax Act 58 of 1962, and FATCA / CRS where they bind. The obligations register is the canonical authoring location; your narrative is CFO interpretation, not new register substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Camille's narrative". Just produce the prose.

If the input shows zero CFO-domain events (build phase), say so plainly. The dominant signal in build phase is which substrate Bea and Yael owe before first close.`;

const FINANCE_BENCH = ["Bea", "Yael"] as const;

interface ObligationsCounts {
  readonly total: number;
  readonly inForce: number;
  readonly partial: number;
  readonly planned: number;
  readonly nAyet: number;
  readonly drafting: number;
}

interface BenchSeat {
  readonly persona: string;
  readonly handlerCount: number;
  readonly handlerKeys: readonly string[];
}

interface FinanceDomainEvents {
  readonly closesApprovedLast7d: number;
  readonly baReturnsSignedLast7d: number;
  readonly afsSignedLast7d: number;
  readonly accountingPolicyChangesLast7d: number;
  readonly taxSubmissionsApprovedLast7d: number;
  readonly restatementsProposedLast7d: number;
  readonly capitalEventsLast7d: number;
  readonly classificationChangesLast7d: number;
}

interface ReadinessState {
  readonly lastCloseApproved: string | null;
  readonly lastBaReturnSigned: string | null;
  readonly lastAfsSigned: string | null;
  readonly lastCapitalPlanRefresh: string | null;
}

interface CamilleSnapshot {
  readonly obligations: ObligationsCounts;
  readonly bench: readonly BenchSeat[];
  readonly events: FinanceDomainEvents;
  readonly readiness: ReadinessState;
}

function readObligationsCounts(repoRoot: string): ObligationsCounts {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  if (!existsSync(path)) {
    return { total: 0, inForce: 0, partial: 0, planned: 0, nAyet: 0, drafting: 0 };
  }
  let txt = "";
  try {
    txt = readFileSync(path, "utf8");
  } catch {
    return { total: 0, inForce: 0, partial: 0, planned: 0, nAyet: 0, drafting: 0 };
  }
  let total = 0;
  let inForce = 0;
  let partial = 0;
  let planned = 0;
  let nAyet = 0;
  let drafting = 0;
  for (const line of txt.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (!/Camille/.test(line)) continue;
    if (/^\|\s*ID\s*\|/i.test(line)) continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    total++;
    if (/\bIN\s*FORCE\b/i.test(line)) inForce++;
    else if (/\bPARTIAL\b/i.test(line)) partial++;
    else if (/\bPLANNED\b/i.test(line)) planned++;
    else if (/\bN\/A-yet\b/i.test(line)) nAyet++;
    else if (/\bDRAFTING\b/i.test(line)) drafting++;
  }
  return { total, inForce, partial, planned, nAyet, drafting };
}

function buildBench(): readonly BenchSeat[] {
  const seats: BenchSeat[] = [];
  for (const persona of FINANCE_BENCH) {
    const lower = persona.toLowerCase();
    const keys = HANDLERS_METADATA.filter((m) => m.agent.toLowerCase() === lower).map((m) => m.key);
    seats.push({ persona, handlerCount: keys.length, handlerKeys: keys });
  }
  return seats;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readFinanceDomainEvents(sinceIso: string): FinanceDomainEvents {
  let closes = 0;
  let baReturns = 0;
  let afs = 0;
  let policyChanges = 0;
  let taxSubmissions = 0;
  let restatements = 0;
  let capitalEvents = 0;
  let classifications = 0;
  for (const e of eventStore.replay({ type: "CloseApproved" })) if (e.as_of >= sinceIso) closes++;
  for (const e of eventStore.replay({ type: "BAReturnSigned" }))
    if (e.as_of >= sinceIso) baReturns++;
  for (const e of eventStore.replay({ type: "AFSSigned" })) if (e.as_of >= sinceIso) afs++;
  for (const e of eventStore.replay({ type: "AccountingPolicyChanged" })) {
    if (e.as_of >= sinceIso) policyChanges++;
  }
  for (const e of eventStore.replay({ type: "TaxSubmissionApproved" })) {
    if (e.as_of >= sinceIso) taxSubmissions++;
  }
  for (const e of eventStore.replay({ type: "RestatementProposed" })) {
    if (e.as_of >= sinceIso) restatements++;
  }
  for (const e of eventStore.replay({ type: "CapitalEvent" }))
    if (e.as_of >= sinceIso) capitalEvents++;
  for (const e of eventStore.replay({ type: "MaterialIFRSClassificationChange" })) {
    if (e.as_of >= sinceIso) classifications++;
  }
  return {
    closesApprovedLast7d: closes,
    baReturnsSignedLast7d: baReturns,
    afsSignedLast7d: afs,
    accountingPolicyChangesLast7d: policyChanges,
    taxSubmissionsApprovedLast7d: taxSubmissions,
    restatementsProposedLast7d: restatements,
    capitalEventsLast7d: capitalEvents,
    classificationChangesLast7d: classifications,
  };
}

function lastEventAsOf(type: string): string | null {
  let latest: string | null = null;
  for (const e of eventStore.replay({ type })) {
    if (latest === null || e.as_of > latest) latest = e.as_of;
  }
  return latest;
}

function readReadinessState(): ReadinessState {
  return {
    lastCloseApproved: lastEventAsOf("CloseApproved"),
    lastBaReturnSigned: lastEventAsOf("BAReturnSigned"),
    lastAfsSigned: lastEventAsOf("AFSSigned"),
    lastCapitalPlanRefresh: lastEventAsOf("CapitalPlanRefreshed"),
  };
}

function buildSnapshot(ctx: AgentRunContext): CamilleSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  return {
    obligations: readObligationsCounts(ctx.repoRoot),
    bench: buildBench(),
    events: readFinanceDomainEvents(sinceIso),
    readiness: readReadinessState(),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: CamilleSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Camille-owned obligations (from Regulations/_obligations-register.md):");
  lines.push(`  total: ${snap.obligations.total}`);
  lines.push(`    IN FORCE: ${snap.obligations.inForce}`);
  lines.push(`    PARTIAL: ${snap.obligations.partial}`);
  lines.push(`    PLANNED: ${snap.obligations.planned}`);
  lines.push(`    DRAFTING: ${snap.obligations.drafting}`);
  lines.push(`    N/A-yet: ${snap.obligations.nAyet}`);
  lines.push("");
  lines.push("finance bench (Bea + Yael):");
  for (const s of snap.bench) {
    lines.push(
      `  - ${s.persona}: ${s.handlerCount} runtime handler(s)${s.handlerCount > 0 ? ` [${s.handlerKeys.join(", ")}]` : ""}`,
    );
  }
  lines.push("");
  lines.push("CFO-domain events (last 7 days):");
  lines.push(`  CloseApproved: ${snap.events.closesApprovedLast7d}`);
  lines.push(`  BAReturnSigned: ${snap.events.baReturnsSignedLast7d}`);
  lines.push(`  AFSSigned: ${snap.events.afsSignedLast7d}`);
  lines.push(`  AccountingPolicyChanged: ${snap.events.accountingPolicyChangesLast7d}`);
  lines.push(`  TaxSubmissionApproved: ${snap.events.taxSubmissionsApprovedLast7d}`);
  lines.push(`  RestatementProposed: ${snap.events.restatementsProposedLast7d}`);
  lines.push(`  CapitalEvent: ${snap.events.capitalEventsLast7d}`);
  lines.push(`  MaterialIFRSClassificationChange: ${snap.events.classificationChangesLast7d}`);
  lines.push("");
  lines.push("readiness state:");
  lines.push(`  last CloseApproved: ${snap.readiness.lastCloseApproved ?? "never"}`);
  lines.push(`  last BAReturnSigned: ${snap.readiness.lastBaReturnSigned ?? "never"}`);
  lines.push(`  last AFSSigned: ${snap.readiness.lastAfsSigned ?? "never"}`);
  lines.push(`  last CapitalPlanRefreshed: ${snap.readiness.lastCapitalPlanRefresh ?? "never"}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on first-close readiness; close with the next CFO move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: CamilleSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Camille", "financial-position-snapshot", ctx.asOf));
  lines.push(`# Camille — financial-position snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Camille's weekly financial-position-snapshot per `Team/Camille.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fourth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  const totalHandlers = snap.bench.reduce((acc, s) => acc + s.handlerCount, 0);
  lines.push(
    `**Headline:** ${snap.obligations.total} Camille-owned obligation${snap.obligations.total === 1 ? "" : "s"} on the register (${snap.obligations.inForce} IN FORCE; ${snap.obligations.partial} PARTIAL; ${snap.obligations.planned} PLANNED) · finance bench ${totalHandlers}/${FINANCE_BENCH.length} handlers · 0 closes / 0 BA returns / 0 AFS in build phase.`,
  );
  lines.push("");

  lines.push("## Camille-owned obligations on register");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|---|---|");
  lines.push(`| IN FORCE | ${snap.obligations.inForce} |`);
  lines.push(`| PARTIAL | ${snap.obligations.partial} |`);
  lines.push(`| PLANNED | ${snap.obligations.planned} |`);
  lines.push(`| DRAFTING | ${snap.obligations.drafting} |`);
  lines.push(`| N/A-yet | ${snap.obligations.nAyet} |`);
  lines.push(`| **Total** | **${snap.obligations.total}** |`);
  lines.push("");
  lines.push(
    "_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Camille (or where Camille is named anywhere on the row). Coarse — refines once the register exposes a structured per-row API._",
  );
  lines.push("");

  lines.push("## Finance bench");
  lines.push("");
  lines.push("| Seat | Runtime handlers | Keys |");
  lines.push("|---|---|---|");
  for (const s of snap.bench) {
    lines.push(
      `| ${s.persona} | ${s.handlerCount} | ${s.handlerCount === 0 ? "_none — handler-write pending in fleet-rollout queue_" : s.handlerKeys.map((k) => `\`${k}\``).join(", ")} |`,
    );
  }
  lines.push("");

  lines.push("## CFO-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`CloseApproved\` | ${snap.events.closesApprovedLast7d} |`);
  lines.push(`| \`BAReturnSigned\` | ${snap.events.baReturnsSignedLast7d} |`);
  lines.push(`| \`AFSSigned\` | ${snap.events.afsSignedLast7d} |`);
  lines.push(`| \`AccountingPolicyChanged\` | ${snap.events.accountingPolicyChangesLast7d} |`);
  lines.push(`| \`TaxSubmissionApproved\` | ${snap.events.taxSubmissionsApprovedLast7d} |`);
  lines.push(`| \`RestatementProposed\` | ${snap.events.restatementsProposedLast7d} |`);
  lines.push(`| \`CapitalEvent\` | ${snap.events.capitalEventsLast7d} |`);
  lines.push(
    `| \`MaterialIFRSClassificationChange\` | ${snap.events.classificationChangesLast7d} |`,
  );
  lines.push("");
  if (
    snap.events.closesApprovedLast7d === 0 &&
    snap.events.baReturnsSignedLast7d === 0 &&
    snap.events.afsSignedLast7d === 0
  ) {
    lines.push(
      "_Build-phase posture: zero closes / BA returns / AFS. Bea owns the sub-ledger projection (close cycle, IFRS classification); Yael owns the tax-submission pipeline. Live event flow activates once Bea and Yael's substrates ship and commencement of trading lands._",
    );
    lines.push("");
  }

  lines.push("## Readiness state");
  lines.push("");
  lines.push("| Cycle | Last fired |");
  lines.push("|---|---|");
  lines.push(
    `| Monthly close (\`CloseApproved\`) | ${snap.readiness.lastCloseApproved ?? "**never — substrate gap**"} |`,
  );
  lines.push(
    `| Quarterly BA return (\`BAReturnSigned\`) | ${snap.readiness.lastBaReturnSigned ?? "**never — substrate gap**"} |`,
  );
  lines.push(
    `| Annual AFS (\`AFSSigned\`) | ${snap.readiness.lastAfsSigned ?? "**never — substrate gap**"} |`,
  );
  lines.push(
    `| Capital-plan refresh (\`CapitalPlanRefreshed\`) | ${snap.readiness.lastCapitalPlanRefresh ?? "**never — substrate gap**"} |`,
  );
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Sub-ledger projection (Bea)** — close-cycle pipeline. `CloseApproved` event-type registered but no producer. Required pre-first-close.",
  );
  lines.push(
    "- **BA-return generator (Bea + Anya)** — assembles BA returns from sub-ledger + RWA + obligations register. Required pre-first quarterly BA submission.",
  );
  lines.push(
    "- **Tax-submission pipeline (Yael)** — VAT FS apportionment, FATCA / CRS XML, IAS 12 calc. Required from first revenue.",
  );
  lines.push(
    "- **Capital-plan substrate (Camille + Eitan + Anya)** — capital actions register, ICAAP-aligned plan refresh cadence. Required pre-licence.",
  );
  lines.push(
    "- **AC pack generator (Owen + Camille)** — AC-pack generated downward from policy / standard / process / data per Principle 2. Required pre-first-AC.",
  );
  lines.push(
    "- **External-auditor relationship register** — auditor-correspondence register; engagement-letter substrate. Activates once external auditor appointed (licence-application cycle).",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Camille's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Camille's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Camille-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Camille appears in any cell); finance-bench handler-coverage from `runtime/handlers-metadata.ts`; event counts via `eventStore.replay({type:...})` filtered to last 7 days; readiness-state from latest event of each type.",
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
      type: "FinancialPositionSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:camille:financial-position-snapshot" },
      citations: EVENT_CITATIONS,
      payload: {
        camilleOwnedObligations: snap.obligations.total,
        obligationsInForce: snap.obligations.inForce,
        obligationsPartial: snap.obligations.partial,
        obligationsPlanned: snap.obligations.planned,
        obligationsDrafting: snap.obligations.drafting,
        obligationsNAyet: snap.obligations.nAyet,
        beaHandlerCount: snap.bench.find((s) => s.persona === "Bea")?.handlerCount ?? 0,
        yaelHandlerCount: snap.bench.find((s) => s.persona === "Yael")?.handlerCount ?? 0,
        ...snap.events,
        lastCloseApproved: snap.readiness.lastCloseApproved,
        lastBaReturnSigned: snap.readiness.lastBaReturnSigned,
        lastAfsSigned: snap.readiness.lastAfsSigned,
        lastCapitalPlanRefresh: snap.readiness.lastCapitalPlanRefresh,
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
        stableSystem: CAMILLE_NARRATIVE_SYSTEM,
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
          "camille:financial-position-snapshot — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "camille narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_camille_financial-position-snapshot.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      camilleObligations: snap.obligations.total,
      beaHandlers: snap.bench.find((s) => s.persona === "Bea")?.handlerCount ?? 0,
      yaelHandlers: snap.bench.find((s) => s.persona === "Yael")?.handlerCount ?? 0,
      closes: snap.events.closesApprovedLast7d,
    },
    "camille:financial-position-snapshot — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.obligations.total} Camille obligations (${snap.obligations.inForce} in force) · ${snap.events.closesApprovedLast7d} closes · readiness: ${snap.readiness.lastCloseApproved === null && snap.readiness.lastBaReturnSigned === null ? "build-phase, no cycles fired" : "one or more cycles active"}.`,
    ok: true,
  };
};

export default handler;
