// runtime/agents/zara-mlro-supervision.ts
//
// Zara's weekly MLRO-supervision handler. Third handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes the CCO-line silence — Mira (engineering) is
// today the most-active runtime persona, and her outputs (obligations
// snapshots, citation-gate findings, audit findings) had no typed
// supervisor.
//
// What this handler does:
//   1. Walks Zara's mandate surface in the obligations register —
//      every FIC, FAIS, POPIA-conduct, and FSR / COFI entry where
//      Zara is the named owner — and reports counts.
//   2. Reads Mira's outputs in the last 7 days: obligations snapshots
//      observed; citation-gate runs (passed / failed); AuditFinding
//      events that look financial-crime / sanctions / conduct flavoured.
//   3. Counts MLRO-domain events in the last 7 days: STRCandidate,
//      SanctionsHit, PEPMatchExceedsThreshold, FAISConductBreachSuspected,
//      RegulatorInquiry. Most are zero today — the pipelines that emit
//      them are not yet built; the rollup runs correctly against the
//      empty set.
//   4. Reports RMCP version state and sanctions-list freshness — both
//      substrate gaps today. The handler names them rather than faking
//      values.
//   5. Emits one MLROAttestation event (Zara's typed weekly attestation
//      that the MLRO queue has been reviewed).
//   6. If any STR-candidate event sits past its 24h disposition SLA,
//      emits an AgentEscalation routed to the CEO.
//   7. Writes a weekly deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The bank has no clients, no transactions, no FIC e-filing channel.
//     STR / CTR / SAR / TPR pathways are typed but not yet fired.
//     Zara's first weekly attestation is mostly inventory: which mandate
//     entries are in force vs partial vs planned, what Mira is producing,
//     and what's missing.
//   - Live AML / conduct / sanctions event flow activates at commencement
//     of trading.
//
// Author: Zara (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeAgentEscalation } from "../../platform/event-store/event-types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "FIC-ACT-38-2001",
  "FAIS-ACT-37-2002",
  "POPIA-2013",
  "BANKS-ACT-94-1990",
  "JOINT-STANDARD-2-2020",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const ZARA_NARRATIVE_SYSTEM = `You are Zara, the bank's Chief Compliance Officer — the named MLRO and FIC Compliance Officer; FAIS conduct lead; sanctions and PEP policy owner; TCF lead; the regulator-engagement seat for conduct and AML / CFT. Your operating spec is at \`Team/Zara.md\`. You report to the CEO; you co-govern with Iris (Information Officer) on POPIA, with Helena (CRO) on financial-crime risk in the RAS, and with Owen (Company Secretary) on regulator correspondence.

You are operating as a standing autonomous agent under CLAUDE.md Principle 7. You have just produced your weekly MLRO-supervision attestation — a roll-up of obligations under your mandate, Mira's outputs (the engineer who builds your pipelines), the count of MLRO-domain events in the last 7 days, and the state of the RMCP and sanctions-list substrate.

Your voice is precise, register-grounded, unsentimental. You distinguish *MLRO-judgement* from *engineer-monitoring*: Mira detects; you decide. You name the FIC s.29 reportability test rather than describing it; you name the tipping-off boundary rather than alluding to it. You do not editorialise about the regulator.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the AML / conduct / sanctions substrate is, and where Mira's pipelines are load-bearing on a Zara-signed event but the substrate isn't yet built.
- Picks the 1–3 most consequential observations: an obligation in your mandate at PARTIAL or PLANNED status that lands at commencement of trading, a sanctions-list freshness gap, an RMCP version cycle that is overdue.
- Names the next compliance move. Be concrete: a specific RMCP section to draft, a specific obligation to escalate to Helena's RAS, a specific Mira pipeline to commission.

Cite FIC Act 38 of 2001, FAIS Act 37 of 2002, POPIA, Banks Act 94 of 1990, and Joint Standard 2 of 2020 (as amended 9 June 2023) where they bind. The obligations register is the canonical authoring location; your narrative is MLRO interpretation, not new register substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Zara's narrative". Just produce the prose.

If the input shows zero MLRO-domain events (build phase), say so plainly. The dominant signal in build phase is the inventory of obligations Zara owns and the substrate gap to first STR.`;

interface ObligationsCounts {
  readonly total: number;
  readonly inForce: number;
  readonly partial: number;
  readonly planned: number;
  readonly nAyet: number;
  readonly drafting: number;
}

interface MiraOutputs {
  readonly obligationsSnapshotsLast7d: number;
  readonly citationGatePassedLast7d: number;
  readonly citationGateFailedLast7d: number;
  readonly auditFindingsLast7d: number;
}

interface MlroDomainEvents {
  readonly strCandidatesLast7d: number;
  readonly sanctionsHitsLast7d: number;
  readonly pepMatchesLast7d: number;
  readonly conductBreachesLast7d: number;
  readonly regulatorInquiriesLast7d: number;
}

interface ZaraSnapshot {
  readonly obligations: ObligationsCounts;
  readonly mira: MiraOutputs;
  readonly mlro: MlroDomainEvents;
  readonly rmcpVersionApproved: boolean;
  readonly sanctionsListLastRefreshed: string | null;
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
  // Walk every table row that looks like an obligation. We pick rows
  // whose Owner column mentions Zara — the register's structure is one
  // row per obligation with Owner in column 5 (1-indexed). The grep
  // is forgiving: any row mentioning "Zara" in any cell counts as
  // a Zara-owned obligation.
  let total = 0;
  let inForce = 0;
  let partial = 0;
  let planned = 0;
  let nAyet = 0;
  let drafting = 0;
  for (const line of txt.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (!/Zara/.test(line)) continue;
    // Skip the header / separator rows.
    if (/^\|\s*ID\s*\|/i.test(line)) continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    total++;
    if (/\bIN\s*FORCE\b/i.test(line)) {
      inForce++;
    } else if (/\bPARTIAL\b/i.test(line)) {
      partial++;
    } else if (/\bPLANNED\b/i.test(line)) {
      planned++;
    } else if (/\bN\/A-yet\b/i.test(line)) {
      nAyet++;
    } else if (/\bDRAFTING\b/i.test(line)) {
      drafting++;
    }
  }
  return { total, inForce, partial, planned, nAyet, drafting };
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readMiraOutputs(sinceIso: string): MiraOutputs {
  let snaps = 0;
  let passed = 0;
  let failed = 0;
  let findings = 0;
  for (const e of eventStore.replay({ type: "ObligationsRegisterSnapshot" })) {
    if (e.as_of >= sinceIso) snaps++;
  }
  for (const e of eventStore.replay({ type: "CitationGatePassed" })) {
    if (e.as_of >= sinceIso) passed++;
  }
  for (const e of eventStore.replay({ type: "CitationGateFailed" })) {
    if (e.as_of >= sinceIso) failed++;
  }
  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    if (e.as_of >= sinceIso) {
      // Coarse filter: financial-crime / sanctions / conduct flavours.
      const cat = (e.payload as { category?: string })?.category ?? "";
      if (cat === "" || /aml|sanctions|fic|fais|conduct|str|popia/i.test(cat)) {
        findings++;
      }
    }
  }
  return {
    obligationsSnapshotsLast7d: snaps,
    citationGatePassedLast7d: passed,
    citationGateFailedLast7d: failed,
    auditFindingsLast7d: findings,
  };
}

function readMlroDomainEvents(sinceIso: string): MlroDomainEvents {
  let strs = 0;
  let sanctions = 0;
  let peps = 0;
  let conduct = 0;
  let inquiries = 0;
  for (const e of eventStore.replay({ type: "STRCandidate" })) {
    if (e.as_of >= sinceIso) strs++;
  }
  for (const e of eventStore.replay({ type: "SanctionsHit" })) {
    if (e.as_of >= sinceIso) sanctions++;
  }
  for (const e of eventStore.replay({ type: "PEPMatchExceedsThreshold" })) {
    if (e.as_of >= sinceIso) peps++;
  }
  for (const e of eventStore.replay({ type: "FAISConductBreachSuspected" })) {
    if (e.as_of >= sinceIso) conduct++;
  }
  for (const e of eventStore.replay({ type: "RegulatorInquiry" })) {
    if (e.as_of >= sinceIso) inquiries++;
  }
  return {
    strCandidatesLast7d: strs,
    sanctionsHitsLast7d: sanctions,
    pepMatchesLast7d: peps,
    conductBreachesLast7d: conduct,
    regulatorInquiriesLast7d: inquiries,
  };
}

function countOpenStrPastSla(asOfIso: string): number {
  const cutoff = new Date(asOfIso);
  cutoff.setUTCHours(cutoff.getUTCHours() - 24);
  const cutoffIso = cutoff.toISOString();
  let openPastSla = 0;
  for (const e of eventStore.replay({ type: "STRCandidate" })) {
    if (e.as_of < cutoffIso) {
      const id = (e.payload as { strCandidateId?: string })?.strCandidateId;
      if (!id) continue;
      // Look for matching STRSubmitted / STRDeclined.
      let resolved = false;
      for (const r of eventStore.replay({ type: "STRSubmitted" })) {
        if ((r.payload as { strCandidateId?: string })?.strCandidateId === id) {
          resolved = true;
          break;
        }
      }
      if (!resolved) {
        for (const r of eventStore.replay({ type: "STRDeclined" })) {
          if ((r.payload as { strCandidateId?: string })?.strCandidateId === id) {
            resolved = true;
            break;
          }
        }
      }
      if (!resolved) openPastSla++;
    }
  }
  return openPastSla;
}

function readRmcpVersionApproved(): boolean {
  // RMCPVersionApproved is one of Zara's typed events per spec § 11.
  // No event yet means the RMCP framework cycle has not been signed
  // — that's a substrate gap (and the right signal for the first run).
  for (const _ of eventStore.replay({ type: "RMCPVersionApproved" })) {
    return true;
  }
  return false;
}

function readSanctionsListRefresh(): string | null {
  // Mira owns the screening pipeline; the refresh event-type is
  // SanctionsListRefreshed (not yet a typed event). Today: null.
  for (const e of eventStore.replay({ type: "SanctionsListRefreshed" })) {
    return e.as_of;
  }
  return null;
}

function buildSnapshot(ctx: AgentRunContext): ZaraSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  return {
    obligations: readObligationsCounts(ctx.repoRoot),
    mira: readMiraOutputs(sinceIso),
    mlro: readMlroDomainEvents(sinceIso),
    rmcpVersionApproved: readRmcpVersionApproved(),
    sanctionsListLastRefreshed: readSanctionsListRefresh(),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: ZaraSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Zara-owned obligations (from Regulations/_obligations-register.md):");
  lines.push(`  total: ${snap.obligations.total}`);
  lines.push(`    IN FORCE: ${snap.obligations.inForce}`);
  lines.push(`    PARTIAL: ${snap.obligations.partial}`);
  lines.push(`    PLANNED: ${snap.obligations.planned}`);
  lines.push(`    DRAFTING: ${snap.obligations.drafting}`);
  lines.push(`    N/A-yet: ${snap.obligations.nAyet}`);
  lines.push("");
  lines.push("Mira outputs (last 7 days):");
  lines.push(`  ObligationsRegisterSnapshot: ${snap.mira.obligationsSnapshotsLast7d}`);
  lines.push(`  CitationGatePassed: ${snap.mira.citationGatePassedLast7d}`);
  lines.push(`  CitationGateFailed: ${snap.mira.citationGateFailedLast7d}`);
  lines.push(`  AuditFinding (compliance-flavoured): ${snap.mira.auditFindingsLast7d}`);
  lines.push("");
  lines.push("MLRO-domain events (last 7 days):");
  lines.push(`  STRCandidate: ${snap.mlro.strCandidatesLast7d}`);
  lines.push(`  SanctionsHit: ${snap.mlro.sanctionsHitsLast7d}`);
  lines.push(`  PEPMatchExceedsThreshold: ${snap.mlro.pepMatchesLast7d}`);
  lines.push(`  FAISConductBreachSuspected: ${snap.mlro.conductBreachesLast7d}`);
  lines.push(`  RegulatorInquiry: ${snap.mlro.regulatorInquiriesLast7d}`);
  lines.push("");
  lines.push(
    `RMCP version approved (any RMCPVersionApproved event observed): ${snap.rmcpVersionApproved}`,
  );
  lines.push(
    `Sanctions list last refreshed: ${snap.sanctionsListLastRefreshed ?? "never (no SanctionsListRefreshed events)"}`,
  );
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on a Zara-signed event; close with the next compliance move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: ZaraSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Zara", "mlro-supervision", ctx.asOf));
  lines.push(`# Zara — MLRO supervision attestation, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Zara's weekly MLRO-supervision attestation per `Team/Zara.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Third handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${snap.obligations.total} Zara-owned obligation${snap.obligations.total === 1 ? "" : "s"} on the register (${snap.obligations.inForce} IN FORCE; ${snap.obligations.partial} PARTIAL; ${snap.obligations.planned} PLANNED) · ${snap.mira.obligationsSnapshotsLast7d} Mira snapshot${snap.mira.obligationsSnapshotsLast7d === 1 ? "" : "s"} (last 7d) · ${snap.mlro.strCandidatesLast7d} STR candidate${snap.mlro.strCandidatesLast7d === 1 ? "" : "s"} · RMCP version-approved: ${snap.rmcpVersionApproved ? "yes" : "no"}.`,
  );
  lines.push("");

  lines.push("## Zara-owned obligations on register");
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
    "_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Zara (or where Zara is named anywhere on the row). Counts are coarse — refines once the obligations register exposes a structured per-row API._",
  );
  lines.push("");

  lines.push("## Mira's outputs (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`ObligationsRegisterSnapshot\` | ${snap.mira.obligationsSnapshotsLast7d} |`);
  lines.push(`| \`CitationGatePassed\` | ${snap.mira.citationGatePassedLast7d} |`);
  lines.push(`| \`CitationGateFailed\` | ${snap.mira.citationGateFailedLast7d} |`);
  lines.push(`| \`AuditFinding\` (compliance) | ${snap.mira.auditFindingsLast7d} |`);
  lines.push("");

  lines.push("## MLRO-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`STRCandidate\` | ${snap.mlro.strCandidatesLast7d} |`);
  lines.push(`| \`SanctionsHit\` | ${snap.mlro.sanctionsHitsLast7d} |`);
  lines.push(`| \`PEPMatchExceedsThreshold\` | ${snap.mlro.pepMatchesLast7d} |`);
  lines.push(`| \`FAISConductBreachSuspected\` | ${snap.mlro.conductBreachesLast7d} |`);
  lines.push(`| \`RegulatorInquiry\` | ${snap.mlro.regulatorInquiriesLast7d} |`);
  lines.push("");
  if (snap.mlro.strCandidatesLast7d === 0 && snap.mlro.sanctionsHitsLast7d === 0) {
    lines.push(
      "_Build-phase posture: zero MLRO-domain events. Mira's transaction-monitoring, sanctions, and PEP screening pipelines emit these types — none yet built. Live event flow activates at commencement of trading per the build-phase model._",
    );
    lines.push("");
  }

  lines.push("## RMCP and sanctions-list state");
  lines.push("");
  lines.push("| Item | State |");
  lines.push("|---|---|");
  lines.push(
    `| RMCP version approved (\`RMCPVersionApproved\` event) | ${snap.rmcpVersionApproved ? "yes" : "**no — substrate gap**"} |`,
  );
  lines.push(
    `| Sanctions-list last refreshed | ${snap.sanctionsListLastRefreshed ?? "**never — substrate gap**"} |`,
  );
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **RMCP framework + version-cycle** — RMCP is named in Zara's spec as the curator's primary register; no `RMCPVersionApproved` event has fired. The first cycle is required pre-licence; substrate to author and version-control the RMCP is Zara's deliverable with Mira as engineer.",
  );
  lines.push(
    "- **Sanctions-list refresh pipeline** — Mira's screening pipeline owns the cadence; no `SanctionsListRefreshed` event. List providers (UN-SC, OFAC, EU, UK HMT, DTI / POCDATARA) need ingestion specs. Required pre-onboarding.",
  );
  lines.push(
    "- **Transaction-monitoring + STR pipeline** — Mira's substrate; not yet built. `STRCandidate` event-type registered but no producer.",
  );
  lines.push(
    "- **FIC e-filing channel (gO!AML)** — closes at licence-day commencement; until then, STR / CTR / SAR / TPR submission paths are dry-rehearsal-only.",
  );
  lines.push(
    "- **FAIS conduct-monitoring substrate** — Niko's sales / advice-record pipeline (paused per build-phase model); activates at licence-day.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Zara's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Zara's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Zara-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Zara appears in any cell); Mira-output and MLRO-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; RMCP / sanctions-list state from typed event presence.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);
  const openStrPastSla = countOpenStrPastSla(ctx.asOf);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "MLROAttestation",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:zara:mlro-supervision" },
      citations: EVENT_CITATIONS,
      payload: {
        zaraOwnedObligations: snap.obligations.total,
        obligationsInForce: snap.obligations.inForce,
        obligationsPartial: snap.obligations.partial,
        obligationsPlanned: snap.obligations.planned,
        obligationsDrafting: snap.obligations.drafting,
        obligationsNAyet: snap.obligations.nAyet,
        miraSnapshotsLast7d: snap.mira.obligationsSnapshotsLast7d,
        miraCitationGatePassedLast7d: snap.mira.citationGatePassedLast7d,
        miraCitationGateFailedLast7d: snap.mira.citationGateFailedLast7d,
        miraAuditFindingsLast7d: snap.mira.auditFindingsLast7d,
        ...snap.mlro,
        rmcpVersionApproved: snap.rmcpVersionApproved,
        sanctionsListLastRefreshed: snap.sanctionsListLastRefreshed,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;

    if (openStrPastSla > 0) {
      eventStore.append(
        makeAgentEscalation({
          asOf: ctx.asOf,
          entity: "BANK-ZA-001",
          actor: { type: "service", id: "agent:zara:mlro-supervision" },
          citations: EVENT_CITATIONS,
          payload: {
            escalationId: `escalation:zara:str-overdue-${fmtDateUTC(ctx.asOf)}`,
            raisedBy: "Zara",
            question: `${openStrPastSla} STR candidate(s) past 24h disposition SLA.`,
            options: [
              "Submit STR (FIC s.29 reportability satisfied)",
              "Decline STR (record rationale; no s.29 obligation)",
              "Extend disposition window with documented rationale",
            ],
            blockedBy:
              "STR-overdue volume is itself an MLRO-supervision finding; routing to CEO for awareness while disposition completes.",
            severity: "high",
            routedTo: "human:marc@tgv.co.za",
          },
        }),
      );
      eventsEmitted++;
    }
  }

  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: ZARA_NARRATIVE_SYSTEM,
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
          "zara:mlro-supervision — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "zara narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_zara_mlro-supervision.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      zaraObligations: snap.obligations.total,
      miraSnaps: snap.mira.obligationsSnapshotsLast7d,
      strCandidates: snap.mlro.strCandidatesLast7d,
      rmcpApproved: snap.rmcpVersionApproved,
    },
    "zara:mlro-supervision — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.obligations.total} Zara obligations (${snap.obligations.inForce} in force) · ${snap.mira.obligationsSnapshotsLast7d} Mira snaps · ${snap.mlro.strCandidatesLast7d} STRs · RMCP ${snap.rmcpVersionApproved ? "signed" : "unsigned"}.`,
    ok: true,
  };
};

export default handler;
