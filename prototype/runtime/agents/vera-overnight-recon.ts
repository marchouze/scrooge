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
import { run as runDashboardDerivation } from "../../platform/recon/dashboard-derivation-recon";
import { run as runDecisionEvent } from "../../platform/recon/decision-event-recon";
import { run as runMandateOwnership } from "../../platform/recon/mandate-ownership";
import { run as runProseDuplication } from "../../platform/recon/prose-duplication";
import type { ReconResult, ReconViolation } from "../../platform/recon/types";
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
  { key: "prose-duplication", title: "Prose duplication / canonical-source registry", run: runProseDuplication },
];

const EVENT_CITATIONS = ["IIA-IPPF", "BCBS-223", "GOV-FRAMEWORK-CEO-RESERVED"];

function severityCount(violations: readonly ReconViolation[], severity: "info" | "warn" | "fail"): number {
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

function emitAuditFindingEvents(ctx: AgentRunContext, result: ReconResult): number {
  if (ctx.dryRun) return 0;
  const failures = result.violations.filter((v) => v.severity === "fail");
  for (const v of failures) {
    eventStore.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:vera:overnight-recon" },
      citations: EVENT_CITATIONS,
      payload: {
        pipeline: result.pipeline,
        subject: v.subject,
        message: v.message,
        severity: v.severity,
        recommendedOwner: "Thandiwe",
        runTrigger: ctx.trigger.id,
      },
    });
  }
  return failures.length;
}

function fmtDateUTC(iso: string): string {
  return iso.slice(0, 10);
}

function buildReportMarkdown(ctx: AgentRunContext, results: readonly ReconResult[]): string {
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
  lines.push("## Substrate");
  lines.push("");
  lines.push(
    "Pipelines invoked: " +
      PIPELINES.map((p) => `\`${p.key}\``).join(", ") +
      ". Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.",
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

  // Write the deliverable.
  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_vera_overnight-recon.md`;
    const path = resolve(ctx.ownerInboxDir, filename);
    writeFileSync(path, buildReportMarkdown(ctx, results), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  const totalFails = results.reduce((s, r) => s + severityCount(r.violations, "fail"), 0);
  const ok = runErrors === 0 && results.every((r) => r.ok);

  return {
    eventsEmitted,
    deliverable,
    summary: ok
      ? `${results.length} pipelines pass; 0 findings.`
      : `${results.length} pipelines run; ${totalFails} fail violations across ${results.filter((r) => !r.ok).length} pipelines.`,
    ok,
  };
};

export default handler;
