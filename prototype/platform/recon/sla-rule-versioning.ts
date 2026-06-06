// platform/recon/sla-rule-versioning.ts
//
// Recon pipeline: recon:sla-rule-versioning
//
// The SLA rule-versioning + temporal-reproducibility gate (Phase-0 design spec
// §6 / §10; D-SLA-ENGINE-RULES-AS-DATA Phase 4b deliverable 5). Three
// assertions, all over real state (the committed rule registry + the live event
// store):
//
//   (a) REGISTRY-INTEGRITY (supersede-never-edit, spec §6.1):
//       per (representation, rule_id) lineage, effective windows are GAP-FREE +
//       OVERLAP-FREE with monotonic, contiguous versions. A non-final version
//       must be closed (`effective_to` non-null); consecutive windows must abut
//       (`prev.effective_to === next.effective_from`). This is the supersede-only
//       discipline asserted structurally — an in-place edit that shifts a window
//       without minting a new abutting version shows up as a gap or overlap.
//
//   (b) SUPERSEDES-INTEGRITY (spec §6.1):
//       every `supersedes: "<rule_id>@<n>"` reference resolves to a real prior
//       version in the SAME lineage with version `n = this.version - 1`, and a
//       version > 1 MUST carry a `supersedes` (no orphaned successor).
//
//   (c) POSTED-VERSION-EXISTS (temporal reproducibility, spec §6.3):
//       every `ruleVersion` stamped on a `SubLedgerPostingEmitted` event resolves
//       to a real (rule_id, version) in the registry. A posting that cites a rule
//       version that no longer exists cannot be reproduced — a Principle-1
//       audit-trail break. Postings WITHOUT a `ruleId`/`ruleVersion` (legacy
//       pre-cutover events) are out-of-scope (the additivity guarantee, spec
//       §2.2: no backfill required).
//
// Mode: blocking (non-zero exit on any violation).
//
// Empty-state correctness: no postings in the store (fresh CI store) → (c) is
// vacuous; (a)+(b) still assert over the committed registry (always non-empty).
//
// Wired into `bun run ci:recon:domain` via `bun run recon:sla-rule-versioning`.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4b, CEO-approved 2026-06-06).
// Citations: Principles/1-events-are-truth.md, Principles/2-single-graph-discipline.md.

import type { SlaRule } from "../accounting/sla/generated/sla-types";
import { ALL_SLA_RULES } from "../accounting/sla/rules/all-rules";
import {
  analyzeWindowIntegrity,
  findRuleVersion,
  parseRuleVersionRef,
} from "../accounting/sla/versioning";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:sla-rule-versioning";

interface PostedRuleRef {
  readonly eventId: string;
  readonly representation: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
}

export interface RunOpts {
  /** Override the rule registry (test injection). */
  rules?: readonly SlaRule[];
  /** Override the posted rule refs (test injection); bypasses the event store. */
  postedRefs?: readonly PostedRuleRef[];
}

/** Collect every (ruleId, ruleVersion) stamped on a SubLedgerPostingEmitted. */
function loadPostedRefs(override?: readonly PostedRuleRef[]): PostedRuleRef[] {
  if (override) return [...override];
  const refs: PostedRuleRef[] = [];
  try {
    for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
      const p = (e.payload ?? {}) as {
        ruleId?: unknown;
        ruleVersion?: unknown;
        representation?: unknown;
      };
      // Legacy postings carry no rule lineage — out of scope (additivity, §2.2).
      if (typeof p.ruleId !== "string" || typeof p.ruleVersion !== "number") continue;
      refs.push({
        eventId: e.event_id,
        representation: typeof p.representation === "string" ? p.representation : "IFRS",
        ruleId: p.ruleId,
        ruleVersion: p.ruleVersion,
      });
    }
  } catch {
    // Event store not available — vacuous (CI empty-state convention).
  }
  return refs;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const rules = opts.rules ?? ALL_SLA_RULES;

  // ── (a) Registry window-integrity: gap-free + overlap-free per lineage ──
  const defects = analyzeWindowIntegrity(rules);
  for (const d of defects) {
    violations.push({
      subject: d.lineage,
      message: `[window-${d.kind}] ${d.detail}`,
      severity: "fail",
    });
  }
  result.asserted += rules.length;

  // ── (b) supersedes-integrity ──
  for (const r of rules) {
    if (r.version > 1 && r.supersedes == null) {
      violations.push({
        subject: `${r.representation}::${r.rule_id}@${r.version}`,
        message: `version ${r.version} has no 'supersedes' reference — a successor version must cite the version it replaces (supersede-never-edit, spec §6.1)`,
        severity: "fail",
      });
      continue;
    }
    if (r.supersedes == null) continue;
    const parsed = parseRuleVersionRef(r.supersedes);
    if (!parsed) {
      violations.push({
        subject: `${r.representation}::${r.rule_id}@${r.version}`,
        message: `malformed 'supersedes' reference '${r.supersedes}' (expected <rule_id>@<version>)`,
        severity: "fail",
      });
      continue;
    }
    if (parsed.ruleId !== r.rule_id) {
      violations.push({
        subject: `${r.representation}::${r.rule_id}@${r.version}`,
        message: `'supersedes' references a DIFFERENT rule_id '${parsed.ruleId}' — a supersession stays within one lineage (same rule_id)`,
        severity: "fail",
      });
    }
    if (parsed.version !== r.version - 1) {
      violations.push({
        subject: `${r.representation}::${r.rule_id}@${r.version}`,
        message: `'supersedes' cites version ${parsed.version} but this is version ${r.version} — a successor must supersede the immediately-prior version (${r.version - 1})`,
        severity: "fail",
      });
    }
    const prior = findRuleVersion(rules, r.rule_id, r.version - 1, r.representation);
    if (!prior) {
      violations.push({
        subject: `${r.representation}::${r.rule_id}@${r.version}`,
        message: `'supersedes' cites ${r.supersedes} but no such prior version exists in the registry`,
        severity: "fail",
      });
    }
  }

  // ── (c) every posted ruleVersion exists in the registry ──
  const postedRefs = loadPostedRefs(opts.postedRefs);
  for (const ref of postedRefs) {
    result.asserted += 1;
    const found = findRuleVersion(rules, ref.ruleId, ref.ruleVersion, ref.representation);
    if (!found) {
      violations.push({
        subject: `posting:${ref.eventId}`,
        message: `posting cites ${ref.representation}::${ref.ruleId}@${ref.ruleVersion} which is NOT in the rule registry — the entry cannot be reproduced (temporal reproducibility, spec §6.3)`,
        severity: "fail",
      });
    }
  }

  if (violations.length > 0) {
    result.ok = false;
    result.violations = violations;
  }
  return result;
}

if (import.meta.main) {
  const result = run();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
