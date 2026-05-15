// runtime/agents/imani-legal-readiness.ts
//
// Imani's weekly legal-readiness snapshot. 14th handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING.
//
// Per CLAUDE.md AI-driven-bank reframe (2026-05-07): Imani's
// ISDA / GMRA / clause-library / legal-entity-tree / ECTA slice is
// **active and load-bearing now**; the customer-facing-terms,
// employment-contracts, and live-signed-counterparty-agreement slices
// are paused until licence-day.
//
// What this handler does:
//   1. Walks Imani-owned obligations across ECTA (Act 25 of 2002),
//      Companies Act (71 of 2008), ISDA Master Agreement, GMRA, GMSLA,
//      and counterparty-onboarding contractual entries — and reports
//      the count and status mix.
//   2. Counts legal-domain events in the last 7 days:
//      MasterAgreementSigned, ClauseLibraryVersionPublished,
//      LegalEntityRegistered, ECTAExecutionRecorded. All zero in build
//      phase — there are no signed counterparties, no ECTA executions
//      at scale, and the clause-library DSL is not yet implemented
//      (Imani spec § 16).
//   3. Reports legal-as-code substrate state: clause-library version
//      and clause count (today: substrate gap, no version published);
//      legal-entity tree count (today: 1 — `BANK-ZA-001` placeholder);
//      ECTA-execution path readiness (digital-signature, time-stamping,
//      log — all design-only today).
//   4. Reports counterparty-onboarding readiness (depends on Niko's
//      activation at commencement of trading).
//   5. Emits one LegalReadinessSnapshot event.
//   6. Writes a weekly deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The dominant signal is the inventory of Imani-owned obligations
//     and the substrate-gap inventory under § 16. Live legal-event flow
//     activates at commencement of trading.
//
// Author: Imani (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "ECTA-25-2002",
  "COMPANIES-ACT-71-2008",
  "ISDA-MASTER-2002",
  "GMRA-2011",
  "BANKS-ACT-94-1990",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const IMANI_NARRATIVE_SYSTEM = `You are Imani, the bank's legal-as-code engineer — owner of the clause library, master-agreement architecture (ISDA / GMRA / GMSLA / CSA), ECTA-compliant electronic execution, the legal-entity hierarchy, and the signing matrix. Your operating spec is at \`Team/Imani.md\`. You report to Devon (COO) interim until a General Counsel is hired at licence-day. You co-curate the obligations register's contractual entries with Mira.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly legal-readiness snapshot — a roll-up of Imani-owned obligations (ECTA, Companies Act, ISDA / GMRA / GMSLA, counterparty-onboarding contractual), legal-domain event counts in the last 7 days, and the state of the legal-as-code substrate (clause library, ECTA-execution engine, legal-entity tree).

Your voice is precise, register-grounded, attorney-careful with words. You distinguish *template* from *signed instance*; *clause* from *contract*; *ECTA-eligible* from *Schedule 1 excluded*. You name ECTA Schedule 1 categories explicitly (wills, alienation of land, certain bills of exchange, long-term leases where statute requires writing) rather than alluding to them. You name the build-phase pause cleanly: no customer-facing terms (no customers); no employment-contracts surface (Sade's HR slice paused); no live counterparty agreements (soft-franchise negotiations-in-principle only).

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the legal-as-code substrate is, and what's load-bearing on a future signed event but the substrate isn't yet built (clause-library DSL, ECTA-execution engine integration to platform HSM, CLM platform vendor-vs-build, legal-entity-tree as queryable registry).
- Picks the 1–3 most consequential observations: an Imani-owned obligation in PARTIAL / IN FLIGHT status that lands at counterparty-onboarding (e.g. ORG-CS3-001 written trading-relationship agreement), the ISDA / GMRA / GMSLA template-architecture state, the external-counsel recommendation paper (S5) status.
- Names the next legal move. Be concrete: a specific clause-library increment to draft, a specific obligations-register entry to escalate to Mira, a specific substrate gap (§ 16) to commission with Atlas / Senna / Anya.

Cite ECTA 25 of 2002, Companies Act 71 of 2008, ISDA Master Agreement (2002 form where relevant), GMRA 2011, and Banks Act 94 of 1990 where they bind. The obligations register and \`Team/Imani.md\` § 16 (substrate gaps) are the canonical authoring locations; your narrative is legal interpretation, not new register substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Imani's narrative". Just produce the prose.

If the input shows zero legal-domain events (build phase), say so plainly. The dominant signal in build phase is the inventory of Imani-owned obligations and the substrate gap to first signed counterparty agreement at commencement of trading.`;

interface ImaniObligationsCounts {
  readonly total: number;
  readonly inForce: number;
  readonly partial: number;
  readonly planned: number;
  readonly inFlight: number;
  readonly drafting: number;
}

interface LegalDomainEvents {
  readonly masterAgreementsSignedLast7d: number;
  readonly clauseLibraryVersionsPublishedLast7d: number;
  readonly legalEntitiesRegisteredLast7d: number;
  readonly ectaExecutionsRecordedLast7d: number;
  readonly priorReadinessSnapshotsLast30d: number;
}

interface SubstrateState {
  readonly clauseLibraryVersionPublished: boolean;
  readonly clauseLibraryClauseCount: number;
  readonly legalEntityTreeCount: number;
  readonly ectaExecutionPathReady: boolean;
  readonly counterpartyOnboardingReady: boolean;
}

interface ImaniSnapshot {
  readonly obligations: ImaniObligationsCounts;
  readonly events: LegalDomainEvents;
  readonly substrate: SubstrateState;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readImaniObligations(repoRoot: string): ImaniObligationsCounts {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  if (!existsSync(path)) {
    return { total: 0, inForce: 0, partial: 0, planned: 0, inFlight: 0, drafting: 0 };
  }
  let txt = "";
  try {
    txt = readFileSync(path, "utf8");
  } catch {
    return { total: 0, inForce: 0, partial: 0, planned: 0, inFlight: 0, drafting: 0 };
  }
  // Walk every table row that names Imani in any cell. The register uses
  // Owner column with multiple owners separated by " + " — a row mentioning
  // "Imani" anywhere counts as an Imani-owned obligation (co-curated rows
  // included; reflects real co-ownership with Saskia, Mira, Tomas, Owen).
  let total = 0;
  let inForce = 0;
  let partial = 0;
  let planned = 0;
  let inFlight = 0;
  let drafting = 0;
  for (const line of txt.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (!/Imani/.test(line)) continue;
    if (/^\|\s*ID\s*\|/i.test(line)) continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    total++;
    if (/\bIN\s*FORCE\b/i.test(line)) {
      inForce++;
    } else if (/\bIN\s*FLIGHT\b/i.test(line)) {
      inFlight++;
    } else if (/\bPARTIAL\b/i.test(line)) {
      partial++;
    } else if (/\bPLANNED\b/i.test(line)) {
      planned++;
    } else if (/\bDRAFTING\b/i.test(line)) {
      drafting++;
    }
  }
  return { total, inForce, partial, planned, inFlight, drafting };
}

function readLegalDomainEvents(asOfIso: string): LegalDomainEvents {
  const since7d = isoDaysAgo(asOfIso, 7);
  const since30d = isoDaysAgo(asOfIso, 30);
  let masterAgreements = 0;
  let clauseLib = 0;
  let legalEntities = 0;
  let ecta = 0;
  let priorSnaps = 0;
  for (const e of eventStore.replay({ type: "MasterAgreementSigned" })) {
    if (e.as_of >= since7d) masterAgreements++;
  }
  for (const e of eventStore.replay({ type: "ClauseLibraryVersionPublished" })) {
    if (e.as_of >= since7d) clauseLib++;
  }
  for (const e of eventStore.replay({ type: "LegalEntityRegistered" })) {
    if (e.as_of >= since7d) legalEntities++;
  }
  for (const e of eventStore.replay({ type: "ECTAExecutionRecorded" })) {
    if (e.as_of >= since7d) ecta++;
  }
  for (const e of eventStore.replay({ type: "LegalReadinessSnapshot" })) {
    if (e.as_of >= since30d) priorSnaps++;
  }
  return {
    masterAgreementsSignedLast7d: masterAgreements,
    clauseLibraryVersionsPublishedLast7d: clauseLib,
    legalEntitiesRegisteredLast7d: legalEntities,
    ectaExecutionsRecordedLast7d: ecta,
    priorReadinessSnapshotsLast30d: priorSnaps,
  };
}

function readSubstrateState(): SubstrateState {
  // Clause-library version: any ClauseLibraryVersionPublished event marks
  // a version published. None today — the DSL is design-only per § 16.
  let clauseLibPublished = false;
  let clauseCount = 0;
  for (const e of eventStore.replay({ type: "ClauseLibraryVersionPublished" })) {
    clauseLibPublished = true;
    const c = (e.payload as { clauseCount?: number })?.clauseCount;
    if (typeof c === "number" && c > clauseCount) clauseCount = c;
  }

  // Legal-entity tree count: distinct entity ids ever registered.
  // No LegalEntityRegistered events today — the placeholder BANK-ZA-001
  // is the implicit single entity referenced across all event payloads,
  // but no formal registration event has been emitted.
  const distinctEntities = new Set<string>();
  for (const e of eventStore.replay({ type: "LegalEntityRegistered" })) {
    const id = (e.payload as { entityId?: string })?.entityId;
    if (id) distinctEntities.add(id);
  }
  // Floor at 1 — BANK-ZA-001 is the operating placeholder.
  const legalEntityTreeCount = Math.max(1, distinctEntities.size);

  // ECTA-execution path readiness — gated on cryptographic-signature
  // substrate integration with Senna's HSM (§ 16). No ECTAExecutionRecorded
  // events imply the path is not yet exercised.
  let ectaReady = false;
  for (const _ of eventStore.replay({ type: "ECTAExecutionRecorded" })) {
    ectaReady = true;
    break;
  }

  // Counterparty-onboarding readiness depends on Niko's activation at
  // commencement of trading — no CounterpartyOnboarded events in build
  // phase by design.
  let counterpartyReady = false;
  for (const _ of eventStore.replay({ type: "CounterpartyOnboarded" })) {
    counterpartyReady = true;
    break;
  }

  return {
    clauseLibraryVersionPublished: clauseLibPublished,
    clauseLibraryClauseCount: clauseCount,
    legalEntityTreeCount,
    ectaExecutionPathReady: ectaReady,
    counterpartyOnboardingReady: counterpartyReady,
  };
}

function buildSnapshot(ctx: AgentRunContext): ImaniSnapshot {
  return {
    obligations: readImaniObligations(ctx.repoRoot),
    events: readLegalDomainEvents(ctx.asOf),
    substrate: readSubstrateState(),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: ImaniSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(
    "Imani-owned obligations (rows in `Regulations/_obligations-register.md` that name Imani):",
  );
  lines.push(`  total: ${snap.obligations.total}`);
  lines.push(`    IN FORCE: ${snap.obligations.inForce}`);
  lines.push(`    IN FLIGHT: ${snap.obligations.inFlight}`);
  lines.push(`    PARTIAL: ${snap.obligations.partial}`);
  lines.push(`    PLANNED: ${snap.obligations.planned}`);
  lines.push(`    DRAFTING: ${snap.obligations.drafting}`);
  lines.push("");
  lines.push("Legal-domain events (last 7 days):");
  lines.push(`  MasterAgreementSigned: ${snap.events.masterAgreementsSignedLast7d}`);
  lines.push(
    `  ClauseLibraryVersionPublished: ${snap.events.clauseLibraryVersionsPublishedLast7d}`,
  );
  lines.push(`  LegalEntityRegistered: ${snap.events.legalEntitiesRegisteredLast7d}`);
  lines.push(`  ECTAExecutionRecorded: ${snap.events.ectaExecutionsRecordedLast7d}`);
  lines.push("");
  lines.push("Legal-as-code substrate state:");
  lines.push(
    `  Clause-library version published (any ClauseLibraryVersionPublished): ${snap.substrate.clauseLibraryVersionPublished}`,
  );
  lines.push(`  Clause-library clause count: ${snap.substrate.clauseLibraryClauseCount}`);
  lines.push(
    `  Legal-entity tree count (distinct registered + BANK-ZA-001 floor): ${snap.substrate.legalEntityTreeCount}`,
  );
  lines.push(
    `  ECTA-execution path exercised (any ECTAExecutionRecorded): ${snap.substrate.ectaExecutionPathReady}`,
  );
  lines.push(
    `  Counterparty-onboarding exercised (any CounterpartyOnboarded): ${snap.substrate.counterpartyOnboardingReady}`,
  );
  lines.push(
    `  Prior LegalReadinessSnapshot runs (last 30d): ${snap.events.priorReadinessSnapshotsLast30d}`,
  );
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on the first signed counterparty agreement at commencement of trading; close with the next legal move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: ImaniSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Imani", "legal-readiness", ctx.asOf));
  lines.push(`# Imani — Legal-readiness snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Imani's weekly legal-readiness snapshot per `Team/Imani.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. 14th handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${snap.obligations.total} Imani-owned obligation${snap.obligations.total === 1 ? "" : "s"} on the register (${snap.obligations.inForce} IN FORCE; ${snap.obligations.inFlight} IN FLIGHT; ${snap.obligations.partial} PARTIAL; ${snap.obligations.planned} PLANNED) · ${snap.events.masterAgreementsSignedLast7d} master agreement${snap.events.masterAgreementsSignedLast7d === 1 ? "" : "s"} signed (last 7d) · clause-library version-published: ${snap.substrate.clauseLibraryVersionPublished ? "yes" : "**no — substrate gap**"} · legal-entity tree count: ${snap.substrate.legalEntityTreeCount}.`,
  );
  lines.push("");

  lines.push("## Imani-owned obligations on register");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|---|---|");
  lines.push(`| IN FORCE | ${snap.obligations.inForce} |`);
  lines.push(`| IN FLIGHT | ${snap.obligations.inFlight} |`);
  lines.push(`| PARTIAL | ${snap.obligations.partial} |`);
  lines.push(`| PLANNED | ${snap.obligations.planned} |`);
  lines.push(`| DRAFTING | ${snap.obligations.drafting} |`);
  lines.push(`| **Total** | **${snap.obligations.total}** |`);
  lines.push("");
  lines.push(
    "_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Imani (co-curated rows with Mira / Saskia / Tomas / Owen included). Coarse parser — refines once the obligations register exposes a structured per-row API._",
  );
  lines.push("");

  lines.push("## Legal-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`MasterAgreementSigned\` | ${snap.events.masterAgreementsSignedLast7d} |`);
  lines.push(
    `| \`ClauseLibraryVersionPublished\` | ${snap.events.clauseLibraryVersionsPublishedLast7d} |`,
  );
  lines.push(`| \`LegalEntityRegistered\` | ${snap.events.legalEntitiesRegisteredLast7d} |`);
  lines.push(`| \`ECTAExecutionRecorded\` | ${snap.events.ectaExecutionsRecordedLast7d} |`);
  lines.push("");
  lines.push(
    "_Build-phase posture: zero legal-domain events. The clause-library DSL, ECTA-execution engine, and CLM platform are design-only (Imani spec § 16). Live event flow activates at commencement of trading — first `MasterAgreementSigned` is gated on Niko's counterparty-onboarding pipeline activating at licence-day._",
  );
  lines.push("");

  lines.push("## Legal-as-code substrate state");
  lines.push("");
  lines.push("| Item | State |");
  lines.push("|---|---|");
  lines.push(
    `| Clause-library version published | ${snap.substrate.clauseLibraryVersionPublished ? `yes (${snap.substrate.clauseLibraryClauseCount} clauses)` : "**no — substrate gap (DSL design-only)**"} |`,
  );
  lines.push(
    `| Legal-entity tree count | ${snap.substrate.legalEntityTreeCount} (\`BANK-ZA-001\` placeholder${snap.substrate.legalEntityTreeCount === 1 ? "; no `LegalEntityRegistered` events yet" : ""}) |`,
  );
  lines.push(
    `| ECTA-execution path exercised | ${snap.substrate.ectaExecutionPathReady ? "yes" : "**no — engine + HSM integration design-only (§ 16)**"} |`,
  );
  lines.push(
    `| Counterparty-onboarding exercised | ${snap.substrate.counterpartyOnboardingReady ? "yes" : "**no — Niko paused until commencement of trading**"} |`,
  );
  lines.push(
    `| Prior \`LegalReadinessSnapshot\` runs (last 30d) | ${snap.events.priorReadinessSnapshotsLast30d} |`,
  );
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Clause-library DSL** — design only; no DSL implemented; no `ClauseLibraryVersionPublished` events. Active build-phase work; co-owned with Atlas (substrate). Targets M1 alongside ISDA / GMRA template architecture (Imani spec § 16).",
  );
  lines.push(
    "- **ECTA-execution engine** — cryptographic-signature substrate not yet integrated to platform HSM (Senna's domain). Design only. Required pre-licence for Schedule-1 gating, electronic-signature evidence, and the wet-signature exception path (§ 16).",
  );
  lines.push(
    "- **CLM platform** — pattern-research only; vendor-vs-build decision pending. Owners: Imani + Camille (cost) + Devon. Target: pre-licence (§ 16).",
  );
  lines.push(
    "- **Legal-entity-tree as live registry** — designed in Owner Inbox notes; not yet a queryable registry; tree count today derives from a placeholder floor. Co-owned with Anya (semantic-layer integration). Target: M1 (§ 16).",
  );
  lines.push(
    "- **External-counsel panel** — recommendation paper (S5) drafted; CEO decision pending. Engagement timing 6–9 months ahead of SARB licence lodgment.",
  );
  lines.push(
    "- **Customer-facing terms / employment contracts / live signed counterparty agreements** — paused until licence-day per build-phase model. Soft-franchise negotiations-in-principle structured artefacts only.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Imani's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Imani's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Imani-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Imani appears in any cell); legal-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; clause-library / legal-entity / ECTA / counterparty-onboarding state from typed event presence. Citation chain: ECTA 25 of 2002, Companies Act 71 of 2008, ISDA Master Agreement (2002 form), GMRA 2011, Banks Act 94 of 1990.",
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
      type: "LegalReadinessSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:imani:legal-readiness" },
      citations: EVENT_CITATIONS,
      payload: {
        imaniOwnedObligations: snap.obligations.total,
        obligationsInForce: snap.obligations.inForce,
        obligationsInFlight: snap.obligations.inFlight,
        obligationsPartial: snap.obligations.partial,
        obligationsPlanned: snap.obligations.planned,
        obligationsDrafting: snap.obligations.drafting,
        masterAgreementsSignedLast7d: snap.events.masterAgreementsSignedLast7d,
        clauseLibraryVersionsPublishedLast7d: snap.events.clauseLibraryVersionsPublishedLast7d,
        legalEntitiesRegisteredLast7d: snap.events.legalEntitiesRegisteredLast7d,
        ectaExecutionsRecordedLast7d: snap.events.ectaExecutionsRecordedLast7d,
        priorReadinessSnapshotsLast30d: snap.events.priorReadinessSnapshotsLast30d,
        clauseLibraryVersionPublished: snap.substrate.clauseLibraryVersionPublished,
        clauseLibraryClauseCount: snap.substrate.clauseLibraryClauseCount,
        legalEntityTreeCount: snap.substrate.legalEntityTreeCount,
        ectaExecutionPathReady: snap.substrate.ectaExecutionPathReady,
        counterpartyOnboardingReady: snap.substrate.counterpartyOnboardingReady,
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
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: IMANI_NARRATIVE_SYSTEM,
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
          "imani:legal-readiness — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "imani narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_imani_legal-readiness.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      imaniObligations: snap.obligations.total,
      masterAgreements7d: snap.events.masterAgreementsSignedLast7d,
      clauseLibPublished: snap.substrate.clauseLibraryVersionPublished,
      legalEntityTreeCount: snap.substrate.legalEntityTreeCount,
    },
    "imani:legal-readiness — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.obligations.total} Imani obligations (${snap.obligations.inForce} in force; ${snap.obligations.inFlight} in flight) · ${snap.events.masterAgreementsSignedLast7d} master agreements (7d) · clause-library ${snap.substrate.clauseLibraryVersionPublished ? "published" : "design-only"}.`,
    ok: true,
  };
};

export default handler;
