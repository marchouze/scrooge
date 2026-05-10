// runtime/agents/vera-codebase-quality-review.ts
//
// Vera's weekly codebase-quality review. Distinct from `vera:overnight-recon`
// (which runs the continuous-controls reconciliation pipelines): this handler
// runs deterministic code-quality heuristics over the prototype source and
// emits a structured deliverable + one `AuditFinding` event per finding.
//
// Why this handler exists — closing Scrooge's per-dispatch cost
// -------------------------------------------------------------
// When Marc asks for a codebase quality review, today such reviews fire
// as Scrooge-coordinated in-session dispatches with a bespoke prompt
// (Principle 7 fallback). That cost falls on Scrooge every week. This
// handler removes the per-dispatch cost for the deterministic-checkable
// subset (any-density, swallowed-errors, legacy-bypass-watch) — i.e.
// the "is the codebase eroding" mechanical signals.
//
// What this handler does NOT do (substrate gap)
// ---------------------------------------------
// LLM-judgment findings — severity classification on contextual code
// smells, principle-violation interpretation, narrative synthesis —
// remain Scrooge-coordinated until handler-LLM-runtime lands. The
// deliverable explicitly states this in its substrate-gaps section.
//
// Authority
// ---------
//   - GOV-FRAMEWORK-CAE-INDEPENDENCE — Vera's mandate authority
//   - D-AGENT-RUNTIME-AUTHORIZE       — the slice's authorising decision (S8)
//   - Principle 7 (autonomous by default)
//
// Author: Atlas (Core banking platform architect, engineering — runtime
// plumbing) · Vera (Internal audit engineer, third-line — recon substance)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { run as runAnyDensity } from "../../platform/recon/code-quality/any-density";
import { run as runLegacyBypassWatch } from "../../platform/recon/code-quality/legacy-bypass-watch";
import { run as runSwallowedErrors } from "../../platform/recon/code-quality/swallowed-errors";
import type { ReconResult, ReconViolation } from "../../platform/recon/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

interface PipelineEntry {
  readonly key: string;
  readonly title: string;
  readonly run: (opts: { rootDir?: string }) => ReconResult;
}

const PIPELINES: readonly PipelineEntry[] = [
  {
    key: "any-density",
    title: "`any` density (per-file count)",
    run: (opts) => runAnyDensity(opts),
  },
  {
    key: "swallowed-errors",
    title: "Swallowed errors (empty catch blocks)",
    run: (opts) => runSwallowedErrors(opts),
  },
  {
    key: "legacy-bypass-watch",
    title: "Legacy permission-gate bypass watch",
    run: () => runLegacyBypassWatch(),
  },
];

/**
 * Citations carried on every emitted `AuditFinding`. Per CLAUDE.md
 * Principle 2 (citation discipline) every event carries typed citations
 * — never bare strings that lack a registry entry.
 */
const EVENT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CAE-INDEPENDENCE",
  "D-AGENT-RUNTIME-AUTHORIZE",
];

const ENTITY = "BANK-ZA-001";

function fmtDateUTC(iso: string): string {
  return iso.slice(0, 10);
}

function severityCount(
  violations: readonly ReconViolation[],
  severity: "info" | "warn" | "fail",
): number {
  return violations.filter((v) => v.severity === severity).length;
}

function citationsForRecon(reconKey: string): readonly string[] {
  // Code-quality findings cite Principle 1 (events-are-truth) when the
  // finding bears on the audit trail (swallowed errors, legacy bypass
  // — both touch the event store's promise of completeness). The
  // any-density finding cites Principle 4 (security designed in, of
  // which strong typing is a leg).
  switch (reconKey) {
    case "swallowed-errors":
      return [...EVENT_CITATIONS, "PRINCIPLE-1-EVENTS-AS-TRUTH"];
    case "legacy-bypass-watch":
      return [...EVENT_CITATIONS, "PRINCIPLE-1-EVENTS-AS-TRUTH"];
    case "any-density":
      return [...EVENT_CITATIONS, "PRINCIPLE-4-SECURITY-DESIGNED-IN"];
    default:
      return EVENT_CITATIONS;
  }
}

function emitAuditFindingEvents(ctx: AgentRunContext, result: ReconResult): number {
  if (ctx.dryRun) return 0;
  // Emit one AuditFinding per warn / fail violation. Info-severity rows
  // are aggregate heartbeat lines — they're rendered into the deliverable
  // but do not need an event-per-row (the run itself is the heartbeat).
  const ofInterest = result.violations.filter((v) => v.severity !== "info");
  const citations = citationsForRecon(result.pipeline.replace(/^code-quality:/, ""));
  for (const v of ofInterest) {
    eventStore.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: ctx.asOf,
      entity: ENTITY,
      actor: { type: "service", id: "agent:vera:codebase-quality-review" },
      citations: [...citations],
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
  return ofInterest.length;
}

function buildReportMarkdown(ctx: AgentRunContext, results: readonly ReconResult[]): string {
  const date = fmtDateUTC(ctx.asOf);
  const totalAsserted = results.reduce((s, r) => s + r.asserted, 0);
  const totalFails = results.reduce((s, r) => s + severityCount(r.violations, "fail"), 0);
  const totalWarns = results.reduce((s, r) => s + severityCount(r.violations, "warn"), 0);
  const totalInfos = results.reduce((s, r) => s + severityCount(r.violations, "info"), 0);

  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: Codebase quality review — ${date}`);
  lines.push("author: Vera (Internal audit engineer, third-line)");
  lines.push(`date: ${date}`);
  lines.push(
    `summary: ${results.length} recons run; ${totalFails} fail / ${totalWarns} warn / ${totalInfos} info findings across ${totalAsserted} assertions.`,
  );
  lines.push("decision-required: false");
  lines.push("authority: GOV-FRAMEWORK-CAE-INDEPENDENCE");
  lines.push("---");
  lines.push("");
  lines.push(`# Codebase quality review — ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Vera's code-quality recons under the `vera:codebase-quality-review` weekly handler. Distinct from the overnight continuous-controls recon — this slice is the deterministic-checkable subset of code review.",
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Recons run: ${results.length}`);
  lines.push(`- Assertions: ${totalAsserted}`);
  lines.push(`- Fail findings: ${totalFails}`);
  lines.push(`- Warn findings: ${totalWarns}`);
  lines.push(`- Info findings: ${totalInfos}`);
  lines.push("");
  lines.push("| Recon | Asserted | Fail | Warn | Info |");
  lines.push("|---|---|---|---|---|");
  for (const r of results) {
    const fails = severityCount(r.violations, "fail");
    const warns = severityCount(r.violations, "warn");
    const infos = severityCount(r.violations, "info");
    lines.push(`| ${r.pipeline} | ${r.asserted} | ${fails} | ${warns} | ${infos} |`);
  }
  lines.push("");

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
  // Always list info-severity rows under a heartbeat heading so the
  // deliverable carries the codebase-wide tally even when no warn/fail
  // findings were emitted.
  lines.push("## Heartbeat (info-severity)");
  lines.push("");
  for (const r of results) {
    const infos = r.violations.filter((v) => v.severity === "info");
    if (infos.length === 0) continue;
    for (const v of infos) {
      lines.push(`- \`${r.pipeline}\` — ${v.message}`);
    }
  }
  lines.push("");

  lines.push("## Substrate gaps surfaced");
  lines.push("");
  lines.push(
    "**LLM-judgment findings remain Scrooge-coordinated until handler-LLM-runtime lands.** Today's recurring run covers the deterministic-checkable subset only — `any` density, swallowed errors, and the legacy permission-gate bypass count. The contextual judgment piece (which `any` is a justified boundary vs lazy escape; which empty `catch` is best-effort vs swallowed; which design choice violates which principle) needs an LLM in the handler. The big LLM-in-handler primitive is out of scope for this slice; flagging here so the gap is tracked, not hidden.",
  );
  lines.push("");
  lines.push(
    "Recurring substrate gaps observed when the run runs at all: a fresh repo / fresh runner has no `.local/event.db`, so Vera's run-coupled handler emits its `AuditFinding` events into the per-process tmp store and the dashboard does not see them until the cloud-substrate (M8 Container App Jobs + per-event-source persistent store) lands.",
  );
  lines.push("");

  lines.push("## Substrate");
  lines.push("");
  lines.push(`Recons invoked: ${PIPELINES.map((p) => `\`${p.key}\``).join(", ")}.`);
  lines.push("");
  lines.push(
    "Events emitted: one `AuditFinding` per warn/fail finding (info-severity heartbeat rows are rendered into the deliverable, not emitted as events).",
  );
  lines.push("");
  lines.push(
    "Routing: warn-severity code-quality findings recommend owner `Thandiwe` (CAE) per Vera spec § 9 — they are tracked but do not escalate unless they cluster. Fail-severity (substrate-broken) findings would route immediately; none expected from this recon set.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const results: ReconResult[] = [];
  let runErrors = 0;

  // The handler runs against `<repoRoot>/prototype/` — the recon modules
  // default to scanning their own ancestor `prototype/` dir, so we do not
  // need to pass `rootDir` in production. Tests can override via
  // `BANK_REPO_ROOT` (see runtime/run.ts).
  const rootDir = resolve(ctx.repoRoot, "prototype");

  for (const p of PIPELINES) {
    try {
      const r = p.run({ rootDir });
      results.push(r);
      logger.debug(
        {
          pipeline: r.pipeline,
          ok: r.ok,
          asserted: r.asserted,
          violations: r.violations.length,
        },
        `vera:codebase-quality-review — ${p.key} done`,
      );
    } catch (e) {
      runErrors++;
      const msg = (e as Error).message;
      logger.error({ pipeline: p.key, err: msg }, `vera:codebase-quality-review — ${p.key} threw`);
      results.push({
        pipeline: `code-quality:${p.key}`,
        ok: false,
        asserted: 0,
        violations: [{ subject: p.key, message: `recon threw: ${msg}`, severity: "fail" }],
        asOf: ctx.asOf,
      });
    }
  }

  let eventsEmitted = 0;
  for (const r of results) {
    eventsEmitted += emitAuditFindingEvents(ctx, r);
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_vera_codebase-quality-review.md`;
    const path = resolve(ctx.ownerInboxDir, filename);
    writeFileSync(path, buildReportMarkdown(ctx, results), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  const totalFails = results.reduce((s, r) => s + severityCount(r.violations, "fail"), 0);
  const totalWarns = results.reduce((s, r) => s + severityCount(r.violations, "warn"), 0);
  const ok = runErrors === 0 && totalFails === 0;

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary:
      ok && totalWarns === 0
        ? `${results.length} recons clean; 0 findings.`
        : `${results.length} recons run; ${totalFails} fail / ${totalWarns} warn findings.`,
    ok,
  };
};

export default handler;
