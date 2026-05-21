// runtime/agents/yael-tax-readiness.ts
//
// Yael's weekly tax-readiness handler. Twelfth handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Engineer-side counterpart to Camille's CFO-domain
// financial-position-snapshot — pairs the way Rohan/Helena and
// Bea/Camille pair: Yael drafts; Camille signs. Yael's typed events
// stop at `TaxReturnDrafted`; the `TaxReturnSubmitted` event is
// CFO-only (Team/Yael.md §15).
//
// What this handler does:
//   1. Walks Yael-owned obligations register entries — Income Tax Act
//      58 of 1962, VAT Act 89 of 1991, FATCA / CRS, Tax Administration
//      Act 28 of 2011, STT Act 25 of 2007, transfer-pricing — and
//      reports counts.
//   2. Counts tax-domain events in the last 7 days: TaxSubmissionApproved,
//      VATFilingApproved, FATCAReportingPublished, CRSReportingPublished,
//      TransferPricingFilingApproved, STTRemitted, SARSGuidanceScanned,
//      TaxClassificationPublished, FATCAClassificationAssigned,
//      CRSClassificationAssigned, TaxReturnDrafted. Most are zero in
//      build phase — no revenue, no employees, no submissions.
//   3. Reads the latest FinancialPositionSnapshot from Camille's run —
//      the engineer-side pairing pattern (Rohan reads Helena's
//      RiskAppetiteSnapshot; Yael reads Camille's snapshot to anchor
//      tax-cycle readiness against the CFO line's view of the close).
//   4. For each tax cycle (CIT, VAT, FATCA / CRS, transfer pricing,
//      STT, SARS BRS scan), reports engineer-side readiness:
//      ready / drafting / specified / not-yet-specified.
//   5. Emits one TaxReadinessSnapshot event.
//   6. Writes a weekly deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The bank has no revenue, no employees, no inter-entity flows,
//     no SARS submissions. Yael's surface is overwhelmingly *deferred*
//     until commencement-of-trading or licence-day. The substantive
//     build-phase work is keeping the SARS BRS implementations
//     current, the FATCA / CRS classification taxonomy aligned with
//     the OECD CRS publication, and the VAT FS-apportionment
//     methodology rehearsed against synthetic postings.
//   - When revenue starts (= licence-day for most flows), the
//     event-counting branches activate without shape change.
//
// Author: Yael (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "INCOME-TAX-ACT-58-1962",
  "VAT-ACT-89-1991",
  "TAX-ADMIN-ACT-28-2011",
  "FATCA-IGA-2014",
  "CRS-OECD-2014",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const YAEL_NARRATIVE_SYSTEM = `You are Yael, the bank's tax engineer — owner of every applicable South African tax obligation as code. SARS submissions, VAT FS-apportionment, FATCA / CRS XML production, IFRS tax accounting (with Bea), and transfer-pricing documentation for inter-entity flows. Your operating spec is at \`Team/Yael.md\`. You report through Camille (CFO). You draft; Camille signs — \`TaxReturnDrafted\` is your terminal event, \`TaxReturnSubmitted\` is Camille's.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly tax-readiness snapshot — a roll-up of obligations under your mandate, tax-domain event counts in the last 7 days, the engineer-side readiness state of each tax cycle, and the alignment to Camille's latest financial-position snapshot.

Your voice is meticulous, slightly pedantic, and unapologetically literal about statutes. You quote sections. You distinguish *what SARS published* from *what practitioners assume*. You distinguish *drafted* from *submitted*; *classified* from *certified*; *registered* from *approved*. You do not editorialise about SARS or National Treasury.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: which tax cycles are *ready* in substrate (SARS BRS implementation current, taxonomy aligned, computation reproducible from posting events) and which are *not-yet-specified*.
- Picks the 1–3 most consequential observations: a SARS BRS update that has not been ingested, a FATCA / CRS classification taxonomy drift against the latest OECD publication, a VAT FS-apportionment basis that needs Camille sign-off pre-licence, a transfer-pricing methodology gap that lands the moment a second entity registers.
- Names the next tax-engineer move. Be concrete: a specific BRS to re-pull from SARS, a specific clause in the SARS-rulings landscape to memo for VAT, a specific classification rule to wire into the FATCA / CRS pipeline, a specific deferred-tax position to draft with Bea.

Cite Income Tax Act 58 of 1962, VAT Act 89 of 1991, Tax Administration Act 28 of 2011, the FATCA IGA, and the OECD CRS where they bind — section / paragraph references where relevant. The obligations register is the canonical authoring location; your narrative is tax-engineer interpretation, not new register substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Yael's narrative". Just produce the prose.

If the input shows zero tax-domain events (build phase), say so plainly. The dominant signal in build phase is which substrate Yael owes before first revenue and before licence-day, not a stream of submissions.`;

interface ObligationsCounts {
  readonly total: number;
  readonly inForce: number;
  readonly partial: number;
  readonly planned: number;
  readonly nAyet: number;
  readonly drafting: number;
}

interface TaxDomainEvents {
  readonly taxSubmissionsApprovedLast7d: number;
  readonly vatFilingsApprovedLast7d: number;
  readonly fatcaReportingsPublishedLast7d: number;
  readonly crsReportingsPublishedLast7d: number;
  readonly transferPricingFilingsApprovedLast7d: number;
  readonly sttRemittedLast7d: number;
  readonly sarsGuidanceScannedLast7d: number;
  readonly taxClassificationsPublishedLast7d: number;
  readonly fatcaClassificationsAssignedLast7d: number;
  readonly crsClassificationsAssignedLast7d: number;
  readonly taxReturnsDraftedLast7d: number;
}

type CycleState = "ready" | "drafting" | "specified" | "not-yet-specified";

interface TaxCycleReadiness {
  readonly id: string;
  readonly label: string;
  readonly state: CycleState;
  readonly note: string;
}

interface CamilleAnchor {
  readonly snapshotAsOf: string | null;
  readonly lastCloseApproved: string | null;
  readonly lastBaReturnSigned: string | null;
}

interface YaelSnapshot {
  readonly obligations: ObligationsCounts;
  readonly events: TaxDomainEvents;
  readonly cycles: readonly TaxCycleReadiness[];
  readonly camille: CamilleAnchor;
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
  // Walk every table row mentioning Yael — same forgiving filter as
  // Zara's MLRO-supervision handler. Refines once the obligations
  // register exposes a structured per-row API.
  let total = 0;
  let inForce = 0;
  let partial = 0;
  let planned = 0;
  let nAyet = 0;
  let drafting = 0;
  for (const line of txt.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (!/Yael/.test(line)) continue;
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

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readTaxDomainEvents(sinceIso: string): TaxDomainEvents {
  let taxSubs = 0;
  let vat = 0;
  let fatcaPub = 0;
  let crsPub = 0;
  let tp = 0;
  let stt = 0;
  let brs = 0;
  let classifications = 0;
  let fatcaCls = 0;
  let crsCls = 0;
  let drafted = 0;
  for (const e of eventStore.replay({ type: "TaxSubmissionApproved" })) {
    if (e.as_of >= sinceIso) taxSubs++;
  }
  for (const e of eventStore.replay({ type: "VATFilingApproved" })) {
    if (e.as_of >= sinceIso) vat++;
  }
  for (const e of eventStore.replay({ type: "FATCAReportingPublished" })) {
    if (e.as_of >= sinceIso) fatcaPub++;
  }
  for (const e of eventStore.replay({ type: "CRSReportingPublished" })) {
    if (e.as_of >= sinceIso) crsPub++;
  }
  for (const e of eventStore.replay({ type: "TransferPricingFilingApproved" })) {
    if (e.as_of >= sinceIso) tp++;
  }
  for (const e of eventStore.replay({ type: "STTRemitted" })) {
    if (e.as_of >= sinceIso) stt++;
  }
  for (const e of eventStore.replay({ type: "SARSGuidanceScanned" })) {
    if (e.as_of >= sinceIso) brs++;
  }
  for (const e of eventStore.replay({ type: "TaxClassificationPublished" })) {
    if (e.as_of >= sinceIso) classifications++;
  }
  for (const e of eventStore.replay({ type: "FATCAClassificationAssigned" })) {
    if (e.as_of >= sinceIso) fatcaCls++;
  }
  for (const e of eventStore.replay({ type: "CRSClassificationAssigned" })) {
    if (e.as_of >= sinceIso) crsCls++;
  }
  for (const e of eventStore.replay({ type: "TaxReturnDrafted" })) {
    if (e.as_of >= sinceIso) drafted++;
  }
  return {
    taxSubmissionsApprovedLast7d: taxSubs,
    vatFilingsApprovedLast7d: vat,
    fatcaReportingsPublishedLast7d: fatcaPub,
    crsReportingsPublishedLast7d: crsPub,
    transferPricingFilingsApprovedLast7d: tp,
    sttRemittedLast7d: stt,
    sarsGuidanceScannedLast7d: brs,
    taxClassificationsPublishedLast7d: classifications,
    fatcaClassificationsAssignedLast7d: fatcaCls,
    crsClassificationsAssignedLast7d: crsCls,
    taxReturnsDraftedLast7d: drafted,
  };
}

function readCamilleAnchor(): CamilleAnchor {
  // Engineer-side pairing pattern: read the latest CFO snapshot to
  // anchor tax-readiness against the close-cycle view. Mirrors the
  // shape Rohan uses to read Helena's RiskAppetiteSnapshot.
  let latest: { asOf: string; payload: unknown } | null = null;
  for (const e of eventStore.replay({ type: "FinancialPositionSnapshot" })) {
    if (latest === null || e.as_of > latest.asOf) {
      latest = { asOf: e.as_of, payload: e.payload };
    }
  }
  if (!latest) {
    return {
      snapshotAsOf: null,
      lastCloseApproved: null,
      lastBaReturnSigned: null,
    };
  }
  const p = latest.payload as {
    lastCloseApproved?: string | null;
    lastBaReturnSigned?: string | null;
  };
  return {
    snapshotAsOf: latest.asOf,
    lastCloseApproved: p?.lastCloseApproved ?? null,
    lastBaReturnSigned: p?.lastBaReturnSigned ?? null,
  };
}

// Yael-side readiness shadow — the tax-cycle list with current
// engineer-side state. Curated by Yael; mirrors Team/Yael.md §16
// (Substrate gaps). Refines into a typed register once the SARS BRS
// implementations and the FATCA / CRS pipeline are specified.
function buildCycleReadiness(events: TaxDomainEvents): readonly TaxCycleReadiness[] {
  // Build-phase: every cycle is at most "specified". SARS BRS scan is
  // "drafting" once SARSGuidanceScanned has been observed; until then
  // it's "specified" (the cadence is in the spec; the producer is
  // this very handler, and the first run will flip the state).
  const brsState: CycleState = events.sarsGuidanceScannedLast7d > 0 ? "drafting" : "specified";
  return [
    {
      id: "tax-cycle:cit",
      label: "CIT — provisional + final (IRP6 / ITR14)",
      state: "not-yet-specified",
      note: "Activates at revenue-start (= licence-day for most flows). Tax engine designed; computation pipeline unwired.",
    },
    {
      id: "tax-cycle:vat",
      label: "VAT — monthly cycle with FS-apportionment",
      state: "specified",
      note: "VAT FS-apportionment engine designed; rehearsed against synthetic postings; SARS-rulings methodology not yet sign-off-ready by Camille. Pre-licence target.",
    },
    {
      id: "tax-cycle:stt",
      label: "STT — continuous (per trade)",
      state: "not-yet-specified",
      note: "Activates at first trade. STT Act 25 of 2007 binding only at commencement-of-trading per project_rules_bind_at_commencement.",
    },
    {
      id: "tax-cycle:fatca-crs",
      label: "FATCA / CRS — annual XML",
      state: "specified",
      note: "Schema designed against current OECD CRS publication; classification taxonomy maintained. XML production pipeline unwired. Co-owned with Mira.",
    },
    {
      id: "tax-cycle:transfer-pricing",
      label: "Transfer pricing — master file + local file",
      state: "not-yet-specified",
      note: "Single-entity during build phase means no inter-entity flows yet to test against. Activates on second-entity registration. Co-owned with Imani.",
    },
    {
      id: "tax-cycle:it3",
      label: "IT3(b)/(c)/(s) — quarterly third-party data",
      state: "not-yet-specified",
      note: "Activates at licence-day. SARS BRS implementations pending.",
    },
    {
      id: "tax-cycle:emp",
      label: "EMP201 / EMP501 / IRP5 — employment taxes",
      state: "not-yet-specified",
      note: "PAYE / EMP slice paused per project_ai_driven_bank — no employees during build phase. Activates at licence-day. Co-owned with Sade.",
    },
    {
      id: "tax-cycle:deferred-tax",
      label: "Deferred tax — IAS 12 / IFRIC 23",
      state: "specified",
      note: "Computation logic specified; activates at first close. Co-owned with Bea (IFRS classification side).",
    },
    {
      id: "tax-cycle:sars-brs-scan",
      label: "SARS BRS / guidance scan (build phase)",
      state: brsState,
      note: "Weekly scan owned by this handler. First SARSGuidanceScanned event flips state to drafting; ingestion pipeline still substrate-gap.",
    },
  ];
}

function buildSnapshot(ctx: AgentRunContext): YaelSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  const events = readTaxDomainEvents(sinceIso);
  return {
    obligations: readObligationsCounts(ctx.repoRoot),
    events,
    cycles: buildCycleReadiness(events),
    camille: readCamilleAnchor(),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: YaelSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Yael-owned obligations (from Regulations/_obligations-register.md):");
  lines.push(`  total: ${snap.obligations.total}`);
  lines.push(`    IN FORCE: ${snap.obligations.inForce}`);
  lines.push(`    PARTIAL: ${snap.obligations.partial}`);
  lines.push(`    PLANNED: ${snap.obligations.planned}`);
  lines.push(`    DRAFTING: ${snap.obligations.drafting}`);
  lines.push(`    N/A-yet: ${snap.obligations.nAyet}`);
  lines.push("");
  lines.push("tax-domain events (last 7 days):");
  lines.push(`  TaxSubmissionApproved: ${snap.events.taxSubmissionsApprovedLast7d}`);
  lines.push(`  VATFilingApproved: ${snap.events.vatFilingsApprovedLast7d}`);
  lines.push(`  FATCAReportingPublished: ${snap.events.fatcaReportingsPublishedLast7d}`);
  lines.push(`  CRSReportingPublished: ${snap.events.crsReportingsPublishedLast7d}`);
  lines.push(
    `  TransferPricingFilingApproved: ${snap.events.transferPricingFilingsApprovedLast7d}`,
  );
  lines.push(`  STTRemitted: ${snap.events.sttRemittedLast7d}`);
  lines.push(`  SARSGuidanceScanned: ${snap.events.sarsGuidanceScannedLast7d}`);
  lines.push(`  TaxClassificationPublished: ${snap.events.taxClassificationsPublishedLast7d}`);
  lines.push(`  FATCAClassificationAssigned: ${snap.events.fatcaClassificationsAssignedLast7d}`);
  lines.push(`  CRSClassificationAssigned: ${snap.events.crsClassificationsAssignedLast7d}`);
  lines.push(`  TaxReturnDrafted: ${snap.events.taxReturnsDraftedLast7d}`);
  lines.push("");
  lines.push("tax-cycle readiness (engineer-side):");
  for (const c of snap.cycles) {
    lines.push(`  - ${c.label}: ${c.state} — ${c.note}`);
  }
  lines.push("");
  lines.push("Camille's latest FinancialPositionSnapshot anchor:");
  lines.push(
    `  as_of: ${snap.camille.snapshotAsOf ?? "never (no FinancialPositionSnapshot observed)"}`,
  );
  lines.push(`  last CloseApproved: ${snap.camille.lastCloseApproved ?? "never"}`);
  lines.push(`  last BAReturnSigned: ${snap.camille.lastBaReturnSigned ?? "never"}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on first-revenue / licence-day readiness; close with the next tax-engineer move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: YaelSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Yael", "tax-readiness", ctx.asOf));
  lines.push(`# Yael — tax readiness, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Yael's weekly tax-readiness snapshot per `Team/Yael.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Twelfth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  const ready = snap.cycles.filter((c) => c.state === "ready").length;
  const drafting = snap.cycles.filter((c) => c.state === "drafting").length;
  const specified = snap.cycles.filter((c) => c.state === "specified").length;
  const notYet = snap.cycles.filter((c) => c.state === "not-yet-specified").length;
  lines.push(
    `**Headline:** ${snap.obligations.total} Yael-owned obligation${snap.obligations.total === 1 ? "" : "s"} on the register (${snap.obligations.inForce} IN FORCE; ${snap.obligations.partial} PARTIAL; ${snap.obligations.planned} PLANNED) · ${snap.cycles.length} tax cycles tracked (${ready} ready / ${drafting} drafting / ${specified} specified / ${notYet} not-yet-specified) · ${snap.events.taxReturnsDraftedLast7d} drafts / ${snap.events.taxSubmissionsApprovedLast7d} approvals in last 7 days · Camille anchor: ${snap.camille.snapshotAsOf ? "present" : "**absent — substrate gap**"}.`,
  );
  lines.push("");

  lines.push("## Yael-owned obligations on register");
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
    "_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Yael (or where Yael is named anywhere on the row). Coarse — refines once the obligations register exposes a structured per-row API._",
  );
  lines.push("");

  lines.push("## Tax-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`TaxSubmissionApproved\` | ${snap.events.taxSubmissionsApprovedLast7d} |`);
  lines.push(`| \`VATFilingApproved\` | ${snap.events.vatFilingsApprovedLast7d} |`);
  lines.push(`| \`FATCAReportingPublished\` | ${snap.events.fatcaReportingsPublishedLast7d} |`);
  lines.push(`| \`CRSReportingPublished\` | ${snap.events.crsReportingsPublishedLast7d} |`);
  lines.push(
    `| \`TransferPricingFilingApproved\` | ${snap.events.transferPricingFilingsApprovedLast7d} |`,
  );
  lines.push(`| \`STTRemitted\` | ${snap.events.sttRemittedLast7d} |`);
  lines.push(`| \`SARSGuidanceScanned\` | ${snap.events.sarsGuidanceScannedLast7d} |`);
  lines.push(
    `| \`TaxClassificationPublished\` | ${snap.events.taxClassificationsPublishedLast7d} |`,
  );
  lines.push(
    `| \`FATCAClassificationAssigned\` | ${snap.events.fatcaClassificationsAssignedLast7d} |`,
  );
  lines.push(`| \`CRSClassificationAssigned\` | ${snap.events.crsClassificationsAssignedLast7d} |`);
  lines.push(`| \`TaxReturnDrafted\` | ${snap.events.taxReturnsDraftedLast7d} |`);
  lines.push("");
  if (
    snap.events.taxSubmissionsApprovedLast7d === 0 &&
    snap.events.vatFilingsApprovedLast7d === 0 &&
    snap.events.taxReturnsDraftedLast7d === 0
  ) {
    lines.push(
      "_Build-phase posture: zero tax submissions / drafts. No revenue, no employees, no inter-entity flows. Live event flow activates at revenue-start (= licence-day for most flows) per `project_rules_bind_at_commencement` — banking-specific tax obligations bind at commencement of trading, not during build phase._",
    );
    lines.push("");
  }

  lines.push("## Tax-cycle readiness (engineer-side)");
  lines.push("");
  lines.push("| Cycle | State | Note |");
  lines.push("|---|---|---|");
  for (const c of snap.cycles) {
    lines.push(`| ${c.label} | \`${c.state}\` | ${c.note} |`);
  }
  lines.push("");
  lines.push(
    "_Yael drafts; Camille signs (`Team/Yael.md` §15). The drafter / signer split is preserved architecturally — Yael's typed events stop at `TaxReturnDrafted`; `TaxReturnSubmitted` is Camille-only. Readiness here is tax-engineer state, not CFO sign-off state._",
  );
  lines.push("");

  lines.push("## Camille's financial-position anchor");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(
    `| Latest \`FinancialPositionSnapshot\` as_of | ${snap.camille.snapshotAsOf ?? "**never — substrate gap**"} |`,
  );
  lines.push(
    `| Last \`CloseApproved\` | ${snap.camille.lastCloseApproved ?? "never (build phase)"} |`,
  );
  lines.push(
    `| Last \`BAReturnSigned\` | ${snap.camille.lastBaReturnSigned ?? "never (build phase)"} |`,
  );
  lines.push("");
  lines.push(
    "_Engineer-side pairing pattern: Yael consumes Camille's CFO snapshot to anchor tax-cycle readiness against the close view. Mirrors the way Rohan reads Helena's `RiskAppetiteSnapshot`._",
  );
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Tax engine** — designed; partial. CIT / IRP6 / ITR14 computation pipeline unwired. Required pre-revenue.",
  );
  lines.push(
    "- **VAT FS-apportionment engine** — designed; methodology rehearsed against synthetic postings. Camille sign-off pending. Pre-licence target.",
  );
  lines.push(
    "- **FATCA / CRS XML pipeline** — schema designed; classification taxonomy maintained against current OECD CRS publication; XML production pipeline unwired. Pre-licence target. Co-owned with Mira.",
  );
  lines.push(
    "- **SARS eFiling interface** — designed; not yet built. Submission events run as paper exercises during build. Pre-licence-go-live target. Co-owned with Atlas.",
  );
  lines.push(
    "- **SARS BRS ingestion** — weekly scan owned by this handler; the BRS-pull machinery and diff-against-prior-version are substrate-gap. First `SARSGuidanceScanned` event flips state to drafting.",
  );
  lines.push(
    "- **Transfer-pricing tooling** — designed; not yet built. Activates on second-entity registration. Co-owned with Imani.",
  );
  lines.push(
    "- **Tax-mart definitions** — quarterly review with Anya; tax-mart projection schemas not yet specified. Pre-licence target.",
  );
  lines.push(
    "- **`TaxReadinessSnapshot` event registry entry** — this handler's typed snapshot event is not yet listed in `platform/event-store/registry.ts` (fail-open path used today, consistent with the other recently-added snapshot events). Atlas register-fold pending.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Yael's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Yael's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Yael-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Yael appears in any cell); tax-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; tax-cycle readiness curated by Yael against `Team/Yael.md` §16 substrate gaps; Camille-anchor read from latest `FinancialPositionSnapshot` event payload.",
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
      type: "TaxReadinessSnapshot",
      as_of: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:yael:tax-readiness" },
      citations: EVENT_CITATIONS,
      payload: {
        yaelOwnedObligations: snap.obligations.total,
        obligationsInForce: snap.obligations.inForce,
        obligationsPartial: snap.obligations.partial,
        obligationsPlanned: snap.obligations.planned,
        obligationsDrafting: snap.obligations.drafting,
        obligationsNAyet: snap.obligations.nAyet,
        ...snap.events,
        cycleCount: snap.cycles.length,
        cyclesReady: snap.cycles.filter((c) => c.state === "ready").length,
        cyclesDrafting: snap.cycles.filter((c) => c.state === "drafting").length,
        cyclesSpecified: snap.cycles.filter((c) => c.state === "specified").length,
        cyclesNotYetSpecified: snap.cycles.filter((c) => c.state === "not-yet-specified").length,
        camilleSnapshotAsOf: snap.camille.snapshotAsOf,
        camilleLastCloseApproved: snap.camille.lastCloseApproved,
        camilleLastBaReturnSigned: snap.camille.lastBaReturnSigned,
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
        stableSystem: YAEL_NARRATIVE_SYSTEM,
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
          "yael:tax-readiness — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "yael narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_yael_tax-readiness.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      yaelObligations: snap.obligations.total,
      cycles: snap.cycles.length,
      taxReturnsDrafted: snap.events.taxReturnsDraftedLast7d,
      camilleAnchor: snap.camille.snapshotAsOf !== null,
    },
    "yael:tax-readiness — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.obligations.total} Yael obligations (${snap.obligations.inForce} in force) · ${snap.cycles.length} tax cycles · ${snap.events.taxReturnsDraftedLast7d} drafts last 7d · Camille anchor ${snap.camille.snapshotAsOf ? "present" : "absent"}.`,
    ok: true,
  };
};

export default handler;
