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
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["JOINT-STANDARD-1-2024", "POPIA-S19-22"];

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
    threatModels: existsSync(tmDir) ? readdirSync(tmDir).filter((f) => !f.startsWith(".")).length : 0,
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

function buildReportMarkdown(
  ctx: AgentRunContext,
  ci: readonly CiGate[],
  pipelines: readonly ReconPipeline[],
  artefacts: SecurityArtefactCounts,
  recent: RecentSecurityEvents,
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

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_senna_security-substrate-state.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, ci, pipelines, artefacts, recent),
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
