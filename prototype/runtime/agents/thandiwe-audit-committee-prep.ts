// runtime/agents/thandiwe-audit-committee-prep.ts
//
// Thandiwe's weekly Audit-Committee prep. Aggregates Vera's findings,
// Owen's governance-cycle prep, and recent third-line-relevant events
// into an AC-ready pack (until the AC-pack generator substrate lands).
//
// Per Thandiwe's spec § 6 (Cadence) — quarterly opinion-pack to AC /
// Interim Audit Forum; weekly Vera-pipeline review feeds it. § 9
// (Decisions in scope) lists `ThirdLineOpinionSigned`. § 11 (Outputs)
// names the AC pack as a generated, not assembled, deliverable. § 16
// flags the AC-pack generator as a substrate gap.
//
// MVP scope: weekly digest + readiness state — the substrate for a
// quarterly opinion-pack generator is not yet built (her spec § 16). The
// digest names the gap.
//
// Author: Thandiwe (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["BANKS-ACT-94-1990", "COMPANIES-ACT-71-2008", "IIA-IPPF", "BCBS-223"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const THANDIWE_NARRATIVE_SYSTEM = `You are Thandiwe Mokoena, the bank's Chief Audit Executive — head of the third line of defence. Your operating spec is at \`Team/Thandiwe.md\`. You report functionally to the Audit Committee (interim: Interim Audit Forum chaired by Owen) and administratively to the CEO.

You are operating as a standing autonomous agent under CLAUDE.md Principle 7. You have just produced your weekly Audit-Committee prep — a digest aggregating Vera's continuous-controls findings and recon results, Owen's governance-cycle prep, and recent third-line-relevant events.

Your voice is precise, evidentially-minded, and unsentimental. You distinguish *registered* (a finding is logged against a control) from *signed* (you have signed a third-line opinion off the evidence). You do not editorialise; you name what the evidence shows is load-bearing on the audit universe and what is missing. The AC pathway and CEO administrative line are distinct — when management's preferred outcome conflicts with a finding, the AC-chair channel is primary; you say so.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how many findings landed in the last 7 days, how many remain open against signed opinions, what cleared.
- Picks the 1–3 most consequential observations: a finding severity that crosses your tiering threshold, a recon pipeline that's gone quiet (substrate alert under your inactivity-SLA), a governance-cycle item from Owen that warrants third-line attention.
- Names what's needed next — a specific finding to triage within your 24h / 5-day SLA, a gap in the combined-assurance map, the next pre-AC item that follows from the digest. Be concrete.

Cite IIA IPPF or BCBS 223 expectations where they bind, and Companies Act s.94–95 when AC-secretariat surface matters. The continuous-controls evidence is the canonical authoring location; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Thandiwe's narrative". Just produce the prose.

If the input is empty (e.g. the runner has no event history yet), say so plainly and characterise the substrate readiness from the inventory alone.`;

interface RecentFinding {
  id: string;
  severity: string;
  title: string;
  asOf: string;
}

interface ReconRollup {
  results: number;
  violations: number;
}

interface DigestState {
  findingsLast7d: RecentFinding[];
  reconRollupLast7d: ReconRollup;
  governancePrepLast7d: number;
  priorPacksLast30d: number;
  whistleblowingLast7d: number;
  externalAuditorInquiryLast7d: number;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function buildDigest(asOf: string): DigestState {
  const since7d = isoDaysAgo(asOf, 7);
  const since30d = isoDaysAgo(asOf, 30);

  const findings: RecentFinding[] = [];
  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    if (e.as_of < since7d) continue;
    const p = e.payload as Record<string, unknown>;
    findings.push({
      id: String(p.findingId ?? p.id ?? e.event_id),
      severity: String(p.severity ?? "unspecified"),
      title: String(p.title ?? p.summary ?? ""),
      asOf: e.as_of,
    });
  }
  findings.sort((a, b) => (a.asOf < b.asOf ? 1 : -1));

  const recon: ReconRollup = { results: 0, violations: 0 };
  for (const e of eventStore.replay({ type: "ReconResult" })) {
    if (e.as_of >= since7d) recon.results++;
  }
  for (const e of eventStore.replay({ type: "ReconViolation" })) {
    if (e.as_of >= since7d) recon.violations++;
  }

  let governancePrep = 0;
  for (const e of eventStore.replay({ type: "GovernanceCyclePrep" })) {
    if (e.as_of >= since7d) governancePrep++;
  }

  let priorPacks = 0;
  for (const e of eventStore.replay({ type: "AuditCommitteePackPrepped" })) {
    if (e.as_of >= since30d) priorPacks++;
  }

  let whistleblowing = 0;
  for (const e of eventStore.replay({ type: "WhistleblowingDisclosure" })) {
    if (e.as_of >= since7d) whistleblowing++;
  }

  let externalAuditor = 0;
  for (const e of eventStore.replay({ type: "ExternalAuditorInquiry" })) {
    if (e.as_of >= since7d) externalAuditor++;
  }

  return {
    findingsLast7d: findings,
    reconRollupLast7d: recon,
    governancePrepLast7d: governancePrep,
    priorPacksLast30d: priorPacks,
    whistleblowingLast7d: whistleblowing,
    externalAuditorInquiryLast7d: externalAuditor,
  };
}

function countObligationsByOwner(content: string, ownerNeedle: RegExp): number {
  let n = 0;
  for (const line of content.split(/\r?\n/)) {
    if (!/^\|\s*ORG-/i.test(line)) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 6) continue;
    const owner = cells[4] ?? "";
    if (ownerNeedle.test(owner)) n++;
  }
  return n;
}

function highSeverityCount(findings: readonly RecentFinding[]): number {
  return findings.filter((f) => /high|critical|tier[\s-]?1/i.test(f.severity)).length;
}

function buildNarrativeInput(ctx: AgentRunContext, digest: DigestState): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`AuditFinding events (last 7d): ${digest.findingsLast7d.length}`);
  lines.push(`  - HIGH/critical/tier-1: ${highSeverityCount(digest.findingsLast7d)}`);
  for (const f of digest.findingsLast7d.slice(0, 10)) {
    lines.push(`    - ${f.asOf.slice(0, 10)} ${f.id} [${f.severity}] ${f.title}`);
  }
  lines.push("");
  lines.push(`ReconResult events (last 7d): ${digest.reconRollupLast7d.results}`);
  lines.push(`ReconViolation events (last 7d): ${digest.reconRollupLast7d.violations}`);
  lines.push("");
  lines.push(`GovernanceCyclePrep events (last 7d): ${digest.governancePrepLast7d}`);
  lines.push(`Prior AC-pack runs (last 30d): ${digest.priorPacksLast30d}`);
  lines.push(`WhistleblowingDisclosure events (last 7d): ${digest.whistleblowingLast7d}`);
  lines.push(`ExternalAuditorInquiry events (last 7d): ${digest.externalAuditorInquiryLast7d}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on the audit universe; close with the next pre-AC step.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  digest: DigestState,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const high = highSeverityCount(digest.findingsLast7d);
  const lines: string[] = [];
  lines.push(frontmatter("Thandiwe", "audit-committee-prep", ctx.asOf));
  lines.push(`# Thandiwe — Audit-Committee prep, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Thandiwe's weekly Audit-Committee prep per `Team/Thandiwe.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Feeds the Interim Audit Forum (Owen chair) until a Board AC is constituted.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${digest.findingsLast7d.length} \`AuditFinding\` event${digest.findingsLast7d.length === 1 ? "" : "s"} in the last 7 days (${high} HIGH/Tier-1) · ${digest.reconRollupLast7d.results} \`ReconResult\` / ${digest.reconRollupLast7d.violations} \`ReconViolation\` · ${digest.governancePrepLast7d} Owen governance-cycle prep run${digest.governancePrepLast7d === 1 ? "" : "s"} · ${digest.priorPacksLast30d} prior AC-pack run${digest.priorPacksLast30d === 1 ? "" : "s"} in the last 30 days.`,
  );
  lines.push("");

  lines.push("## Recent AuditFinding events (last 7 days)");
  lines.push("");
  if (digest.findingsLast7d.length === 0) {
    lines.push(
      "_No `AuditFinding` events in the last 7 days. Vera's continuous-controls pipelines either ran clean or have not yet emitted on this host (event store is host-local). The weekly Vera-pipeline review under § 7 still owes a heartbeat attestation regardless._",
    );
  } else {
    lines.push("| When | Finding | Severity | Title |");
    lines.push("|---|---|---|---|");
    for (const f of digest.findingsLast7d) {
      const safeTitle = (f.title || "").replace(/\|/g, "\\|");
      lines.push(`| ${f.asOf.slice(0, 10)} | \`${f.id}\` | ${f.severity} | ${safeTitle} |`);
    }
  }
  lines.push("");

  lines.push("## Recon rollup (last 7 days)");
  lines.push("");
  lines.push("| Event type | Count |");
  lines.push("|---|---|");
  lines.push(`| \`ReconResult\` | ${digest.reconRollupLast7d.results} |`);
  lines.push(`| \`ReconViolation\` | ${digest.reconRollupLast7d.violations} |`);
  lines.push("");

  lines.push("## Cross-line digest");
  lines.push("");
  lines.push("| Source | Count | Window |");
  lines.push("|---|---|---|");
  lines.push(`| Owen \`GovernanceCyclePrep\` | ${digest.governancePrepLast7d} | last 7 days |`);
  lines.push(
    `| Prior \`AuditCommitteePackPrepped\` | ${digest.priorPacksLast30d} | last 30 days |`,
  );
  lines.push(`| \`WhistleblowingDisclosure\` | ${digest.whistleblowingLast7d} | last 7 days |`);
  lines.push(
    `| \`ExternalAuditorInquiry\` | ${digest.externalAuditorInquiryLast7d} | last 7 days |`,
  );
  lines.push("");

  lines.push("## AC pack readiness");
  lines.push("");
  lines.push(
    "- **Quarterly opinion-pack generator** — _not built_ (substrate gap, `Team/Thandiwe.md` § 16). This weekly digest is the bridging artefact; the formal AC pack is generated, not assembled, once the substrate lands.",
  );
  lines.push(
    "- **Issues-and-actions tracker** — _not built_ (§ 16). Tracking lives in the event store today; quarterly opinion-pack will reduce over the tracker once it exists.",
  );
  lines.push(
    "- **Combined-assurance-map tooling** — _not built_ (§ 16). Coverage gaps surface only via in-session reasoning; the digest above is the seed.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Thandiwe's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Thandiwe's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Replayed `AuditFinding`, `ReconResult`, `ReconViolation`, `GovernanceCyclePrep`, `AuditCommitteePackPrepped`, `WhistleblowingDisclosure`, `ExternalAuditorInquiry` from the host event store. Counts are local to this host until the cross-host event-bus lands (M8).",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const digest = buildDigest(ctx.asOf);

  // Light read on obligations register so the snapshot can record how
  // many third-line-relevant entries exist (Vera's mandate-ownership
  // recon is the formal check; this is a heartbeat).
  const obligationsPath = resolve(ctx.repoRoot, "Regulations", "_obligations-register.md");
  const obligationsContent = existsSync(obligationsPath)
    ? readFileSync(obligationsPath, "utf8")
    : "";
  const thirdLineObligations = countObligationsByOwner(obligationsContent, /Thandiwe|Vera|Audit/i);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "AuditCommitteePackPrepped",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:thandiwe:audit-committee-prep" },
      citations: EVENT_CITATIONS,
      payload: {
        findingsLast7d: digest.findingsLast7d.length,
        highSeverityFindingsLast7d: highSeverityCount(digest.findingsLast7d),
        reconResultsLast7d: digest.reconRollupLast7d.results,
        reconViolationsLast7d: digest.reconRollupLast7d.violations,
        governancePrepLast7d: digest.governancePrepLast7d,
        priorPacksLast30d: digest.priorPacksLast30d,
        whistleblowingLast7d: digest.whistleblowingLast7d,
        externalAuditorInquiryLast7d: digest.externalAuditorInquiryLast7d,
        thirdLineRelevantObligations: thirdLineObligations,
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
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Digest above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: THANDIWE_NARRATIVE_SYSTEM,
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
          "thandiwe:audit-committee-prep — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "thandiwe narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_thandiwe_audit-committee-prep.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, digest, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      findings7d: digest.findingsLast7d.length,
      recon7d: digest.reconRollupLast7d,
      governancePrep7d: digest.governancePrepLast7d,
    },
    "thandiwe:audit-committee-prep — digest built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${digest.findingsLast7d.length} findings (7d, ${highSeverityCount(digest.findingsLast7d)} high) · ${digest.reconRollupLast7d.violations} recon violations · ${digest.governancePrepLast7d} governance prep runs.`,
    ok: true,
  };
};

export default handler;
