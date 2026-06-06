// platform/accounting/sla/approval.ts
//
// SLA rule approval-workflow eligibility core (Phase-0 design spec §9.3;
// D-SLA-ENGINE-RULES-AS-DATA Phase 4c).
//
// The pure machinery that turns the append-only approval-event family
// (SlaRulePublished / SlaRuleApproved / SlaRuleWithheld) into the set of
// rule/versions the interpreter may treat as eligible. The interpreter already
// gates on the effective-date window (Phase 4b); Phase 4c adds the SECOND gate:
// a rule/version is interpreter-eligible only when a matching SlaRuleApproved
// exists whose approver ≠ publisher (four-eyes, Owen control i).
//
// ─── PURITY ─────────────────────────────────────────────────────────────────
// This module is PURE over in-memory approval RECORDS. It never reads the event
// store; the caller (the production GL cutover seam) loads the approval events
// once and hands them in as data — exactly the enrichment discipline the
// interpreter already follows. Dry-run + replay stay deterministic.
//
// ─── Owen's 5 SoD controls, in data ─────────────────────────────────────────
//   (i)   author ≠ approver         — `isFourEyes` rejects approver === publisher.
//   (ii)  attested typed event      — the SlaRuleApproved payload carries
//                                       approver (name+position) + rule_id +
//                                       version + reviewed-preview hash.
//   (iii) append-only audit         — corrections are NEW withhold/publish/
//                                       approve events; the latest event per
//                                       (lineage, version) decides current state.
//   (iv)  Principle-6 boundary      — eligibility is per (representation, rule_id,
//                                       version); there is NO per-posting gate.
//   (v)   enforced by recon         — recon:sla-approval-workflow asserts every
//                                       eligible rule has a four-eyes approval.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c, CEO-approved 2026-06-06);
//            D-SLA-APPROVAL-WORKFLOW-SEGREGATION (CoSec Owen).
// Citations: Principles/1-events-are-truth.md, Principles/6-autonomous-by-default.md.

import { createHash } from "node:crypto";

import type { SlaRule } from "./generated/sla-types";

// ---------------------------------------------------------------------------
// Activated production representations (the single source of truth)
// ---------------------------------------------------------------------------

/**
 * The representations the PRODUCTION GL posting path evaluates. This is the ONE
 * place the activated-representation set is declared — the FX cutover seam reads
 * it (not a bare `["IFRS"]` literal), and the recon reads it to enforce the
 * joint-approval rule (a non-IFRS representation here ⇒ a CFO Decision AND a
 * CoSec Decision must exist, per D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL).
 *
 * PHASE 4c: production stays IFRS-ONLY. SARB-BA-RETURN is NOT activated; it
 * remains a dry-run/preview-only parallel basis until the post-4c CFO+CoSec
 * joint-approval round flips this constant (see the activation runbook). Adding
 * "SARB-BA-RETURN" here WITHOUT both Decisions present is a recon failure.
 */
export const PRODUCTION_REPRESENTATIONS: readonly string[] = ["IFRS"];

// ---------------------------------------------------------------------------
// Eligibility key
// ---------------------------------------------------------------------------

/** The eligibility axis: a single rule/version within one representation. */
export interface ApprovalKey {
  readonly representation: string;
  readonly ruleId: string;
  readonly version: number;
}

/** Canonical string key for set/map membership. */
export function approvalKey(k: ApprovalKey): string {
  return `${k.representation}::${k.ruleId}@${k.version}`;
}

export function ruleApprovalKey(
  rule: Pick<SlaRule, "representation" | "rule_id" | "version">,
): string {
  return approvalKey({
    representation: rule.representation,
    ruleId: rule.rule_id,
    version: rule.version,
  });
}

// ---------------------------------------------------------------------------
// Rule-content hash — the artefact the publisher publishes + the approver
// reviews. A STABLE hash over the posting-relevant rule body (NOT the
// approval/lineage metadata): if a rule's template/condition/cites change, the
// hash changes, so an old approval no longer covers the new content.
// supersede-never-edit means a body change is a NEW version anyway; the hash is
// the belt-and-braces proof.
// ---------------------------------------------------------------------------

/**
 * Stable JSON of an object with keys sorted recursively — the canonical form the
 * content hash is taken over. (No store dependency; deterministic across
 * processes.)
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Content hash of a rule's posting-relevant body. Includes the lineage
 * coordinates (so two different rules never collide) plus the parts that
 * determine the posting: applies_to, condition, lines, balancing, cites, and
 * the effective window. EXCLUDES `supersedes`/`notes` (pure metadata). 16 hex
 * chars of SHA-256 — collision-safe for a registry of this size and stable.
 */
export function ruleContentHash(rule: SlaRule): string {
  const body = {
    representation: rule.representation,
    rule_id: rule.rule_id,
    version: rule.version,
    effective_from: rule.effective_from,
    effective_to: rule.effective_to ?? null,
    applies_to: rule.applies_to,
    condition: rule.condition,
    lines: rule.lines,
    balancing: rule.balancing,
    cites: rule.cites,
  };
  return createHash("sha256").update(stableStringify(body)).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Approval records (the caller maps approval events → these)
// ---------------------------------------------------------------------------

export interface PublishRecord extends ApprovalKey {
  readonly publisherName: string;
  readonly publisherPosition: string;
  readonly ruleContentHash: string;
}

export interface ApproveRecord extends ApprovalKey {
  readonly approverName: string;
  readonly approverPosition: string;
  readonly reviewedRuleHash: string;
  readonly reviewedPreviewHash: string;
  readonly grandfather: boolean;
}

export interface WithholdRecord extends ApprovalKey {
  readonly approverName: string;
  readonly reason: string;
}

/**
 * One approve/withhold decision in append order. The `kind` tags the union; the
 * loader emits these from the single ordered event stream so last-writer-wins
 * is unambiguous (a re-approval after a withhold simply appears later).
 */
export type ApprovalDecision =
  | ({ readonly kind: "approve" } & ApproveRecord)
  | ({ readonly kind: "withhold" } & WithholdRecord);

export interface ApprovalCorpus {
  readonly published: readonly PublishRecord[];
  /**
   * The approve + withhold decisions in APPEND (chronological) order. The
   * production loader builds this from a single ordered replay so the
   * last-writer-per-key veto/restore semantics are deterministic.
   */
  readonly decisions: readonly ApprovalDecision[];
}

// ---------------------------------------------------------------------------
// Four-eyes check (Owen control i)
// ---------------------------------------------------------------------------

/**
 * An approval is four-eyes iff there is a matching publish for the SAME
 * (representation, ruleId, version) AND the approver name differs from the
 * publisher name. A grandfather approval (build-phase) is special-cased: it may
 * stand WITHOUT a matching publish (the in-force rule predates the publish
 * gate) — but it STILL must carry author ≠ approver, i.e. the grandfather
 * approver (the engineering seat) must differ from the rule's authoring seat.
 * The grandfather record carries the authoring seat as its publisher via a
 * seeded synthetic publish (see backfill), so the same check applies uniformly.
 */
export function isFourEyesApproval(
  approval: ApproveRecord,
  publishesForKey: readonly PublishRecord[],
): { ok: true } | { ok: false; reason: string } {
  const matchingPublish = publishesForKey.find(
    (p) => p.ruleContentHash === approval.reviewedRuleHash,
  );
  if (!matchingPublish) {
    return {
      ok: false,
      reason: approval.grandfather
        ? `grandfather approval references reviewedRuleHash ${approval.reviewedRuleHash} with no matching SlaRulePublished — seed the synthetic publish`
        : `no SlaRulePublished matches the approved reviewedRuleHash ${approval.reviewedRuleHash} for this rule/version`,
    };
  }
  if (matchingPublish.publisherName === approval.approverName) {
    return {
      ok: false,
      reason: `self-approval: publisher and approver are the same seat (${approval.approverName})`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Eligible set
// ---------------------------------------------------------------------------

export interface EligibilityDefect {
  readonly key: string;
  readonly reason: string;
}

export interface EligibilityResult {
  /** Keys (approvalKey) that are interpreter-eligible. */
  readonly eligible: ReadonlySet<string>;
  /** Approvals that were rejected (self-approval / no matching publish). */
  readonly defects: readonly EligibilityDefect[];
}

/**
 * Compute the eligible rule/version set from the approval corpus.
 *
 * A key is eligible iff its LAST append-ordered decision is a four-eyes
 * `approve` (approver ≠ publisher, reviewedRuleHash matches a publish). A
 * `withhold` is a veto; a later `approve` (appearing after the withhold in the
 * ordered `decisions` list) restores eligibility — pure last-writer-per-key.
 *
 * Failed four-eyes approvals are reported as defects (never silently dropped)
 * AND do not set the key eligible — so a self-approval can never make a rule
 * eligible. The recon surfaces the defects.
 */
export function computeEligibility(corpus: ApprovalCorpus): EligibilityResult {
  const defects: EligibilityDefect[] = [];

  const publishesByKey = new Map<string, PublishRecord[]>();
  for (const p of corpus.published) {
    const k = approvalKey(p);
    const list = publishesByKey.get(k) ?? [];
    list.push(p);
    publishesByKey.set(k, list);
  }

  // Last-writer-per-key over the ordered decision stream.
  const lastByKey = new Map<string, boolean>();
  for (const d of corpus.decisions) {
    const k = approvalKey(d);
    if (d.kind === "withhold") {
      lastByKey.set(k, false);
      continue;
    }
    // approve — must pass four-eyes to count.
    const fe = isFourEyesApproval(d, publishesByKey.get(k) ?? []);
    if (!fe.ok) {
      defects.push({ key: k, reason: fe.reason });
      // A failed approval does NOT change current eligibility state.
      continue;
    }
    lastByKey.set(k, true);
  }

  const eligible = new Set<string>();
  for (const [k, isEligible] of lastByKey) if (isEligible) eligible.add(k);

  return { eligible, defects };
}

// ---------------------------------------------------------------------------
// Interpreter approval-gate adapter
// ---------------------------------------------------------------------------

/**
 * The shape the interpreter consumes for its Phase-4c approval gate (mirrors
 * `interpreter.ts` `ApprovalGate` structurally — kept here to avoid a circular
 * import; the interpreter imports nothing from this module's runtime, only the
 * structural type). `keyOf` is `ruleApprovalKey`, so the eligibility set and the
 * interpreter's per-rule lookup use the SAME key derivation and cannot drift.
 */
export interface InterpreterApprovalGate {
  readonly eligibleKeys: ReadonlySet<string>;
  readonly keyOf: (rule: Pick<SlaRule, "representation" | "rule_id" | "version">) => string;
}

/** Build the interpreter approval gate from a computed eligible set. */
export function approvalGate(eligible: ReadonlySet<string>): InterpreterApprovalGate {
  return { eligibleKeys: eligible, keyOf: ruleApprovalKey };
}
