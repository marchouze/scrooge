// runtime/agents/bea-accounting-readiness.ts
//
// Bea's daily accounting-readiness handler. Eleventh handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes the engineering side of Camille's CFO-line
// substrate gap — Camille's weekly snapshot reports
// closes / BA returns / AFS as `never — substrate gap`; Bea's daily
// run is the engineer who would build the sub-ledger and BA-return
// generator, and her run reports the engineer-side measurement-
// substrate state per accounting cycle.
//
// What this handler does:
//   1. Reads the latest FinancialPositionSnapshot from Camille's
//      weekly run. The snapshot lists the readiness state Camille
//      observes (last close / last BA return / last AFS / last
//      capital-plan refresh — currently all "never — substrate gap").
//      Bea's job is to provide the engineer-side counterpart: for
//      each accounting cycle Camille reports as never, what substrate
//      Bea (or her peers) would build to close the gap and what its
//      current build-state is.
//   2. For each accounting cycle (monthly close, quarterly BA return,
//      annual AFS, capital-plan refresh, IFRS 9 ECL staging cycle),
//      produces an engineer-side readiness map.
//   3. Walks Bea-owned obligations register entries (IFRS-tagged) and
//      reports counts.
//   4. Counts accounting-domain events in last 7 days:
//      IFRSClassificationAssigned, ECLBookingApproved,
//      SubLedgerEntryPosted, RestatementProposed,
//      MaterialIFRSClassificationChange. Most zero in build phase.
//   5. Emits one AccountingReadinessSnapshot event.
//   6. Writes a daily deliverable to Owner Inbox.
//
// Build-phase posture:
//   - No real bookings, no positions, no real capital. IFRS
//     recognition / measurement events don't fire; the close cycle
//     has not been wired end-to-end. The dominant signal in build
//     phase is the queue of substrate tickets between today and
//     Camille's first signed close.
//   - When Atlas's posting pipeline lands and the IFRS-engine
//     spec ships, this handler's "no events" branch retires; Bea
//     starts emitting actual sub-ledger drift / classification /
//     ECL counts.
//   - The handler shape stays the same — only the measurement
//     source changes.
//
// Author: Bea (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { makeAccountingReadinessSnapshot } from "../../platform/event-store/event-types-readiness-snapshots";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "IFRS-FRAMEWORK",
  "IFRS-9",
  "IAS-1",
  "INCOME-TAX-ACT-58-1962",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const BEA_NARRATIVE_SYSTEM = `You are Bea, the bank's accounting and financial reporting engineer — owner of the IFRS-compliant accounting layer end-to-end: chart of accounts, the automated close, the IFRS engine (9 / 7 / 13 / 15 / 16; IAS 1 / 7 / 12), SARB BA returns, statutory annual financial statements, and the auditor pack. Your operating spec is at \`Team/Bea.md\`. You report through Camille (CFO) at the governance level. You co-own IFRS 9 ECL methodology with Rohan; you co-own posting-rule publication with Atlas; you co-own deferred-tax with Yael; you co-own hedge accounting with Ravi.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your daily accounting-readiness attestation — for each accounting cycle Camille's most recent FinancialPositionSnapshot reports as \`never\`, the engineer-side substrate state, plus a count of Bea-owned obligations on the register and a walk of accounting-domain events in the last 7 days.

You are an engineer. You post; you close; you reconcile. You do not govern (Camille signs BA returns and AFS; you draft them) and you do not audit (Vera tests that postings reconcile). Your voice is precise, controller-grade, audit-aware. You distinguish *posted* from *recognised*; *classified* from *measured*; *reconciled* from *signed*; *substrate-ready* from *cycle-completed*. You name what each unbuilt accounting cycle needs from the engineering substrate before the cycle can fire end-to-end.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the accounting substrate is and which cycle is the load-bearing block on Camille's first signed close.
- Picks the 1–3 most consequential observations: an accounting cycle where the substrate is one engineering ticket away from green, an IFRS-tagged obligation at PARTIAL where the policy is approved but the close-engine implementation is missing, a missing posting rule that gates the first sub-ledger entry.
- Names the next engineering move. Be concrete: a specific projection to build (e.g., sub-ledger projection over postable events), a specific posting rule to publish (e.g., FundingDrawn → debit cash / credit funding-liability), a specific BA-return cell map to commission with Anya.

Cite Banks Act 94 of 1990, the IFRS Framework, IFRS 9 / 7 / 13 / 15 / 16, IAS 1 / 7 / 12, and Income Tax Act 58 of 1962 where they bind. Camille's snapshot is the canonical authoring location for CFO-line readiness; your narrative is engineer interpretation, not new readiness substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Bea's narrative". Just produce the prose.

If the input shows zero accounting events (build phase), say so plainly. The dominant signal in build phase is the queue of substrate tickets between today and Camille's first signed close.`;

interface CycleReadiness {
  readonly cycle: string;
  readonly camilleObserves: string;
  readonly engineerSideState: "ready" | "drafting" | "specified" | "not-yet-specified";
  readonly substrateRequired: string;
  readonly nextEngineeringStep: string;
}

interface CamilleReadiness {
  readonly lastCloseApproved: string | null;
  readonly lastBaReturnSigned: string | null;
  readonly lastAfsSigned: string | null;
  readonly lastCapitalPlanRefresh: string | null;
}

interface ObligationsCounts {
  readonly total: number;
  readonly inForce: number;
  readonly partial: number;
  readonly planned: number;
  readonly drafting: number;
  readonly nAyet: number;
}

interface AccountingDomainEvents {
  readonly ifrsClassificationAssignedLast7d: number;
  readonly eclBookingApprovedLast7d: number;
  readonly subLedgerEntryPostedLast7d: number;
  readonly restatementProposedLast7d: number;
  readonly materialIfrsClassificationChangeLast7d: number;
}

interface BeaSnapshot {
  readonly latestCamilleRun: string | null;
  readonly camilleReadiness: CamilleReadiness;
  readonly readiness: readonly CycleReadiness[];
  readonly obligations: ObligationsCounts;
  readonly events: AccountingDomainEvents;
}

function readLatestCamilleSnapshot(): {
  asOf: string | null;
  readiness: CamilleReadiness;
} {
  let latest: { asOf: string; payload: Record<string, unknown> } | null = null;
  for (const e of eventStore.replay({ type: "FinancialPositionSnapshot" })) {
    if (latest === null || e.as_of > latest.asOf) {
      latest = { asOf: e.as_of, payload: (e.payload ?? {}) as Record<string, unknown> };
    }
  }
  if (!latest) {
    return {
      asOf: null,
      readiness: {
        lastCloseApproved: null,
        lastBaReturnSigned: null,
        lastAfsSigned: null,
        lastCapitalPlanRefresh: null,
      },
    };
  }
  const p = latest.payload;
  return {
    asOf: latest.asOf,
    readiness: {
      lastCloseApproved: (p.lastCloseApproved as string | null) ?? null,
      lastBaReturnSigned: (p.lastBaReturnSigned as string | null) ?? null,
      lastAfsSigned: (p.lastAfsSigned as string | null) ?? null,
      lastCapitalPlanRefresh: (p.lastCapitalPlanRefresh as string | null) ?? null,
    },
  };
}

// Engineer-side readiness map. Each accounting cycle Camille tracks
// maps to the substrate Bea (or her peers) would build to close the
// gap. State labels:
//   - ready: substrate exists; cycle runs today
//   - drafting: substrate work in flight (script / module exists)
//   - specified: substrate spec exists (in /Team/Bea.md or policy)
//   - not-yet-specified: cycle known but no substrate spec yet
function buildReadinessMap(camille: CamilleReadiness): readonly CycleReadiness[] {
  return [
    {
      cycle: "Monthly close",
      camilleObserves: camille.lastCloseApproved ?? "never — substrate gap",
      engineerSideState: "specified",
      substrateRequired:
        "Sub-ledger projection over postable events + close-cycle orchestrator + IFRS classification engine. Owner: Bea joint with Atlas.",
      nextEngineeringStep:
        "Specify chart-of-accounts schema; publish first posting rule (synthetic FundingDrawn → debit cash / credit funding-liability) per IFRS 9 + IAS 1; wire CloseApproved producer.",
    },
    {
      cycle: "Quarterly BA return",
      camilleObserves: camille.lastBaReturnSigned ?? "never — substrate gap",
      engineerSideState: "specified",
      substrateRequired:
        "BA-return generator (BA 100 / 200 / 300 / 700) — cell-level mapping from sub-ledger + RWA + obligations register. Owner: Bea joint with Anya.",
      nextEngineeringStep:
        "Draft BA 100 cell-map register against synthetic capital line per Banks Act Reg 38; commission Anya's BA-return projection harness; first dry-run BAReturnGenerated when sub-ledger projection lands.",
    },
    {
      cycle: "Annual AFS",
      camilleObserves: camille.lastAfsSigned ?? "never — substrate gap",
      engineerSideState: "specified",
      substrateRequired:
        "Statutory AFS line-item generator + IFRS 7 disclosure pack + auditor working-paper generator. Owner: Bea.",
      nextEngineeringStep:
        "Defer AFS engine until first close lands; specify line-item schema (IAS 1 structure) so the generator can be drafted in parallel with Bea's close engine.",
    },
    {
      cycle: "Capital-plan refresh",
      camilleObserves: camille.lastCapitalPlanRefresh ?? "never — substrate gap",
      engineerSideState: "specified",
      substrateRequired:
        "Capital-base projection — CET1 numerator + RWA denominator + Pillar 2A + buffers. Owner: Bea joint with Rohan; consumed by Camille + Eitan.",
      nextEngineeringStep:
        "Specify capital-base derivation per Banks Act Reg 38 (mirrors Rohan's CET1-buffer line); build against the synthetic capital line in seeds; CapitalPlanRefreshed wired to Camille's weekly snapshot.",
    },
    {
      cycle: "IFRS 9 ECL staging cycle",
      camilleObserves: "n/a — no exposure book in build phase",
      engineerSideState: "not-yet-specified",
      substrateRequired:
        "ECL staging engine — three-stage IFRS 9 classification + lifetime/12-month PD × LGD × EAD + overlay register. Owner: Bea co-owned with Rohan; methodology approved by Helena, accounting policy approved by Camille.",
      nextEngineeringStep:
        "Defer until first credit exposure (Saskia's first counterparty / Niko activation). Methodology spec stays drafted in parallel so it can be wired the day the first exposure books.",
    },
  ];
}

function readObligationsCounts(repoRoot: string): ObligationsCounts {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  if (!existsSync(path)) {
    return { total: 0, inForce: 0, partial: 0, planned: 0, drafting: 0, nAyet: 0 };
  }
  let txt = "";
  try {
    txt = readFileSync(path, "utf8");
  } catch {
    return { total: 0, inForce: 0, partial: 0, planned: 0, drafting: 0, nAyet: 0 };
  }
  let total = 0;
  let inForce = 0;
  let partial = 0;
  let planned = 0;
  let drafting = 0;
  let nAyet = 0;
  for (const line of txt.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (!/\bBea\b/.test(line)) continue;
    if (/^\|\s*ID\s*\|/i.test(line)) continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    total++;
    if (/\bIN\s*FORCE\b/i.test(line)) inForce++;
    else if (/\bPARTIAL\b/i.test(line)) partial++;
    else if (/\bPLANNED\b/i.test(line)) planned++;
    else if (/\bDRAFTING\b/i.test(line)) drafting++;
    else if (/\bN\/A-yet\b/i.test(line)) nAyet++;
  }
  return { total, inForce, partial, planned, drafting, nAyet };
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readAccountingDomainEvents(sinceIso: string): AccountingDomainEvents {
  let ifrsClass = 0;
  let ecl = 0;
  let subLedger = 0;
  let restatement = 0;
  let materialChange = 0;
  for (const e of eventStore.replay({ type: "IFRSClassificationAssigned" })) {
    if (e.as_of >= sinceIso) ifrsClass++;
  }
  for (const e of eventStore.replay({ type: "ECLBookingApproved" })) {
    if (e.as_of >= sinceIso) ecl++;
  }
  for (const e of eventStore.replay({ type: "SubLedgerEntryPosted" })) {
    if (e.as_of >= sinceIso) subLedger++;
  }
  for (const e of eventStore.replay({ type: "RestatementProposed" })) {
    if (e.as_of >= sinceIso) restatement++;
  }
  for (const e of eventStore.replay({ type: "MaterialIFRSClassificationChange" })) {
    if (e.as_of >= sinceIso) materialChange++;
  }
  return {
    ifrsClassificationAssignedLast7d: ifrsClass,
    eclBookingApprovedLast7d: ecl,
    subLedgerEntryPostedLast7d: subLedger,
    restatementProposedLast7d: restatement,
    materialIfrsClassificationChangeLast7d: materialChange,
  };
}

function buildSnapshot(ctx: AgentRunContext): BeaSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  const camille = readLatestCamilleSnapshot();
  return {
    latestCamilleRun: camille.asOf,
    camilleReadiness: camille.readiness,
    readiness: buildReadinessMap(camille.readiness),
    obligations: readObligationsCounts(ctx.repoRoot),
    events: readAccountingDomainEvents(sinceIso),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: BeaSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`Camille's latest FinancialPositionSnapshot: ${snap.latestCamilleRun ?? "never"}`);
  lines.push("Camille-observed readiness:");
  lines.push(`  last CloseApproved: ${snap.camilleReadiness.lastCloseApproved ?? "never"}`);
  lines.push(`  last BAReturnSigned: ${snap.camilleReadiness.lastBaReturnSigned ?? "never"}`);
  lines.push(`  last AFSSigned: ${snap.camilleReadiness.lastAfsSigned ?? "never"}`);
  lines.push(
    `  last CapitalPlanRefreshed: ${snap.camilleReadiness.lastCapitalPlanRefresh ?? "never"}`,
  );
  lines.push("");
  lines.push("engineer-side readiness by cycle:");
  for (const r of snap.readiness) {
    lines.push(`  - [${r.engineerSideState}] ${r.cycle}`);
    lines.push(`      camille observes: ${r.camilleObserves}`);
    lines.push(`      substrate: ${r.substrateRequired}`);
    lines.push(`      next: ${r.nextEngineeringStep}`);
  }
  lines.push("");
  lines.push("Bea-owned obligations (from Regulations/_obligations-register.md):");
  lines.push(`  total: ${snap.obligations.total}`);
  lines.push(`    IN FORCE: ${snap.obligations.inForce}`);
  lines.push(`    PARTIAL: ${snap.obligations.partial}`);
  lines.push(`    PLANNED: ${snap.obligations.planned}`);
  lines.push(`    DRAFTING: ${snap.obligations.drafting}`);
  lines.push(`    N/A-yet: ${snap.obligations.nAyet}`);
  lines.push("");
  lines.push("accounting-domain events (last 7d):");
  lines.push(`  IFRSClassificationAssigned: ${snap.events.ifrsClassificationAssignedLast7d}`);
  lines.push(`  ECLBookingApproved: ${snap.events.eclBookingApprovedLast7d}`);
  lines.push(`  SubLedgerEntryPosted: ${snap.events.subLedgerEntryPostedLast7d}`);
  lines.push(`  RestatementProposed: ${snap.events.restatementProposedLast7d}`);
  lines.push(
    `  MaterialIFRSClassificationChange: ${snap.events.materialIfrsClassificationChangeLast7d}`,
  );
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on Camille's first signed close; close with the next engineering move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: BeaSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Bea", "accounting-readiness", ctx.asOf));
  lines.push(`# Bea — daily accounting readiness, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Bea's daily accounting-readiness attestation per `Team/Bea.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Eleventh handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Closes the engineer-side of Camille's CFO-line measurement-substrate gap.",
  );
  lines.push("");
  const readyN = snap.readiness.filter((r) => r.engineerSideState === "ready").length;
  const draftingN = snap.readiness.filter((r) => r.engineerSideState === "drafting").length;
  const specifiedN = snap.readiness.filter((r) => r.engineerSideState === "specified").length;
  const unspecifiedN = snap.readiness.filter(
    (r) => r.engineerSideState === "not-yet-specified",
  ).length;
  const totalEvents =
    snap.events.ifrsClassificationAssignedLast7d +
    snap.events.eclBookingApprovedLast7d +
    snap.events.subLedgerEntryPostedLast7d +
    snap.events.restatementProposedLast7d +
    snap.events.materialIfrsClassificationChangeLast7d;
  lines.push(
    `**Headline:** ${snap.readiness.length} accounting cycles tracked · engineer readiness ${readyN} ready / ${draftingN} drafting / ${specifiedN} specified / ${unspecifiedN} not-yet-specified · ${snap.obligations.total} Bea-owned obligation${snap.obligations.total === 1 ? "" : "s"} on register (${snap.obligations.inForce} IN FORCE) · ${totalEvents} accounting event${totalEvents === 1 ? "" : "s"} (last 7d).`,
  );
  lines.push("");

  lines.push("## Camille's latest snapshot");
  lines.push("");
  if (snap.latestCamilleRun === null) {
    lines.push(
      "_No `FinancialPositionSnapshot` event in the store. Camille's weekly handler has not yet run on this event-store instance — Bea's run still produces the engineer-side readiness against the static cycle inventory._",
    );
  } else {
    lines.push(`Latest \`FinancialPositionSnapshot\` event: ${snap.latestCamilleRun}`);
    lines.push("");
    lines.push(
      "Bea's daily run pairs with Camille's weekly run: Camille reports the CFO-line readiness side; Bea reports the engineer side. Together they close the read-side ↔ build-side loop on the close / BA-return / AFS substrate.",
    );
  }
  lines.push("");

  lines.push("## Engineer-side readiness by cycle");
  lines.push("");
  lines.push(
    "| Cycle | Camille observes | Engineer-side state | Substrate required | Next engineering step |",
  );
  lines.push("|---|---|---|---|---|");
  for (const r of snap.readiness) {
    lines.push(
      `| ${r.cycle} | ${r.camilleObserves} | ${r.engineerSideState} | ${r.substrateRequired} | ${r.nextEngineeringStep} |`,
    );
  }
  lines.push("");

  lines.push("## Bea-owned obligations on register");
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
    "_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Bea (typically as the engineer behind a Camille-owned IFRS / BA-return entry). Coarse — refines once the register exposes a structured per-row API._",
  );
  lines.push("");

  lines.push("## Accounting-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(
    `| \`IFRSClassificationAssigned\` | ${snap.events.ifrsClassificationAssignedLast7d} |`,
  );
  lines.push(`| \`ECLBookingApproved\` | ${snap.events.eclBookingApprovedLast7d} |`);
  lines.push(`| \`SubLedgerEntryPosted\` | ${snap.events.subLedgerEntryPostedLast7d} |`);
  lines.push(`| \`RestatementProposed\` | ${snap.events.restatementProposedLast7d} |`);
  lines.push(
    `| \`MaterialIFRSClassificationChange\` | ${snap.events.materialIfrsClassificationChangeLast7d} |`,
  );
  lines.push("");
  if (totalEvents === 0) {
    lines.push(
      "_Build-phase posture: zero accounting-domain events. The bank has no real bookings, no real positions, no real revenue (per CLAUDE.md build-phase vs licence-day). The posting pipeline activates when Atlas's first postable producer ships and synthetic transactions begin flowing through the sub-ledger projection._",
    );
    lines.push("");
  }

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Sub-ledger projection (Bea + Atlas)** — close-cycle pipeline. `CloseApproved` event-type registered on Camille's snapshot but no producer. Required pre-first-close.",
  );
  lines.push(
    "- **Posting-rule register (Bea + Atlas)** — no posting rules published yet; first rule (e.g., `FundingDrawn` → debit cash / credit funding-liability) gates the first sub-ledger entry.",
  );
  lines.push(
    "- **Chart-of-accounts schema (Bea)** — chart not yet authored as a typed register; required input for posting-rule publication.",
  );
  lines.push(
    "- **BA-return generator (Bea + Anya)** — BA 100 / 200 / 300 / 700 cell-map register drafted but not wired to projections. Required pre-first quarterly BA submission.",
  );
  lines.push(
    "- **IFRS engine (Bea)** — IFRS 9 staging logic prototyped; IFRS 13 FV-hierarchy classification prototyped; IFRS 15 / 16 not yet started. Required pre-licence.",
  );
  lines.push(
    "- **Capital-base projection (Bea + Rohan)** — pre-condition for `CapitalPlanRefreshed` cycle and Rohan's CET1-buffer measurement.",
  );
  lines.push(
    "- **Auditor working-paper generator (Bea)** — designed; not yet built. Required pre-first-audit.",
  );
  lines.push(
    "- **XBRL pack builder (Bea)** — gated on first audited reporting cycle; defer to post-licence.",
  );
  lines.push(
    "- **ECL staging engine (Bea + Rohan)** — defer until first credit exposure books; methodology spec stays drafted in parallel.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Bea's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Bea's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    'Camille\'s latest `FinancialPositionSnapshot` via `eventStore.replay({type:"FinancialPositionSnapshot"})` (max as_of); engineer-side readiness map curated by Bea against `Team/Bea.md` § 16 (substrate gaps); Bea-owned obligation counts parsed from `Regulations/_obligations-register.md` (rows where Bea appears in any cell); event counts via `eventStore.replay({type:...})` filtered to last 7 days.',
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append(
      makeAccountingReadinessSnapshot({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:bea:accounting-readiness" },
        citations: EVENT_CITATIONS,
        payload: {
          cycleCount: snap.readiness.length,
          readinessReady: snap.readiness.filter((r) => r.engineerSideState === "ready").length,
          readinessDrafting: snap.readiness.filter((r) => r.engineerSideState === "drafting")
            .length,
          readinessSpecified: snap.readiness.filter((r) => r.engineerSideState === "specified")
            .length,
          readinessUnspecified: snap.readiness.filter(
            (r) => r.engineerSideState === "not-yet-specified",
          ).length,
          beaOwnedObligations: snap.obligations.total,
          obligationsInForce: snap.obligations.inForce,
          obligationsPartial: snap.obligations.partial,
          obligationsPlanned: snap.obligations.planned,
          obligationsDrafting: snap.obligations.drafting,
          obligationsNAyet: snap.obligations.nAyet,
          ...snap.events,
          latestCamilleRun: snap.latestCamilleRun,
          runTrigger: ctx.trigger.id,
        },
      }),
    );
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
        stableSystem: BEA_NARRATIVE_SYSTEM,
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
          "bea:accounting-readiness — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "bea narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_bea_accounting-readiness.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      cycleCount: snap.readiness.length,
      readinessSpecified: snap.readiness.filter((r) => r.engineerSideState === "specified").length,
      beaObligations: snap.obligations.total,
      latestCamilleRun: snap.latestCamilleRun,
    },
    "bea:accounting-readiness — snapshot built",
  );

  const totalEvents =
    snap.events.ifrsClassificationAssignedLast7d +
    snap.events.eclBookingApprovedLast7d +
    snap.events.subLedgerEntryPostedLast7d +
    snap.events.restatementProposedLast7d +
    snap.events.materialIfrsClassificationChangeLast7d;
  const readyN = snap.readiness.filter((r) => r.engineerSideState === "ready").length;
  const draftingN = snap.readiness.filter((r) => r.engineerSideState === "drafting").length;
  const specifiedN = snap.readiness.filter((r) => r.engineerSideState === "specified").length;
  const unspecifiedN = snap.readiness.filter(
    (r) => r.engineerSideState === "not-yet-specified",
  ).length;
  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.readiness.length} cycles · ${readyN}/${draftingN}/${specifiedN}/${unspecifiedN} ready/drafting/specified/unspecified · ${snap.obligations.total} Bea obligations (${snap.obligations.inForce} in force) · ${totalEvents} accounting events.`,
    ok: true,
  };
};

export default handler;
