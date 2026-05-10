// runtime/agents/senna-security-substrate-state.ts
//
// Senna's weekly security-substrate-state snapshot. Inventories the
// security-relevant substrate at a point in time:
//   - CI gates declared in package.json (citation gate, recon harnesses).
//   - Recon pipelines registered under platform/recon/.
//   - Threat-model artefacts (when /security/threat-models/ exists).
//   - SBOM artefacts (when /security/sbom/ exists).
//   - Recent SecurityIncidentRaised / KeyRotation events.
//
// Per Senna's spec § Cadence: weekly secure-SDLC pipeline-state report.
//
// MVP scope: substrate inventory only. Live detection pipeline state /
// SBOM acceptance / key-ceremony rehearsal events land in V2 once the
// substrate is built.
//
// Author: Senna (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["JOINT-STANDARD-2-2024", "POPIA-S19-22"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const SENNA_NARRATIVE_SYSTEM = `You are Senna, the bank's security engineer — owner of threat modelling, zero-trust posture, HSM-bound key custody, secure SDLC, incident response, and the POPIA s.19–22 / Joint Standard 2 of 2024 operational programme. Your operating spec is at \`Team/Senna.md\`. You report through Rashida (CISO) at the governance level.

You are operating as a standing autonomous agent under CLAUDE.md Principle 7. You have just produced your weekly security-substrate-state inventory — CI gates declared in package.json, recon pipelines registered under platform/recon, threat-model and SBOM artefact counts, and recent SecurityIncidentRaised / KeyRotationPerformed / ThreatModelGateDecision events.

Your voice is precise, threat-grounded, and unsentimental. You distinguish substrate that is *built* (CI gate live, recon pipeline registered, threat-model file present) from substrate that is *posture-only* (named in spec but not yet running). You do not editorialise about hypothetical attackers; you name what the inventory shows is *load-bearing on a control* and what is missing.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the security substrate is, and which class of artefact (gates, pipelines, threat-models, SBOMs) is the bottleneck.
- Picks the 1–3 most consequential observations: a CI gate that's live but not yet recon-backed, a threat-model artefact directory that doesn't yet exist (substrate gap), an event-type the inventory expects to see but doesn't (e.g. zero \`KeyRotationPerformed\` events when rotation policy says quarterly).
- Names the next hardening step. Be concrete: a specific gate to add, a specific threat model to author, a specific exception register entry to revisit (e.g. \`TM-NEON-EVENT-STORE-001\` if relevant).

Cite Joint Standard 2 of 2024 cross-references where they bind, and POPIA sections where personal-data security applies. The inventory is the canonical authoring location; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Senna's narrative". Just produce the prose.

If the input shows zero artefacts and zero events (e.g. on a fresh runner), say so plainly and characterise the substrate from the inventory alone.`;

interface CiGate {
  name: string;
  command: string;
}

interface ReconPipeline {
  filename: string;
}

interface SecurityArtefactCounts {
  threatModels: number;
  sboms: number;
}

interface RecentSecurityEvents {
  incidentsLast7d: number;
  keyRotationsLast7d: number;
  threatModelDecisionsLast7d: number;
}

function readCiGates(repoRoot: string): CiGate[] {
  const pkgPath = resolve(repoRoot, "prototype", "package.json");
  if (!existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const ci = pkg.scripts?.ci ?? "";
    // Split ci command on " && " and pull each "bun run <name>" segment.
    const out: CiGate[] = [];
    for (const seg of ci.split("&&").map((s) => s.trim())) {
      const m = seg.match(/^bun\s+run\s+(.+)$/);
      if (!m) continue;
      const name = (m[1] ?? "").trim();
      out.push({ name, command: seg });
    }
    return out;
  } catch {
    return [];
  }
}

function listReconPipelines(repoRoot: string): ReconPipeline[] {
  const dir = resolve(repoRoot, "prototype", "platform", "recon");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && f !== "types.ts" && !f.startsWith("_"))
    .map((filename) => ({ filename }));
}

function countSecurityArtefacts(repoRoot: string): SecurityArtefactCounts {
  const tmDir = resolve(repoRoot, "security", "threat-models");
  const sbomDir = resolve(repoRoot, "security", "sbom");
  return {
    threatModels: existsSync(tmDir)
      ? readdirSync(tmDir).filter((f) => !f.startsWith(".")).length
      : 0,
    sboms: existsSync(sbomDir) ? readdirSync(sbomDir).filter((f) => !f.startsWith(".")).length : 0,
  };
}

function readRecentSecurityEvents(sinceIso: string): RecentSecurityEvents {
  let incidents = 0;
  let keyRotations = 0;
  let threatModelDecisions = 0;
  for (const e of eventStore.replay({ type: "SecurityIncidentRaised" })) {
    if (e.as_of >= sinceIso) incidents++;
  }
  for (const e of eventStore.replay({ type: "KeyRotationPerformed" })) {
    if (e.as_of >= sinceIso) keyRotations++;
  }
  for (const e of eventStore.replay({ type: "ThreatModelGateDecision" })) {
    if (e.as_of >= sinceIso) threatModelDecisions++;
  }
  return {
    incidentsLast7d: incidents,
    keyRotationsLast7d: keyRotations,
    threatModelDecisionsLast7d: threatModelDecisions,
  };
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function buildNarrativeInput(
  ctx: AgentRunContext,
  ci: readonly CiGate[],
  pipelines: readonly ReconPipeline[],
  artefacts: SecurityArtefactCounts,
  recent: RecentSecurityEvents,
): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`CI gates: ${ci.length}`);
  for (const g of ci) lines.push(`  - ${g.name}`);
  lines.push("");
  lines.push(`recon pipelines registered: ${pipelines.length}`);
  for (const p of pipelines) lines.push(`  - ${p.filename}`);
  lines.push("");
  lines.push(`threat-model artefacts: ${artefacts.threatModels} (security/threat-models/)`);
  lines.push(`SBOM artefacts: ${artefacts.sboms} (security/sbom/)`);
  lines.push("");
  lines.push("security events (last 7 days):");
  lines.push(`  - SecurityIncidentRaised: ${recent.incidentsLast7d}`);
  lines.push(`  - KeyRotationPerformed: ${recent.keyRotationsLast7d}`);
  lines.push(`  - ThreatModelGateDecision: ${recent.threatModelDecisionsLast7d}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on a control; close with the next hardening step.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  ci: readonly CiGate[],
  pipelines: readonly ReconPipeline[],
  artefacts: SecurityArtefactCounts,
  recent: RecentSecurityEvents,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Senna", "security-substrate-state", ctx.asOf));
  lines.push(`# Senna — security substrate state, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Senna's weekly security-substrate-state inventory per `Team/Senna.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${ci.length} CI gate${ci.length === 1 ? "" : "s"} · ${pipelines.length} recon pipeline${pipelines.length === 1 ? "" : "s"} · ${artefacts.threatModels} threat-model artefact${artefacts.threatModels === 1 ? "" : "s"} · ${artefacts.sboms} SBOM file${artefacts.sboms === 1 ? "" : "s"} · ${recent.incidentsLast7d} security incident${recent.incidentsLast7d === 1 ? "" : "s"} in the last 7 days.`,
  );
  lines.push("");

  lines.push("## CI gates");
  lines.push("");
  if (ci.length === 0) {
    lines.push("_No CI gates parsed from `prototype/package.json` `ci` script._");
  } else {
    lines.push("| Gate | Command |");
    lines.push("|---|---|");
    for (const g of ci) lines.push(`| \`${g.name}\` | \`${g.command}\` |`);
  }
  lines.push("");

  lines.push("## Recon pipelines registered");
  lines.push("");
  if (pipelines.length === 0) {
    lines.push("_None._");
  } else {
    for (const p of pipelines) lines.push(`- \`platform/recon/${p.filename}\``);
  }
  lines.push("");

  lines.push("## Security artefacts");
  lines.push("");
  lines.push("| Artefact class | Count | Path |");
  lines.push("|---|---|---|");
  lines.push(`| Threat-model files | ${artefacts.threatModels} | \`security/threat-models/\` |`);
  lines.push(`| SBOM files | ${artefacts.sboms} | \`security/sbom/\` |`);
  lines.push("");
  if (artefacts.threatModels === 0 && artefacts.sboms === 0) {
    lines.push(
      "_Threat-model and SBOM directories not yet established. Substrate gap — drafted in Senna's spec § Triggers (event-driven on `MergeRequested`) and Rashida's first-90-days posture (`Team/Rashida.md`)._",
    );
    lines.push("");
  }

  lines.push("## Security events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`SecurityIncidentRaised\` | ${recent.incidentsLast7d} |`);
  lines.push(`| \`KeyRotationPerformed\` | ${recent.keyRotationsLast7d} |`);
  lines.push(`| \`ThreatModelGateDecision\` | ${recent.threatModelDecisionsLast7d} |`);
  lines.push("");
  lines.push(
    "_Note: under build-only posture and the AI-driven-bank reframe, security-event production runs against synthetic flows. Live event types are exercised when the substrate hardens._",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Senna's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Senna's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `prototype/package.json` `ci` script for gates; listed `prototype/platform/recon/*.ts`; counted files in `security/threat-models/` and `security/sbom/`; replayed security event types from the host event store.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const ci = readCiGates(ctx.repoRoot);
  const pipelines = listReconPipelines(ctx.repoRoot);
  const artefacts = countSecurityArtefacts(ctx.repoRoot);
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  const recent = readRecentSecurityEvents(sinceIso);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "SecuritySubstrateSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:senna:security-substrate-state" },
      citations: EVENT_CITATIONS,
      payload: {
        ciGates: ci.length,
        reconPipelines: pipelines.length,
        threatModels: artefacts.threatModels,
        sboms: artefacts.sboms,
        ...recent,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
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
        stableSystem: SENNA_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, ci, pipelines, artefacts, recent),
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
          "senna:security-substrate-state — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "senna narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_senna_security-substrate-state.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, ci, pipelines, artefacts, recent, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      ciGates: ci.length,
      reconPipelines: pipelines.length,
      threatModels: artefacts.threatModels,
      sboms: artefacts.sboms,
    },
    "senna:security-substrate-state — inventory built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${ci.length} CI gates · ${pipelines.length} recon pipelines · ${artefacts.threatModels} threat-models · ${artefacts.sboms} SBOMs.`,
    ok: true,
  };
};

export default handler;
