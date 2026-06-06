// platform/accounting/sla/reproduce.ts
//
// Temporal reproducibility (Phase-0 design spec §6.3; D-SLA-ENGINE-RULES-AS-DATA
// Phase 4b deliverable 4).
//
// The audit guarantee: an entry posted in a PAST period must be reproducible
// BYTE-FOR-BYTE from the rule version in force then. Given the original source
// event and the `ruleVersion` cited on its posting, `reproduceAsOf` re-runs the
// pure interpreter against EXACTLY that rule version and returns the entry. The
// re-derived legs must equal the originally-posted legs.
//
// Why this works (spec §6.3): (a) rules are version-stamped + effective-date
// scoped, (b) the posting carries `ruleVersion`, (c) the event store is
// append-only (Principle 1). So "show me why this entry was booked" resolves to
// a specific rule version + a specific event + a specific resolver state — all
// reproducible. Even AFTER a v2 supersedes v1, replaying a v1-era event through
// v1 still reproduces the v1 posting (the v1 rule object is immutable in the
// append-only registry; only its `effective_to` was closed).
//
// PURE: this module performs NO event emission and NO I/O. It re-runs the pure
// interpreter over an in-memory registry. The caller supplies the registry (the
// committed rule set) and the original event.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4b, CEO-approved 2026-06-06).
// Citations: Principles/1-events-are-truth.md.

import type { SlaRule } from "./generated/sla-types";
import {
  type InterpretResult,
  type InterpreterEvent,
  type ProposedLeg,
  interpret,
} from "./interpreter";
import { findRuleVersion } from "./versioning";

export type ReproduceOutcome =
  | {
      readonly kind: "reproduced";
      readonly representation: string;
      readonly ruleId: string;
      readonly ruleVersion: number;
      readonly legs: readonly ProposedLeg[];
    }
  | { readonly kind: "version-not-found"; readonly detail: string }
  | { readonly kind: "no-post"; readonly detail: string };

/**
 * Reproduce the posting an event produced under a SPECIFIC rule version.
 *
 * Selects the (rule_id, version) rule from the registry, runs the interpreter
 * over a registry containing ONLY that one version (so effective-date selection
 * cannot pick a sibling version — the original posting was produced by exactly
 * this rule object, and we re-run that exact object), and returns the proposed
 * legs. The caller compares them to the originally-posted legs for byte-for-byte
 * equality (`legsEqual`).
 *
 * `representation` defaults to "IFRS" (the production basis). `enrichment` must
 * be the SAME pre-resolved context the original posting used (the caller
 * reconstructs it from the append-only event stream exactly as the live engine
 * did — reproducibility includes the enrichment input).
 */
export function reproduceAsOf(args: {
  readonly registry: readonly SlaRule[];
  readonly event: InterpreterEvent;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly representation?: string;
  readonly enrichment?: unknown;
}): ReproduceOutcome {
  const representation = args.representation ?? "IFRS";
  const rule = findRuleVersion(args.registry, args.ruleId, args.ruleVersion, representation);
  if (!rule) {
    return {
      kind: "version-not-found",
      detail: `no ${representation} rule ${args.ruleId}@${args.ruleVersion} in the registry`,
    };
  }

  // Re-run the interpreter against ONLY the cited rule version. We pass the
  // original event's effective date as `asOf`; selection over a single-version
  // registry returns that version iff the event date is within its window —
  // which it was when the posting was originally produced. We deliberately
  // scope to the one version so a later supersession cannot shadow it.
  const eventForReplay: InterpreterEvent = {
    ...args.event,
    ...(args.enrichment !== undefined ? { enrichment: args.enrichment } : {}),
  };

  const results: InterpretResult[] = interpret(
    eventForReplay,
    [rule],
    [representation],
    args.event.as_of,
  );

  const r = results.find((x) => x.representation === representation);
  if (!r || r.outcome !== "post") {
    return {
      kind: "no-post",
      detail: `${args.ruleId}@${args.ruleVersion} did not produce a post for the replayed event (outcome: ${r?.outcome ?? "none"})`,
    };
  }

  return {
    kind: "reproduced",
    representation: r.representation,
    ruleId: r.ruleId,
    ruleVersion: r.ruleVersion,
    legs: r.legs,
  };
}

/** Byte-for-byte leg equality (order-sensitive): same length, same fields. */
export function legsEqual(a: readonly ProposedLeg[], b: readonly ProposedLeg[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as ProposedLeg;
    const y = b[i] as ProposedLeg;
    if (
      x.accountId !== y.accountId ||
      x.debitCredit !== y.debitCredit ||
      x.amountMinor !== y.amountMinor ||
      x.currency !== y.currency
    ) {
      return false;
    }
  }
  return true;
}
