// platform/recon/sla-approval-workflow.ts
//
// Recon pipeline: recon:sla-approval-workflow
//
// The SLA rule approval-workflow gate (Phase-0 design spec §9.3; D-SLA-ENGINE-
// RULES-AS-DATA Phase 4c). Enforces Owen's five segregation-of-duties controls
// in retrospect (control v — "enforced by recon, not aspirational"). Three
// assertions over real state (the committed rule registry + the live event
// store):
//
//   (a) APPROVAL-COVERAGE (four-eyes, Owen control i+ii):
//       every interpreter-ELIGIBLE rule/version (production basis = the
//       activated `PRODUCTION_REPRESENTATIONS`) carries a matching
//       SlaRuleApproved whose approver ≠ publisher (grandfathers count). A rule
//       on the production path with no four-eyes approval is a control failure —
//       it could not legitimately post. Self-approvals / dangling approvals are
//       surfaced as defects (they never make a rule eligible — the gate already
//       drops them; the recon makes the attempt visible).
//
//   (b) REPRESENTATION-ACTIVATION JOINT-APPROVAL (D-SLA-REPRESENTATION-
//       ACTIVATION-JOINT-APPROVAL): any ACTIVATED non-IFRS representation in
//       `PRODUCTION_REPRESENTATIONS` requires BOTH a CFO approved `Decision` AND
//       a CoSec approved `Decision` present in the store. SARB-BA-RETURN is NOT
//       activated in Phase 4c, so this asserts the RULE: the moment a non-IFRS
//       representation is added to the production path, the CFO+CoSec pair must
//       already be on the log — otherwise the activation is an unsanctioned
//       change.
//
//   (c) VERSIONING (composed, spec §6): the 4b window-integrity + supersedes
//       integrity recon is composed here so the approval gate and the version
//       lineage are asserted together (an approval references a rule/version;
//       the version lineage must itself be gap-free / overlap-free).
//
// Mode: blocking (non-zero exit on any violation).
//
// Empty-state correctness: a fresh CI store with NO approval events ⇒ NO rule is
// eligible ⇒ (a) is vacuously clean (the gate is loud-by-absence, not a silent
// pass: an ungated production run with no grandfathers would reject every FX
// posting — that loudness lives in the engine, not here). (b) is vacuous while
// production is IFRS-only. (c) always asserts over the committed registry.
//
// Wired into `bun run ci:recon:domain` via `bun run recon:sla-approval-workflow`.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c, CEO-approved 2026-06-06);
//            D-SLA-APPROVAL-WORKFLOW-SEGREGATION (CoSec Owen — the 5 controls);
//            D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL (CoSec — CFO+CoSec joint).
// Citations: Principles/1-events-are-truth.md, Principles/6-autonomous-by-default.md.

import {
  type ApprovalCorpus,
  PRODUCTION_REPRESENTATIONS,
  computeEligibility,
  ruleApprovalKey,
} from "../accounting/sla/approval";
import { loadApprovalCorpus } from "../accounting/sla/approval-loader";
import type { SlaRule } from "../accounting/sla/generated/sla-types";
import { ALL_SLA_RULES } from "../accounting/sla/rules/all-rules";
import { withinEffectiveWindow } from "../accounting/sla/versioning";
import { eventStore } from "../composition";
import { nowUtc } from "../core/types";
import { run as runVersioning } from "./sla-rule-versioning";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:sla-approval-workflow";

/** A CFO/CoSec approved Decision marker (for the joint-approval check). */
interface ApprovedDecision {
  readonly authority: string;
}

export interface RunOpts {
  /** Override the rule registry (test injection). */
  rules?: readonly SlaRule[];
  /** Override the approval corpus (test injection); bypasses the event store. */
  corpus?: ApprovalCorpus;
  /** Override the activated production representations (test injection). */
  productionRepresentations?: readonly string[];
  /** Override the set of approved Decisions (test injection). */
  approvedDecisions?: readonly ApprovedDecision[];
}

/** Load approval events from the store, in append order, as a corpus. */
function loadCorpusFromStore(): ApprovalCorpus {
  try {
    const events = [
      ...eventStore.replay({ type: "SlaRulePublished" }),
      ...eventStore.replay({ type: "SlaRuleApproved" }),
      ...eventStore.replay({ type: "SlaRuleWithheld" }),
    ];
    return loadApprovalCorpus(events);
  } catch {
    return { published: [], decisions: [] };
  }
}

/** Load approved CFO/CoSec Decisions from the store. */
function loadApprovedDecisions(): ApprovedDecision[] {
  const out: ApprovedDecision[] = [];
  try {
    for (const e of eventStore.replay({ type: "Decision" })) {
      const p = (e.payload ?? {}) as { phase?: unknown; authority?: unknown };
      if (p.phase === "approved" && typeof p.authority === "string") {
        out.push({ authority: p.authority });
      }
    }
  } catch {
    // Event store not available — vacuous.
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const rules = opts.rules ?? ALL_SLA_RULES;
  const corpus = opts.corpus ?? loadCorpusFromStore();
  const productionReps = opts.productionRepresentations ?? PRODUCTION_REPRESENTATIONS;

  const { eligible, defects } = computeEligibility(corpus);

  // ── (a) approval-coverage: every production-path rule has a four-eyes approval ──
  // The production basis is the rules whose representation is activated. We
  // assert each such rule version that is CURRENTLY in force (its window is open
  // at "today") is eligible — i.e. carries a four-eyes approval. Rules of a
  // non-activated representation (e.g. SARB-BA-RETURN in Phase 4c) are out of
  // scope of (a): they are dry-run only and deliberately ungated/ineligible.
  const today = nowUtc().slice(0, 10);
  const productionRuleVersions = rules.filter(
    (r) => productionReps.includes(r.representation) && withinEffectiveWindow(r, today),
  );
  for (const r of productionRuleVersions) {
    result.asserted += 1;
    const key = ruleApprovalKey(r);
    if (!eligible.has(key)) {
      violations.push({
        subject: key,
        message: `in-force ${r.representation} rule ${r.rule_id}@v${r.version} is on the production path but is NOT interpreter-eligible — it lacks a four-eyes SlaRuleApproved (approver ≠ publisher). Seed a grandfather approval (build-phase) or obtain a real approval before it can post (Owen control i+ii; D-SLA-APPROVAL-WORKFLOW-SEGREGATION).`,
        severity: "fail",
      });
    }
  }

  // Surface rejected approvals (self-approval / dangling) as defects — they
  // never made a rule eligible, but the ATTEMPT must be visible (Owen control i).
  for (const d of defects) {
    violations.push({
      subject: d.key,
      message: `rejected approval: ${d.reason} (Owen control i — no self-approval; D-SLA-APPROVAL-WORKFLOW-SEGREGATION)`,
      severity: "fail",
    });
  }

  // ── (b) representation-activation joint approval (CFO + CoSec) ──
  const approvedDecisions = opts.approvedDecisions ?? loadApprovedDecisions();
  const hasCfo = approvedDecisions.some((d) => d.authority === "CFO");
  const hasCoSec = approvedDecisions.some((d) => d.authority === "CoSec");
  for (const rep of productionReps) {
    result.asserted += 1;
    if (rep === "IFRS") continue; // the primary basis needs no activation Decision
    if (!hasCfo || !hasCoSec) {
      const missing = [!hasCfo ? "CFO" : null, !hasCoSec ? "CoSec" : null]
        .filter(Boolean)
        .join(" + ");
      violations.push({
        subject: `representation:${rep}`,
        message: `non-IFRS representation '${rep}' is ACTIVATED in the production path but the joint-approval requirement is unmet: missing ${missing} approved Decision. D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL requires BOTH a CFO Decision AND a CoSec Decision before a parallel basis goes live.`,
        severity: "fail",
      });
    }
  }

  // ── (c) compose the 4b versioning recon ──
  const versioning = runVersioning(opts.rules ? { rules: opts.rules } : {});
  result.asserted += versioning.asserted;
  for (const v of versioning.violations) {
    violations.push({
      subject: `versioning:${v.subject}`,
      message: `[composed recon:sla-rule-versioning] ${v.message}`,
      severity: v.severity,
    });
  }

  if (violations.some((v) => v.severity === "fail")) {
    result.ok = false;
  }
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  const result = run();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
