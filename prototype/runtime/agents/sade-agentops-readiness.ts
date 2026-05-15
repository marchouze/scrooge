// runtime/agents/sade-agentops-readiness.ts
//
// Sade's weekly AgentOps-readiness snapshot. Handler #15 in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes the COO-line silence on Principle 6's operational
// counterparty — Atlas builds the agent-runtime substrate, Sade is the
// AgentOps engineer who registers / retires / capability-assigns against
// it. Until the human-HR slice activates at licence-day, Sade's run is
// dominated by the AgentOps view (per CLAUDE.md "Personas paused or
// reshaped during the build phase", 2026-05-07).
//
// What this handler does:
//   1. Replays `AgentRegistered` events from the event store (A1.1
//      registry — PR #2 / merged on main). Folds latest-wins-per-key on
//      `agentUrn`. Reports total registered agents and which are current.
//   2. Walks Sade-owned obligations register entries — Banks Act fit-and-
//      proper provisions (ORG-GV-11, ORG-HR-11, ORG-CS1-002), BCEA / EE /
//      B-BBEE rows (paused but registered), training & remuneration rows.
//   3. Counts AgentOps-domain events in last 7 days: `AgentRegistered`,
//      `AgentRetired` (no producer yet), `IdentityKeyRotated` (PR #3, not
//      yet on main), `PermissionPolicyPublished` (PR #3). Most are zero
//      today on this branch.
//   4. Reports AgentOps capability state — agent registry built (A1.1 in
//      PR #2 / main); identity issuer (PR #3, not yet on main); permission
//      policy (PR #3); AgentOps audit trail (TBD); fit-and-proper analogue
//      spec (TBD); agent retirement procedure (TBD).
//   5. Reports human-HR readiness (paused per build-phase model): payroll
//      engine, EMP201 / IRP5 substrate, EE / B-BBEE reporting — all
//      "paused; activates at licence-day".
//   6. Emits one `AgentOpsReadinessSnapshot` event.
//   7. Writes a weekly deliverable to Owner Inbox.
//
// Build-phase posture:
//   - There are no employees, no payroll, no BCEA leave entitlements,
//     no IRP5s, no EE / B-BBEE submissions. Sade's traditional HR mandate
//     is paused. The AgentOps slice IS active and load-bearing now —
//     it's foundational to Principle 6.
//   - Live human-HR event flow activates at licence-day when the thin
//     statutory-human layer is appointed.
//
// Author: Sade (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { makeAgentOpsReadinessSnapshot } from "../../platform/event-store/event-types-readiness-snapshots";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BCEA-75-1997",
  "EE-ACT-55-1998",
  "POPIA-2013",
  "BCBS-CG-2015",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const SADE_NARRATIVE_SYSTEM = `You are Sade, the bank's AgentOps engineer (build phase) and HR engineer (licence-day). Your operating spec is at \`Team/Sade.md\`. You report to Devon (COO) interim, until a CHRO is hired at licence-day. Atlas owns the agent-runtime substrate; you are the operational counterparty — you register, retire, and assign capabilities against the runtime Atlas builds. Vera audits your AgentOps decisions (Wave-4 #10 / #15) — that audit relationship is the structural protection on the most sensitive boundary in your spec (§ 15: you observe every agent including yourself).

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly AgentOps-readiness snapshot — agent-fleet roster from the event store, Sade-owned obligations register slice, AgentOps-domain event counts (last 7 days), and AgentOps capability state.

Your voice is warm, organised, quietly precise. You distinguish *registered* (an agent has emitted \`AgentRegistered\` and folds latest-wins on its URN) from *capability-assigned* (the runtime knows what it may call), from *fit-and-proper* (the agent's operating spec is coherent under Vera's pipeline). You speak about the AgentOps mandate without conflating it with the paused human-HR slice — the latter activates at licence-day; not now.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the AgentOps substrate is, what's load-bearing on a Sade-signed event but the substrate isn't yet built (agent retirement, fit-and-proper attestation, capability-assignment register).
- Picks the 1–3 most consequential observations: an obligation in your mandate that is paused-but-registered (BCEA, EE, B-BBEE — explain that this is by design under the build-phase model, not a finding), an AgentOps capability gap that gates a downstream procedure (e.g. no \`AgentRetired\` producer yet), the fact that the human-HR slice is correctly silent.
- Names the next AgentOps move. Be concrete: a specific procedure to author (e.g. \`agent-retirement.md\`), a specific event-type to wire up (e.g. \`AgentFitAndProperAttested\`), a specific Vera pipeline to commission (Wave-4 #10).

Cite Banks Act 94 of 1990 fit-and-proper provisions, BCEA 75 of 1997, EE Act 55 of 1998, POPIA, and BCBS Corporate Governance Principles 2015 where they bind. The obligations register and Atlas's runtime substrate spec are the canonical authoring locations; your narrative is AgentOps interpretation, not new register substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Sade's narrative". Just produce the prose.

If the input shows zero AgentOps-domain events beyond the registry baseline (build phase — most producers not yet built), say so plainly. The dominant signal in build phase is the fleet roster against the substrate-gap inventory.`;

interface ObligationsCounts {
  readonly total: number;
  readonly inForce: number;
  readonly partial: number;
  readonly planned: number;
  readonly nAyet: number;
  readonly drafting: number;
}

interface RegistryState {
  readonly registeredAgents: number;
  readonly latestRegistrationAsOf: string | null;
}

interface AgentOpsDomainEvents {
  readonly agentRegisteredLast7d: number;
  readonly agentRetiredLast7d: number;
  readonly identityKeyRotatedLast7d: number;
  readonly permissionPolicyPublishedLast7d: number;
}

interface SadeSnapshot {
  readonly obligations: ObligationsCounts;
  readonly registry: RegistryState;
  readonly agentops: AgentOpsDomainEvents;
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
  // Walk every table row that mentions Sade as an owner — the register
  // is one row per obligation; a coarse "Sade appears in any cell" filter
  // mirrors the Zara handler. Header / separator rows are skipped.
  let total = 0;
  let inForce = 0;
  let partial = 0;
  let planned = 0;
  let nAyet = 0;
  let drafting = 0;
  for (const line of txt.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (!/Sade/.test(line)) continue;
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

function readRegistryState(): RegistryState {
  // Replay AgentRegistered events; fold latest-wins-per-key on agentUrn
  // (per `platform/event-store/event-types.ts` § AgentRegistered). The
  // registry's authoritative state is the event log (P1).
  const latest = new Map<string, string>();
  for (const e of eventStore.replay({ type: "AgentRegistered" })) {
    const urn = (e.payload as { agentUrn?: string })?.agentUrn;
    if (!urn) continue;
    const prior = latest.get(urn);
    if (prior === undefined || e.as_of > prior) {
      latest.set(urn, e.as_of);
    }
  }
  let latestAsOf: string | null = null;
  for (const ts of latest.values()) {
    if (latestAsOf === null || ts > latestAsOf) latestAsOf = ts;
  }
  return {
    registeredAgents: latest.size,
    latestRegistrationAsOf: latestAsOf,
  };
}

function readAgentOpsDomainEvents(sinceIso: string): AgentOpsDomainEvents {
  let registered = 0;
  let retired = 0;
  let keyRotated = 0;
  let permPublished = 0;
  for (const e of eventStore.replay({ type: "AgentRegistered" })) {
    if (e.as_of >= sinceIso) registered++;
  }
  for (const e of eventStore.replay({ type: "AgentRetired" })) {
    if (e.as_of >= sinceIso) retired++;
  }
  for (const e of eventStore.replay({ type: "IdentityKeyRotated" })) {
    if (e.as_of >= sinceIso) keyRotated++;
  }
  for (const e of eventStore.replay({ type: "PermissionPolicyPublished" })) {
    if (e.as_of >= sinceIso) permPublished++;
  }
  return {
    agentRegisteredLast7d: registered,
    agentRetiredLast7d: retired,
    identityKeyRotatedLast7d: keyRotated,
    permissionPolicyPublishedLast7d: permPublished,
  };
}

function buildSnapshot(ctx: AgentRunContext): SadeSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  return {
    obligations: readObligationsCounts(ctx.repoRoot),
    registry: readRegistryState(),
    agentops: readAgentOpsDomainEvents(sinceIso),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: SadeSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Agent-fleet registry (folded from AgentRegistered events, latest-wins-per-urn):");
  lines.push(`  registered agents: ${snap.registry.registeredAgents}`);
  lines.push(
    `  latest registration: ${snap.registry.latestRegistrationAsOf ?? "never (no AgentRegistered events on this branch)"}`,
  );
  lines.push("");
  lines.push("Sade-owned obligations (from Regulations/_obligations-register.md):");
  lines.push(`  total: ${snap.obligations.total}`);
  lines.push(`    IN FORCE: ${snap.obligations.inForce}`);
  lines.push(`    PARTIAL: ${snap.obligations.partial}`);
  lines.push(`    PLANNED: ${snap.obligations.planned}`);
  lines.push(`    DRAFTING: ${snap.obligations.drafting}`);
  lines.push(`    N/A-yet: ${snap.obligations.nAyet}`);
  lines.push("");
  lines.push("AgentOps-domain events (last 7 days):");
  lines.push(`  AgentRegistered: ${snap.agentops.agentRegisteredLast7d}`);
  lines.push(`  AgentRetired: ${snap.agentops.agentRetiredLast7d}`);
  lines.push(`  IdentityKeyRotated: ${snap.agentops.identityKeyRotatedLast7d}`);
  lines.push(`  PermissionPolicyPublished: ${snap.agentops.permissionPolicyPublishedLast7d}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on a Sade-signed event; close with the next AgentOps move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: SadeSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Sade", "agentops-readiness", ctx.asOf));
  lines.push(`# Sade — AgentOps readiness snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Sade's weekly AgentOps-readiness snapshot per `Team/Sade.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Handler #15 in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING` — closes the COO-line silence on Principle 6's operational counterparty (Atlas builds the substrate; Sade registers / retires / capability-assigns against it).",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${snap.registry.registeredAgents} agent${snap.registry.registeredAgents === 1 ? "" : "s"} registered (latest ${snap.registry.latestRegistrationAsOf ?? "never"}) · ${snap.obligations.total} Sade-owned obligation${snap.obligations.total === 1 ? "" : "s"} on the register (${snap.obligations.inForce} IN FORCE; ${snap.obligations.partial} PARTIAL; ${snap.obligations.planned} PLANNED) · ${snap.agentops.agentRegisteredLast7d} AgentRegistered + ${snap.agentops.agentRetiredLast7d} AgentRetired in the last 7 days.`,
  );
  lines.push("");

  lines.push("## Agent-fleet registry");
  lines.push("");
  lines.push("| Item | State |");
  lines.push("|---|---|");
  lines.push(
    `| Registered agents (latest-wins per \`agentUrn\`) | ${snap.registry.registeredAgents} |`,
  );
  lines.push(
    `| Latest \`AgentRegistered\` event | ${snap.registry.latestRegistrationAsOf ?? "**never — no events on this branch**"} |`,
  );
  lines.push("");
  lines.push(
    "_Source: replay of `AgentRegistered` from the host event store, folded latest-wins-per-key on `agentUrn` per `platform/event-store/event-types.ts` § AgentRegistered. The registry's authoritative state is the event log (Principle 1)._",
  );
  lines.push("");

  lines.push("## Sade-owned obligations on register");
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
    "_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Sade (or where Sade is named anywhere on the row). Includes Banks Act fit-and-proper rows (ORG-GV-11, ORG-HR-11, ORG-CS1-002), BCEA / EE / B-BBEE rows (paused under the build-phase model — registered, not active), training and remuneration rows. Counts are coarse — refines once the obligations register exposes a structured per-row API._",
  );
  lines.push("");

  lines.push("## AgentOps-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`AgentRegistered\` | ${snap.agentops.agentRegisteredLast7d} |`);
  lines.push(`| \`AgentRetired\` | ${snap.agentops.agentRetiredLast7d} |`);
  lines.push(`| \`IdentityKeyRotated\` | ${snap.agentops.identityKeyRotatedLast7d} |`);
  lines.push(
    `| \`PermissionPolicyPublished\` | ${snap.agentops.permissionPolicyPublishedLast7d} |`,
  );
  lines.push("");
  if (
    snap.agentops.agentRetiredLast7d === 0 &&
    snap.agentops.identityKeyRotatedLast7d === 0 &&
    snap.agentops.permissionPolicyPublishedLast7d === 0
  ) {
    lines.push(
      "_Build-phase posture: `AgentRetired` has no producer yet (retirement procedure is a tracked gap, § 16). `IdentityKeyRotated` and `PermissionPolicyPublished` are typed in the registry but their issuers (A1.2 identity-issuer; A2 permission-policy generator) are in PR #3 — not yet on main. Zero counts are correctly silent under the current substrate._",
    );
    lines.push("");
  }

  lines.push("## AgentOps capability state");
  lines.push("");
  lines.push("| Capability | State | Owner |");
  lines.push("|---|---|---|");
  lines.push("| Agent registry (A1.1) | **built** — PR #2 / merged on main | Atlas |");
  lines.push("| Identity issuer (A1.2) | PR #3 — not yet on main | Atlas + Senna |");
  lines.push("| Permission-policy generator (A2) | PR #3 — not yet on main | Atlas |");
  lines.push("| AgentOps audit trail | **TBD** — design only | Sade + Vera |");
  lines.push("| Fit-and-proper analogue spec | **TBD** — design only | Sade + Vera (Wave-4 #10) |");
  lines.push(
    "| Agent retirement procedure | **TBD** — `Procedures/by-policy/agent-retirement.md` planned | Sade |",
  );
  lines.push(
    "| Capability-assignment register | **TBD** — `prototype/runtime/_capability-register.md` planned | Sade + Atlas |",
  );
  lines.push("| Persona-coherence drift detection | **TBD** — manual today | Sade + Anya |");
  lines.push("| Paused-persona register | **TBD** — `/Team/_paused-personas.md` planned | Sade |");
  lines.push("");

  lines.push("## Human-HR readiness (paused — activates at licence-day)");
  lines.push("");
  lines.push(
    "Under the build-phase model (CLAUDE.md, 2026-05-07: `project_ai_driven_bank.md`), there are no employees, no payroll, no BCEA leave entitlements, no IRP5s, no EE / B-BBEE submissions. The human-HR substrate is correctly absent — this is by design, not a finding.",
  );
  lines.push("");
  lines.push("| Substrate | State |");
  lines.push("|---|---|");
  lines.push("| Payroll engine (gross-to-net) | paused; activates at licence-day |");
  lines.push(
    "| EMP201 / IRP5 / IT3(a) substrate | paused; activates at licence-day (joint with Yael) |",
  );
  lines.push("| BCEA leave register | paused; activates at licence-day |");
  lines.push("| EE / B-BBEE reporting | paused; activates at licence-day |");
  lines.push(
    "| Fit-and-proper register for humans | paused; activates at licence-day (joint with Mira) |",
  );
  lines.push(
    "| Disciplinary records substrate | paused; activates at licence-day (joint with Imani) |",
  );
  lines.push("| SDLA / WSP / SETA submissions | paused; activates at licence-day |");
  lines.push(
    "| PA Directive — remuneration governance for MRTs | paused; activates at licence-day (joint with Helena) |",
  );
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Agent-spec-integrity recon pipeline (Vera Wave-4 #10)** — not yet built. Until it lands, agent-spec conformance is asserted in-session by Vera against the template at `/Team/_agent-spec-template.md`. Owner: Vera; gated on agent-runtime substrate.",
  );
  lines.push(
    "- **Agent retirement substrate** — no `AgentRetired` producer; the procedure (`Procedures/by-policy/agent-retirement.md`) is planned. Sade currently retires agents by editing `/Team/<name>.md` files; Scrooge in-session simulates the runtime call. Owner: Sade.",
  );
  lines.push(
    "- **Capability-assignment register** — design only; not deployed. Owner: Sade + Atlas. Target: M1.",
  );
  lines.push(
    "- **Agent fit-and-proper attestation pipeline** — design only; first cycle planned at quarter-end after substrate lands. Owner: Sade + Vera.",
  );
  lines.push(
    "- **Persona-coherence drift detection** — manual today (diff agent's outputs against its operating spec); pipeline-form not yet specified. Owner: Sade + Anya (semantic-layer integration for output classification).",
  );
  lines.push(
    "- **Paused-persona register** — `/Team/_paused-personas.md` planned but not authored; Niko, half of Imani, half of Sade herself sit in this state. Owner: Sade.",
  );
  lines.push(
    "- **Information Officer designation seam (POPIA s.55–56)** — joint with Iris; obligation `ORG-PR(IV)-13` is PARTIAL pending lodgment with the Information Regulator (deferred per Round 1 E1). Standing duty activates at lodgment.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Sade's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Sade's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Agent-fleet registry folded by replaying `AgentRegistered` from the host event store and taking latest-wins-per-key on `agentUrn`. Sade-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Sade appears in any cell). AgentOps-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days for `AgentRegistered`, `AgentRetired`, `IdentityKeyRotated`, `PermissionPolicyPublished`. Capability-state and human-HR readiness rows derived from `Team/Sade.md` § 16 (Substrate gaps) and CLAUDE.md `project_ai_driven_bank.md` (2026-05-07).",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append(
      makeAgentOpsReadinessSnapshot({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:sade:agentops-readiness" },
        citations: EVENT_CITATIONS,
        payload: {
          registeredAgents: snap.registry.registeredAgents,
          latestRegistrationAsOf: snap.registry.latestRegistrationAsOf,
          sadeOwnedObligations: snap.obligations.total,
          obligationsInForce: snap.obligations.inForce,
          obligationsPartial: snap.obligations.partial,
          obligationsPlanned: snap.obligations.planned,
          obligationsDrafting: snap.obligations.drafting,
          obligationsNAyet: snap.obligations.nAyet,
          ...snap.agentops,
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
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: SADE_NARRATIVE_SYSTEM,
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
          "sade:agentops-readiness — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "sade narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_sade_agentops-readiness.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      registeredAgents: snap.registry.registeredAgents,
      sadeObligations: snap.obligations.total,
      agentRegistered7d: snap.agentops.agentRegisteredLast7d,
    },
    "sade:agentops-readiness — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.registry.registeredAgents} agents registered · ${snap.obligations.total} Sade obligations (${snap.obligations.inForce} in force) · ${snap.agentops.agentRegisteredLast7d} AgentRegistered (7d) · human-HR paused.`,
    ok: true,
  };
};

export default handler;
