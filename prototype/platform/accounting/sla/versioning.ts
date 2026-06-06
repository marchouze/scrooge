// platform/accounting/sla/versioning.ts
//
// SLA rule versioning + temporal reproducibility (Phase-0 design spec §6;
// D-SLA-ENGINE-RULES-AS-DATA Phase 4b).
//
// The supersede-never-edit discipline that lets an entry posted in a past
// period be reproduced EXACTLY from the rule version in force at that entry's
// effective date. This is the foundation the Phase-4c approval workflow gates
// and the audit guarantee an auditor relies on ("show me why this entry was
// booked" → a specific rule version + a specific event + a specific resolver
// state, all reproducible).
//
// ─── The discipline (spec §6.1) ─────────────────────────────────────────────
// A rule is IMMUTABLE once effective. A change is a NEW version:
//   - version: n+1
//   - its own effective_from (the cutover date, inclusive)
//   - supersedes: "PR-FX-001@1" (the rule_id@version it replaces)
//   - the PRIOR version's effective_to is set to the new version's
//     effective_from (left-closed / right-open — `[from, to)` intervals).
// The two windows abut exactly: no gap, no overlap. The rule registry is an
// append-only, version-stamped artefact — the same discipline the regulatory
// knowledge graph and the decisions register already follow.
//
// ─── Per-representation scoping (spec §6.2) ─────────────────────────────────
// Effective windows are scoped PER representation + rule_id. A SARB-BA-RETURN
// rule can change on a regulator's effective date without touching the IFRS
// rule — the two bases evolve on independent timelines. Window contiguity is
// therefore asserted within a (representation, rule_id) lineage only; an IFRS
// PR-FX-001 window and a SARB PR-FX-001-BA window never interact.
//
// This module is PURE: no event emission, no I/O. It operates over in-memory
// `SlaRule[]` arrays (the rule registry) and the interpreter.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4b, CEO-approved 2026-06-06).
// Citations: Principles/1-events-are-truth.md (append-only),
//            Principles/2-single-graph-discipline.md (versioned lineage).

import type { SlaRule } from "./generated/sla-types";

// ---------------------------------------------------------------------------
// Lineage identity
// ---------------------------------------------------------------------------

/** The `rule_id@version` reference used by `supersedes` (spec §6.1). */
export type RuleVersionRef = `${string}@${number}`;

/** Compose the canonical `rule_id@version` reference for a rule. */
export function ruleVersionRef(rule: Pick<SlaRule, "rule_id" | "version">): RuleVersionRef {
  return `${rule.rule_id}@${rule.version}` as RuleVersionRef;
}

/** Parse a `rule_id@version` reference. Returns null on a malformed string. */
export function parseRuleVersionRef(ref: string): { ruleId: string; version: number } | null {
  const at = ref.lastIndexOf("@");
  if (at <= 0) return null;
  const ruleId = ref.slice(0, at);
  const version = Number(ref.slice(at + 1));
  if (!Number.isInteger(version) || version < 1) return null;
  return { ruleId, version };
}

/**
 * The lineage key a rule's effective window lives in: a (representation,
 * rule_id) pair. Window contiguity (§6.2) is asserted WITHIN one lineage key.
 */
export function lineageKey(rule: Pick<SlaRule, "representation" | "rule_id">): string {
  return `${rule.representation}::${rule.rule_id}`;
}

// ---------------------------------------------------------------------------
// supersede-never-edit (spec §6.1)
// ---------------------------------------------------------------------------

/**
 * Produce the (prior', next) version PAIR for a supersession, applying the
 * supersede-never-edit convention. This is the canonical authoring helper:
 * call it when a rule changes; commit BOTH returned rules to the registry
 * (the prior with its now-closed `effective_to`, and the new version).
 *
 *   const [priorClosed, v2] = supersede(PR_FX_001, {
 *     effective_from: "2026-07-01",
 *     lines: [...],            // the changed template
 *     cites: [...],
 *   });
 *
 * Guarantees (all asserted, never silent):
 *   - the new version is `prior.version + 1` (monotonic);
 *   - the new `effective_from` is strictly after the prior's `effective_from`
 *     (you cannot supersede a rule with a cutover that predates its own start);
 *   - the new version carries `supersedes: "<rule_id>@<prior.version>"`;
 *   - the prior's `effective_to` is set to the new `effective_from` — the two
 *     windows abut (`[..., from)` then `[from, ...)`): no gap, no overlap;
 *   - rule_id + representation are inherited unchanged (same lineage).
 *
 * The original `prior` object is NOT mutated (append-only / immutability,
 * Principle 1) — a NEW closed-window copy is returned.
 */
export function supersede(
  prior: SlaRule,
  next: Omit<SlaRule, "rule_id" | "representation" | "version" | "supersedes"> &
    Partial<Pick<SlaRule, "effective_to">>,
): readonly [SlaRule, SlaRule] {
  if (next.effective_from <= prior.effective_from) {
    throw new Error(
      `supersede(${ruleVersionRef(prior)}): new effective_from ${next.effective_from} must be strictly after the prior version's effective_from ${prior.effective_from} (a supersession is a forward cutover; left-closed/right-open windows)`,
    );
  }
  if (prior.effective_to != null && prior.effective_to <= next.effective_from) {
    // The prior version was already closed at or before the proposed cutover —
    // superseding it here would create a gap or an overlap. Reject loudly.
    throw new Error(
      `supersede(${ruleVersionRef(prior)}): prior version already closes at ${prior.effective_to}, which is <= the proposed cutover ${next.effective_from} (would create a gap/overlap; supersede the in-force tail version instead)`,
    );
  }

  const priorClosed: SlaRule = {
    ...prior,
    effective_to: next.effective_from,
  };

  const nextVersion: SlaRule = {
    rule_id: prior.rule_id,
    representation: prior.representation,
    version: prior.version + 1,
    supersedes: ruleVersionRef(prior),
    effective_from: next.effective_from,
    effective_to: next.effective_to ?? null,
    applies_to: next.applies_to,
    condition: next.condition,
    lines: next.lines,
    balancing: next.balancing,
    cites: next.cites,
    ...(next.notes !== undefined ? { notes: next.notes } : {}),
  };

  return [priorClosed, nextVersion] as const;
}

// ---------------------------------------------------------------------------
// Effective-date selection (spec §2.1 step 3 / §6.3)
// ---------------------------------------------------------------------------

/** `[effective_from, effective_to)` contains `effectiveDate` (left-closed,
 *  right-open). The single source of truth the interpreter and recon share. */
export function withinEffectiveWindow(rule: SlaRule, effectiveDate: string): boolean {
  if (effectiveDate < rule.effective_from) return false;
  if (rule.effective_to != null && effectiveDate >= rule.effective_to) return false;
  return true;
}

/**
 * Resolve the single rule version of a lineage in force at `effectiveDate`.
 * Used for temporal reproducibility and recon — given a `rule_id` +
 * representation + an effective date, exactly one version is in force (the
 * supersede-never-edit invariant guarantees the windows are disjoint). Returns
 * null when the date precedes the first version or follows a closed tail.
 */
export function ruleVersionInForce(
  rules: readonly SlaRule[],
  representation: string,
  ruleId: string,
  effectiveDate: string,
): SlaRule | null {
  const inForce = rules.filter(
    (r) =>
      r.representation === representation &&
      r.rule_id === ruleId &&
      withinEffectiveWindow(r, effectiveDate),
  );
  if (inForce.length === 0) return null;
  if (inForce.length > 1) {
    throw new Error(
      `ruleVersionInForce(${representation}::${ruleId} @ ${effectiveDate}): ` +
        `${inForce.length} versions in force (${inForce
          .map(ruleVersionRef)
          .join(", ")}) — overlapping windows violate supersede-never-edit`,
    );
  }
  return inForce[0] as SlaRule;
}

/** Locate an exact (rule_id, version) in a registry. Null if absent. */
export function findRuleVersion(
  rules: readonly SlaRule[],
  ruleId: string,
  version: number,
  representation?: string,
): SlaRule | null {
  const found = rules.find(
    (r) =>
      r.rule_id === ruleId &&
      r.version === version &&
      (representation === undefined || r.representation === representation),
  );
  return found ?? null;
}

// ---------------------------------------------------------------------------
// Window-integrity analysis (the recon engine; spec §6.1 / §10)
// ---------------------------------------------------------------------------

export interface WindowDefect {
  readonly lineage: string;
  readonly kind: "gap" | "overlap" | "non-monotonic-version" | "duplicate-version";
  readonly detail: string;
}

/**
 * Assert the effective windows of every (representation, rule_id) lineage are
 * gap-free + overlap-free, with monotonic, contiguous versions. Pure: returns
 * the defect list (empty = clean). The recon pipeline wraps this.
 *
 * Per lineage, with versions ordered by `effective_from`:
 *   - each consecutive pair must abut: `prev.effective_to === next.effective_from`
 *     (a `null` effective_to is only valid on the LAST/open version);
 *   - versions must be strictly increasing integers with no duplicates;
 *   - a non-final version must have a non-null effective_to (an open window in
 *     the middle of a lineage is an overlap with everything after it).
 */
export function analyzeWindowIntegrity(rules: readonly SlaRule[]): WindowDefect[] {
  const byLineage = new Map<string, SlaRule[]>();
  for (const r of rules) {
    const key = lineageKey(r);
    const list = byLineage.get(key) ?? [];
    list.push(r);
    byLineage.set(key, list);
  }

  const defects: WindowDefect[] = [];

  for (const [lineage, group] of byLineage) {
    // Detect duplicate version numbers within a lineage first.
    const seen = new Map<number, number>();
    for (const r of group) seen.set(r.version, (seen.get(r.version) ?? 0) + 1);
    for (const [version, count] of seen) {
      if (count > 1) {
        defects.push({
          lineage,
          kind: "duplicate-version",
          detail: `version ${version} appears ${count} times — supersede-never-edit requires a unique version per change`,
        });
      }
    }

    // Order by effective_from (then version) and check contiguity.
    const ordered = [...group].sort((a, b) =>
      a.effective_from === b.effective_from
        ? a.version - b.version
        : a.effective_from < b.effective_from
          ? -1
          : 1,
    );

    for (let i = 0; i < ordered.length; i++) {
      const cur = ordered[i] as SlaRule;
      const nxt = ordered[i + 1];

      if (nxt) {
        // A non-final version must be closed.
        if (cur.effective_to == null) {
          defects.push({
            lineage,
            kind: "overlap",
            detail: `${ruleVersionRef(cur)} has an open window (effective_to=null) but is superseded by ${ruleVersionRef(nxt)} — overlaps everything after the cutover ${nxt.effective_from}`,
          });
        } else if (cur.effective_to < nxt.effective_from) {
          defects.push({
            lineage,
            kind: "gap",
            detail: `${ruleVersionRef(cur)} closes at ${cur.effective_to} but ${ruleVersionRef(nxt)} opens at ${nxt.effective_from} — uncovered gap [${cur.effective_to}, ${nxt.effective_from})`,
          });
        } else if (cur.effective_to > nxt.effective_from) {
          defects.push({
            lineage,
            kind: "overlap",
            detail: `${ruleVersionRef(cur)} closes at ${cur.effective_to} but ${ruleVersionRef(nxt)} opens earlier at ${nxt.effective_from} — windows overlap`,
          });
        }

        // Version monotonicity along the effective-date order.
        if (nxt.version <= cur.version) {
          defects.push({
            lineage,
            kind: "non-monotonic-version",
            detail: `${ruleVersionRef(nxt)} (effective ${nxt.effective_from}) does not increase the version of the earlier ${ruleVersionRef(cur)} (effective ${cur.effective_from})`,
          });
        }
      }
    }
  }

  return defects;
}
