// runtime/agents/rashida-cyber-resilience-snapshot.ts
//
// Rashida's weekly cyber-resilience snapshot. Reads Senna's substrate
// inventory, the cyber-and-information-security obligations register
// slice, and recent security-domain events to produce a Joint Standard
// 1 of 2024 / POPIA s.19–22 readiness attestation.
//
// Per Rashida's spec § 6 (Cadence): weekly threat-model-gate review;
// quarterly Joint-Standard-1-of-2024 programme review; quarterly POPIA
// s.19–22 joint review with Iris. § 9 (Decisions in scope) lists
// `JointStandard1ProgrammeAttestation` and `POPIASec19_22AttestationSigned`.
//
// MVP scope: weekly snapshot of substrate state + obligations coverage.
// The formal quarterly programme attestation and the second-line cyber
// opinion to AC remain CISO-signed actions; this is the pre-attestation
// digest.
//
// Author: Rashida (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "JOINT-STANDARD-1-2024",
  "POPIA-S19-22",
  "BANKS-ACT-94-1990",
  "BCBS-OP-CYBER",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const RASHIDA_NARRATIVE_SYSTEM = `You are Rashida Patel, the bank's Chief Information Security Officer — named accountable officer for cybersecurity under Joint Standard 1 of 2024 and operational-security counterpart to the Information Officer under POPIA s.19–22. Your operating spec is at \`Team/Rashida.md\`. You report directly to the CEO; Senna (engineer) reports to you.

You are operating as a standing autonomous agent under CLAUDE.md Principle 7. You have just produced your weekly cyber-resilience snapshot — Senna's substrate-state events, obligations-register slice for Joint Standard 1 of 2024 and POPIA s.19–22, recent security-incident / threat-model-gate / key-rotation / SBOM-acceptance events.

Your voice is precise, threat-grounded, and unsentimental. You distinguish *rehearsed-readiness* (build-only posture; threat-model gate runs against synthetic flows) from *live* (post-licence). You name what's load-bearing on a control versus what is posture-only. You quote Joint Standard 1 of 2024 sub-paragraphs by reference where they bind, not in your own words.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the cyber substrate is, the obligations-register slice coverage, and what landed in the last 7 days.
- Picks the 1–3 most consequential observations: a Joint-Standard-1-of-2024 obligation whose fulfilment depends on substrate that is not yet built, an event-type the inventory expects to see but doesn't (e.g. zero \`KeyRotationPerformed\` when rotation policy says quarterly), a threat-model-gate decision that warrants escalation.
- Names the next hardening step. Be concrete: a specific obligation to populate, a programme-map entry to refresh, a JS-1-of-2024 reportability rehearsal that is overdue. The pre-licence security-readiness gate (co-owned with Saskia and Devon) is the load-bearing pre-attestation surface.

Cite Joint Standard 1 of 2024 cross-references and POPIA sections where they bind. The substrate inventory and obligations register are the canonical authoring locations; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Rashida's narrative". Just produce the prose.

If the inputs show zero events and the substrate is mostly posture-only (the build-phase default), say so plainly and characterise programme-readiness from the obligations slice and Senna's last substrate snapshot.`;

interface RecentEvent {
  type: string;
  asOf: string;
  summary: string;
}

interface CyberDigest {
  sennaSubstrateLast7d: number;
  incidentsLast7d: RecentEvent[];
  threatModelGateDecisionsLast7d: number;
  keyRotationsLast7d: number;
  sbomAcceptedLast7d: number;
  sbomRejectedLast7d: number;
  vendorSecurityReviewsLast7d: number;
  popiaCompromiseSuspectedLast7d: number;
  cyberObligationsCount: number;
  popiaSecurityObligationsCount: number;
  jointStandardObligationsCount: number;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function countObligations(content: string, citationNeedle: RegExp): number {
  let n = 0;
  for (const line of content.split(/\r?\n/)) {
    if (!/^\|\s*ORG-/i.test(line)) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 6) continue;
    const citation = cells[1] ?? "";
    if (citationNeedle.test(citation)) n++;
  }
  return n;
}

function countCyberObligations(content: string): number {
  // ORG-CY-* rows = cyber-and-information-security obligations slice.
  let n = 0;
  for (const line of content.split(/\r?\n/)) {
    if (/^\|\s*ORG-CY-/i.test(line)) n++;
  }
  return n;
}

function buildDigest(ctx: AgentRunContext): CyberDigest {
  const since7d = isoDaysAgo(ctx.asOf, 7);

  let sennaSubstrate = 0;
  for (const e of eventStore.replay({ type: "SecuritySubstrateSnapshot" })) {
    if (e.as_of >= since7d) sennaSubstrate++;
  }

  const incidents: RecentEvent[] = [];
  for (const e of eventStore.replay({ type: "SecurityIncidentRaised" })) {
    if (e.as_of < since7d) continue;
    const p = e.payload as Record<string, unknown>;
    incidents.push({
      type: e.type,
      asOf: e.as_of,
      summary: String(p.summary ?? p.title ?? p.severity ?? "(no summary)"),
    });
  }
  incidents.sort((a, b) => (a.asOf < b.asOf ? 1 : -1));

  let threatModelGate = 0;
  for (const e of eventStore.replay({ type: "ThreatModelGateDecision" })) {
    if (e.as_of >= since7d) threatModelGate++;
  }

  let keyRotations = 0;
  for (const e of eventStore.replay({ type: "KeyRotationPerformed" })) {
    if (e.as_of >= since7d) keyRotations++;
  }

  let sbomAccepted = 0;
  for (const e of eventStore.replay({ type: "SBOMAccepted" })) {
    if (e.as_of >= since7d) sbomAccepted++;
  }

  let sbomRejected = 0;
  for (const e of eventStore.replay({ type: "SBOMRejected" })) {
    if (e.as_of >= since7d) sbomRejected++;
  }

  let vendor = 0;
  for (const e of eventStore.replay({ type: "VendorSecurityReview" })) {
    if (e.as_of >= since7d) vendor++;
  }

  let popiaCompromise = 0;
  for (const e of eventStore.replay({ type: "PersonalInformationCompromiseSuspected" })) {
    if (e.as_of >= since7d) popiaCompromise++;
  }

  // Obligations slice — read once, count three sub-slices.
  const obligationsPath = resolve(ctx.repoRoot, "Regulations", "_obligations-register.md");
  const obligationsContent = existsSync(obligationsPath)
    ? readFileSync(obligationsPath, "utf8")
    : "";
  const cyberObligationsCount = countCyberObligations(obligationsContent);
  const jointStandardObligationsCount = countObligations(
    obligationsContent,
    /Joint\s+Standard\s+1\s+of\s+2024/i,
  );
  const popiaSecurityObligationsCount = countObligations(
    obligationsContent,
    /POPIA\s+(?:s\.|ss?\.)\s*(?:19|20|21|22)/i,
  );

  return {
    sennaSubstrateLast7d: sennaSubstrate,
    incidentsLast7d: incidents,
    threatModelGateDecisionsLast7d: threatModelGate,
    keyRotationsLast7d: keyRotations,
    sbomAcceptedLast7d: sbomAccepted,
    sbomRejectedLast7d: sbomRejected,
    vendorSecurityReviewsLast7d: vendor,
    popiaCompromiseSuspectedLast7d: popiaCompromise,
    cyberObligationsCount,
    popiaSecurityObligationsCount,
    jointStandardObligationsCount,
  };
}

function buildNarrativeInput(ctx: AgentRunContext, d: CyberDigest): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("obligations-register slice:");
  lines.push(`  - ORG-CY-* (cyber-and-information-security): ${d.cyberObligationsCount}`);
  lines.push(`  - Joint Standard 1 of 2024 cited rows: ${d.jointStandardObligationsCount}`);
  lines.push(`  - POPIA s.19–22 cited rows: ${d.popiaSecurityObligationsCount}`);
  lines.push("");
  lines.push("security events (last 7 days):");
  lines.push(`  - Senna SecuritySubstrateSnapshot runs: ${d.sennaSubstrateLast7d}`);
  lines.push(`  - SecurityIncidentRaised: ${d.incidentsLast7d.length}`);
  for (const i of d.incidentsLast7d.slice(0, 5)) {
    lines.push(`    - ${i.asOf.slice(0, 10)} ${i.summary}`);
  }
  lines.push(`  - ThreatModelGateDecision: ${d.threatModelGateDecisionsLast7d}`);
  lines.push(`  - KeyRotationPerformed: ${d.keyRotationsLast7d}`);
  lines.push(`  - SBOMAccepted / SBOMRejected: ${d.sbomAcceptedLast7d} / ${d.sbomRejectedLast7d}`);
  lines.push(`  - VendorSecurityReview: ${d.vendorSecurityReviewsLast7d}`);
  lines.push(
    `  - PersonalInformationCompromiseSuspected: ${d.popiaCompromiseSuspectedLast7d}`,
  );
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by Joint-Standard-1-of-2024 / POPIA s.19–22 binding strength; close with the next hardening step.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  d: CyberDigest,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Rashida", "cyber-resilience-snapshot", ctx.asOf));
  lines.push(`# Rashida — cyber-resilience snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Rashida's weekly cyber-resilience snapshot per `Team/Rashida.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Pre-attestation digest for the quarterly Joint Standard 1 of 2024 programme attestation and the second-line cyber opinion to AC.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${d.cyberObligationsCount} ORG-CY-* obligation${d.cyberObligationsCount === 1 ? "" : "s"} indexed (${d.jointStandardObligationsCount} citing Joint Standard 1 of 2024; ${d.popiaSecurityObligationsCount} citing POPIA s.19–22) · ${d.incidentsLast7d.length} \`SecurityIncidentRaised\` event${d.incidentsLast7d.length === 1 ? "" : "s"} in the last 7 days · ${d.threatModelGateDecisionsLast7d} threat-model gate decision${d.threatModelGateDecisionsLast7d === 1 ? "" : "s"}.`,
  );
  lines.push("");

  lines.push("## Obligations-register slice");
  lines.push("");
  lines.push("| Slice | Count |");
  lines.push("|---|---|");
  lines.push(`| ORG-CY-* (cyber & information security) | ${d.cyberObligationsCount} |`);
  lines.push(
    `| Rows citing Joint Standard 1 of 2024 | ${d.jointStandardObligationsCount} |`,
  );
  lines.push(`| Rows citing POPIA s.19–22 | ${d.popiaSecurityObligationsCount} |`);
  lines.push("");

  lines.push("## Security events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| Senna \`SecuritySubstrateSnapshot\` | ${d.sennaSubstrateLast7d} |`);
  lines.push(`| \`SecurityIncidentRaised\` | ${d.incidentsLast7d.length} |`);
  lines.push(`| \`ThreatModelGateDecision\` | ${d.threatModelGateDecisionsLast7d} |`);
  lines.push(`| \`KeyRotationPerformed\` | ${d.keyRotationsLast7d} |`);
  lines.push(`| \`SBOMAccepted\` | ${d.sbomAcceptedLast7d} |`);
  lines.push(`| \`SBOMRejected\` | ${d.sbomRejectedLast7d} |`);
  lines.push(`| \`VendorSecurityReview\` | ${d.vendorSecurityReviewsLast7d} |`);
  lines.push(
    `| \`PersonalInformationCompromiseSuspected\` | ${d.popiaCompromiseSuspectedLast7d} |`,
  );
  lines.push("");
  lines.push(
    "_Build-only context: per `Team/Rashida.md` § 5 / § Build-only context, programme is rehearsed-readiness against synthetic flows. Live-incident posture activates licence-day. Zero counts here are expected and not a substrate alarm on their own._",
  );
  lines.push("");

  if (d.incidentsLast7d.length > 0) {
    lines.push("### SecurityIncidentRaised — recent");
    lines.push("");
    lines.push("| When | Summary |");
    lines.push("|---|---|");
    for (const i of d.incidentsLast7d) {
      const safe = i.summary.replace(/\|/g, "\\|");
      lines.push(`| ${i.asOf.slice(0, 10)} | ${safe} |`);
    }
    lines.push("");
  }

  lines.push("## Programme-readiness (build-phase)");
  lines.push("");
  lines.push(
    "- **Joint Standard 1 of 2024 programme map** — drafted; PA / FSCA reporting cadence rehearsed against simulated endpoints (Rashida § Build-only context).",
  );
  lines.push(
    "- **Threat-modelling gate** — operating; Senna runs; Rashida signs exceptions.",
  );
  lines.push(
    "- **Cyber-resilience scenario test plan** — rehearsed cadence; first cycle in build-phase per § 5 first-90-days posture.",
  );
  lines.push(
    "- **POPIA s.19–22 partnered cadence with Iris** — quarterly joint review; this snapshot informs Iris's `popia-controls-snapshot` digest.",
  );
  lines.push(
    "- **Pre-licence security-readiness gate** — co-owned with Saskia (franchise pre-conditions) and Devon (broader OR); load-bearing for switch-to-live.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Rashida's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Rashida's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `Regulations/_obligations-register.md` for ORG-CY-* / Joint Standard 1 of 2024 / POPIA s.19–22 row counts. Replayed `SecuritySubstrateSnapshot`, `SecurityIncidentRaised`, `ThreatModelGateDecision`, `KeyRotationPerformed`, `SBOMAccepted`, `SBOMRejected`, `VendorSecurityReview`, `PersonalInformationCompromiseSuspected` from the host event store.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const digest = buildDigest(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "CyberResilienceSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:rashida:cyber-resilience-snapshot" },
      citations: EVENT_CITATIONS,
      payload: {
        cyberObligationsCount: digest.cyberObligationsCount,
        jointStandardObligationsCount: digest.jointStandardObligationsCount,
        popiaSecurityObligationsCount: digest.popiaSecurityObligationsCount,
        sennaSubstrateLast7d: digest.sennaSubstrateLast7d,
        incidentsLast7d: digest.incidentsLast7d.length,
        threatModelGateDecisionsLast7d: digest.threatModelGateDecisionsLast7d,
        keyRotationsLast7d: digest.keyRotationsLast7d,
        sbomAcceptedLast7d: digest.sbomAcceptedLast7d,
        sbomRejectedLast7d: digest.sbomRejectedLast7d,
        vendorSecurityReviewsLast7d: digest.vendorSecurityReviewsLast7d,
        popiaCompromiseSuspectedLast7d: digest.popiaCompromiseSuspectedLast7d,
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
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: RASHIDA_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, digest),
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
          "rashida:cyber-resilience-snapshot — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "rashida narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_rashida_cyber-resilience-snapshot.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, digest, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      cyberObligations: digest.cyberObligationsCount,
      incidents7d: digest.incidentsLast7d.length,
      sennaSubstrate7d: digest.sennaSubstrateLast7d,
    },
    "rashida:cyber-resilience-snapshot — digest built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${digest.cyberObligationsCount} ORG-CY-* obligations · ${digest.incidentsLast7d.length} incidents (7d) · ${digest.threatModelGateDecisionsLast7d} threat-model decisions · ${digest.sennaSubstrateLast7d} Senna substrate runs.`,
    ok: true,
  };
};

export default handler;
