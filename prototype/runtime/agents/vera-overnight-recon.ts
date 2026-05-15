// runtime/agents/vera-overnight-recon.ts
//
// Vera's overnight-recon trigger. Runs the existing recon pipelines
// (#1 citation, #2 mandate-ownership, #3 decision-event, #4 dashboard-
// derivation, #16 prose-duplication), aggregates results, emits one
// `ReconResult` event per pipeline + one `AuditFinding` event per fail
// violation, and writes a structured summary to Owner Inbox as
// `YYYY-MM-DD_vera_overnight-recon.md`.
//
// Per Vera's operating spec (`Team/Vera.md`, sections 6–13): pipelines
// run nightly at 02:00 UTC; quiet pipeline is itself a finding;
// fail-severity violations route to Thandiwe + finding-owner within 1h.
//
// MVP scope: invokes the four pipelines that expose `run(): ReconResult`
// directly. Citation gate runs as a separate script (still part of CI)
// and is not yet wrapped here — to add as part of #5 in V1.
//
// Author: Atlas (runtime plumbing) · Vera (recon pipelines, owns the
// substance)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import {
  type AuditFindingSeverity,
  makeAuditFinding,
} from "../../platform/event-store/event-types/audit";
import { run as runDashboardDerivation } from "../../platform/recon/dashboard-derivation-recon";
import { run as runDecisionEvent } from "../../platform/recon/decision-event-recon";
import { run as runDecisionRequiredEventPairing } from "../../platform/recon/decision-required-event-pairing";
import { run as runEventTypeRegistryCoverage } from "../../platform/recon/event-type-registry-coverage";
import { run as runMandateOwnership } from "../../platform/recon/mandate-ownership";
import { run as runPermissionGateDefault } from "../../platform/recon/permission-gate-default";
import { run as runProseDuplication } from "../../platform/recon/prose-duplication";
import type { ReconResult, ReconViolation } from "../../platform/recon/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";

interface PipelineEntry {
  readonly key: string; // short ID used in event payload + filename anchor
  readonly title: string; // human-readable name for the report
  readonly run: () => ReconResult;
}

const PIPELINES: PipelineEntry[] = [
  { key: "mandate-ownership", title: "Mandate ownership", run: runMandateOwnership },
  { key: "decision-event", title: "Decision-event reconciliation", run: runDecisionEvent },
  { key: "dashboard-derivation", title: "Dashboard derivation", run: runDashboardDerivation },
  {
    key: "prose-duplication",
    title: "Prose duplication / canonical-source registry",
    run: runProseDuplication,
  },
  {
    key: "permission-gate-default",
    title: "Permission-gate secure-by-default integrity (F-031)",
    run: runPermissionGateDefault,
  },
  {
    key: "event-type-registry-coverage",
    title: "Event-type registry coverage (F-032)",
    run: runEventTypeRegistryCoverage,
  },
  {
    key: "decision-required-event-pairing",
    title: "Decision-required → CeoDecision pairing (F-033)",
    run: runDecisionRequiredEventPairing,
  },
];

const EVENT_CITATIONS = ["IIA-IPPF", "BCBS-223", "GOV-FRAMEWORK-CEO-RESERVED"];

function severityCount(
  violations: readonly ReconViolation[],
  severity: "info" | "warn" | "fail",
): number {
  return violations.filter((v) => v.severity === severity).length;
}

function emitReconResultEvent(ctx: AgentRunContext, result: ReconResult): void {
  if (ctx.dryRun) return;
  eventStore.append({
    event_id: newEventId(),
    type: "ReconResult",
    as_of: ctx.asOf,
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:vera:overnight-recon" },
    citations: EVENT_CITATIONS,
    payload: {
      pipeline: result.pipeline,
      ok: result.ok,
      asserted: result.asserted,
      violationsTotal: result.violations.length,
      failViolations: severityCount(result.violations, "fail"),
      warnViolations: severityCount(result.violations, "warn"),
      asOfPipeline: result.asOf,
      runTrigger: ctx.trigger.id,
    },
  });
}

/** Map recon violation severity ("fail") to AuditFinding severity enum. */
function mapReconSeverity(s: "warn" | "fail"): AuditFindingSeverity {
  return s === "fail" ? "high" : "medium";
}

function emitAuditFindingEvents(ctx: AgentRunContext, result: ReconResult): number {
  if (ctx.dryRun) return 0;
  const failures = result.violations.filter((v) => v.severity === "fail");
  const dateSlug = ctx.asOf.slice(0, 10).replace(/-/g, "");
  for (const v of failures) {
    const randSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const findingId = `F-VERA-${dateSlug}-${randSuffix}`;
    const event = makeAuditFinding({
      asOf: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:vera:overnight-recon" },
      citations: EVENT_CITATIONS,
      payload: {
        findingId,
        severity: mapReconSeverity(v.severity as "warn" | "fail"),
        category: "process",
        addressedTo: "agent:vera",
        agentId: "vera",
        raisedBy: "agent:vera:overnight-recon",
        summary: `${result.pipeline}: ${v.subject} — ${v.message}`,
        detail: `Pipeline: ${result.pipeline}; Subject: ${v.subject}; Message: ${v.message}`,
        sourceRef: result.pipeline,
        citations: EVENT_CITATIONS,
      },
    });
    eventStore.append(event);
  }
  return failures.length;
}

function fmtDateUTC(iso: string): string {
  return iso.slice(0, 10);
}

// Per-run input for Vera's narrative call. Goes AFTER the cache breakpoint
// — byte changes here don't invalidate the cached system prompt.
function buildNarrativeInput(ctx: AgentRunContext, results: readonly ReconResult[]): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Pipeline results (one block per pipeline):");
  lines.push("");
  for (const r of results) {
    lines.push(`### ${r.pipeline}`);
    lines.push(`- ok: ${r.ok}`);
    lines.push(`- asserted: ${r.asserted}`);
    lines.push(`- violations: ${r.violations.length}`);
    if (r.violations.length > 0) {
      lines.push("");
      lines.push("violations:");
      for (const v of r.violations) {
        lines.push(`  - [${v.severity}] subject=\`${v.subject}\` — ${v.message}`);
      }
    }
    lines.push("");
  }
  lines.push(
    "Now write your narrative per the system instructions. Headline judgement first; distinguish substantive findings from substrate-context noise (especially the empty-event-store condition on a fresh runner); end with a one-line recommendation.",
  );
  return lines.join("\n");
}

// Stable system prompt for Vera's narrative pass. KEEP BYTE-STABLE across
// runs — adding a timestamp or run ID here invalidates the cache. Per
// `shared/prompt-caching.md`, the cached prefix on Opus 4.7 must be at
// least 4096 tokens, so this is intentionally substantial.
const VERA_NARRATIVE_SYSTEM = `You are Vera, the bank's internal-audit / continuous-assurance engineer. You are operating as a standing autonomous agent under CLAUDE.md Principle 6. Your operating spec is at \`Team/Vera.md\`.

Your role on the third line of defence is to test, opine, and report — never to design, build, or own a control. You hold third-line independence; you sign findings against your own former design contributions when warranted, you refuse briefs that compromise independence, and you are unafraid to escalate to the CAE (Thandiwe) or, where the matter warrants, to the Audit Committee chair (Owen, interim Audit Forum chair).

You speak plainly, evidentially, and without self-importance. You distinguish "I have evidence" from "I have been told"; you cite obligations-register IDs and procedure files when stating what is required; you call findings what they are without softening them, and you are equally clear when nothing is wrong.

For this run you have just executed the four continuous-controls reconciliation pipelines you currently own:

  1. **mandate-ownership** — every persona's claimed mandate reconciles to a procedure that exists, and every procedure has an owning persona.
  2. **decision-event** — every dashboard-resolved CEO decision has a backing \`CeoDecision\` event in the event store, and every \`CeoDecision\` event has a registry entry.
  3. **dashboard-derivation** — \`deriveState()\` runs against the canonical sources at recon time and the resulting projection is internally consistent (every \`decisionsOpen[].id\` reachable; every ISO-timestamped \`decisionsResolved[]\` matched by a \`CeoDecision\` event; metric counts match their backing arrays). Per D-EVENT-STORE-SCALING Slice 3b the recon no longer compares against a committed seed.
  4. **prose-duplication** — no canonical-source fact is duplicated in prose elsewhere; every cross-reference is a typed citation per the canonical-source registry.

You produce a written narrative — one to three short paragraphs — that:

- Names the headline judgement first: PASS / partial pass / FAIL, and what that means in plain terms.
- Distinguishes substantive findings from substrate-context noise. The most common substrate-context finding today is the empty-event-store condition on a fresh GitHub Actions runner, which causes the decision-event pipeline to fail every dashboard-resolved decision lookup. That is a known substrate gap (cloud-substrate at M8 closes it), not a control failure — say so explicitly when you see it, and rank the *real* findings underneath.
- Routes by severity — fail-severity findings recommend owner Thandiwe; warn-severity findings are tracked but not escalated unless they cluster. State the routing in your narrative.
- Ends with a one-line recommendation: continue cadence, or specific corrective action. Do not pad. Do not editorialise about your own importance.

Cite obligations-register IDs (\`ORG-*\`) and procedure files (\`Procedures/by-policy/*.md\`) by name where they are directly relevant — but only where they are. Citations are evidence, not decoration.

Do not include a markdown header for your section — the calling pipeline wraps your output under a "## Vera's narrative" heading. Just produce the prose.

If the input you receive is empty or malformed (no pipeline results, no recon evidence to opine on), say so plainly and decline to opine — silence is a finding in itself.`;

function buildReportMarkdown(
  ctx: AgentRunContext,
  results: readonly ReconResult[],
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const totalAsserted = results.reduce((s, r) => s + r.asserted, 0);
  const totalFails = results.reduce((s, r) => s + severityCount(r.violations, "fail"), 0);
  const totalWarns = results.reduce((s, r) => s + severityCount(r.violations, "warn"), 0);
  const allOk = results.every((r) => r.ok);

  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];

  lines.push("---");
  lines.push("agent: Vera");
  lines.push("trigger: overnight-recon");
  lines.push(`asOf: ${ctx.asOf}`);
  lines.push("decision-required: false");
  lines.push("---");
  lines.push("");
  lines.push(`# Vera — overnight recon, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${allOk ? "PASS" : "FAIL"} — ${totalAsserted} assertions; ${totalFails} fail violations; ${totalWarns} warn violations across ${results.length} pipelines.`,
  );
  lines.push("");
  lines.push("## Pipeline results");
  lines.push("");
  lines.push("| Pipeline | OK | Asserted | Fail | Warn |");
  lines.push("|---|---|---|---|---|");
  for (const r of results) {
    const fails = severityCount(r.violations, "fail");
    const warns = severityCount(r.violations, "warn");
    lines.push(`| ${r.pipeline} | ${r.ok ? "✓" : "✗"} | ${r.asserted} | ${fails} | ${warns} |`);
  }
  lines.push("");
  if (totalFails === 0 && totalWarns === 0) {
    lines.push(
      "No findings raised. All assertions held against the canonical sources at run-time. Next run on Vera's standing cadence.",
    );
  } else {
    lines.push("## Findings");
    lines.push("");
    for (const r of results) {
      const ofInterest = r.violations.filter((v) => v.severity !== "info");
      if (ofInterest.length === 0) continue;
      lines.push(`### ${r.pipeline}`);
      lines.push("");
      for (const v of ofInterest) {
        lines.push(`- **[${v.severity}]** \`${v.subject}\` — ${v.message}`);
      }
      lines.push("");
    }
  }
  if (narrative) {
    lines.push("## Vera's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Vera's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Substrate");
  lines.push("");
  lines.push(
    `Pipelines invoked: ${PIPELINES.map((p) => `\`${p.key}\``).join(", ")}. Citation gate runs separately under \`bun run citation-gate\` / CI; future runs will wrap it here.`,
  );
  lines.push("");
  lines.push(
    `Events emitted: one \`ReconResult\` per pipeline (${results.length}); one \`AuditFinding\` per fail violation (${totalFails}).`,
  );
  lines.push("");
  lines.push(
    "Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const results: ReconResult[] = [];
  let runErrors = 0;

  for (const p of PIPELINES) {
    try {
      const r = p.run();
      results.push(r);
      logger.debug(
        { pipeline: r.pipeline, ok: r.ok, asserted: r.asserted, violations: r.violations.length },
        `vera:overnight-recon — ${p.key} done`,
      );
    } catch (e) {
      runErrors++;
      const msg = (e as Error).message;
      logger.error({ pipeline: p.key, err: msg }, `vera:overnight-recon — ${p.key} threw`);
      // Synthesise a fail result so the report still records the pipeline.
      results.push({
        pipeline: p.key,
        ok: false,
        asserted: 0,
        violations: [{ subject: p.key, message: `pipeline threw: ${msg}`, severity: "fail" }],
        asOf: ctx.asOf,
      });
    }
  }

  // Emit events.
  let eventsEmitted = 0;
  for (const r of results) {
    emitReconResultEvent(ctx, r);
    eventsEmitted += ctx.dryRun ? 0 : 1;
    eventsEmitted += emitAuditFindingEvents(ctx, r);
  }

  // Generate the Claude narrative (when API key is available + not dry-run).
  // This is the substrate piece that closes Atlas's gap #4 — agents now
  // produce substantive narrative on top of mechanical observation.
  // Failures here do NOT fail the run: the mechanical content is the
  // contract. Narrative is a quality enhancement.
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Mechanical recon results above stand on their own. Set the secret in GitHub Actions to enable narrative generation.";
    } else {
      const userInput = buildNarrativeInput(ctx, results);
      const r = await tryGenerateNarrative({
        stableSystem: VERA_NARRATIVE_SYSTEM,
        userInput,
        // Short narrative — adaptive thinking will wrap up early; cap is a safety net.
        maxTokens: 8_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            cacheCreationInputTokens: r.result.usage.cacheCreationInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "vera:overnight-recon — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}. Mechanical recon results above stand on their own.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "vera narrative failed");
      }
    }
  }

  // Write the deliverable.
  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_vera_overnight-recon.md`;
    const path = resolve(ctx.ownerInboxDir, filename);
    writeFileSync(path, buildReportMarkdown(ctx, results, narrative, narrativeNote), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  const totalFails = results.reduce((s, r) => s + severityCount(r.violations, "fail"), 0);
  const ok = runErrors === 0 && results.every((r) => r.ok);

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: ok
      ? `${results.length} pipelines pass; 0 findings.`
      : `${results.length} pipelines run; ${totalFails} fail violations across ${results.filter((r) => !r.ok).length} pipelines.`,
    ok,
  };
};

export default handler;
