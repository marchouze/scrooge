// platform/obligations/obligation-scope-extractor.ts
//
// W8 — conservative rule-based obligation scope EXTRACTOR (v1).
//
// Slice C wired the obligation → applicability loop but derived a FLAT scope
// `{ kind: "jurisdiction", jurisdiction: "ZA" }` for every obligation — so every
// ZA obligation resolved to "applies", with no discrimination. This extractor
// gives an obligation a RICHER `appliesToScope` so an approach-specific
// obligation (e.g. an IRB-only rule) resolves to "does-not-apply" when the bank
// operates on the standardised approach.
//
// ─── CONSERVATIVE-COMPLIANCE DEFAULT (non-negotiable) ─────────────────────────
// The extractor emits a RESTRICTING scope ONLY when the provenance is
// UNAMBIGUOUSLY approach- or permission-specific (a small curated allowlist).
// In EVERY other case — empty/ambiguous provenance, unrecognised citation,
// generic prudential rule — it returns the flat jurisdiction-ZA predicate, which
// resolves to "applies". A wrong "does-not-apply" hides a binding obligation
// from the bank: a compliance hazard. A wrong "applies" merely over-includes
// (harmless at worst). We therefore over-include and NEVER wrongly exclude.
// ──────────────────────────────────────────────────────────────────────────────
//
// ─── FOLLOW-ON (explicitly NOT built here) ────────────────────────────────────
// v1 is a rule-based pilot over a curated allowlist. The intended successor is
// an LLM-distill slice that PROPOSES a typed `appliesToScope` per obligation from
// the provision prose, routed through human/agent review before it disposes the
// scope (structured-first: learned weights propose, a typed event disposes —
// D-W8-POSTURE-REGISTER-SLICE-1). That LLM-proposes-scope work is OUT OF SCOPE
// for this build and is recorded here as the next slice, not implemented.
// ──────────────────────────────────────────────────────────────────────────────
//
// PACKAGE BOUNDARY: V1-side platform module. It IMPORTS v2-core (permitted
// direction). It does NOT live under v2-core.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; Principle 1 (events are truth),
// Principle 2 (single-graph discipline).
// Author: Atlas (Core Banking Platform Architect, engineering).

import type { AppliesToScope } from "../../v2-core/posture";

// ---------------------------------------------------------------------------
// Posture dimension vocabulary (mirrors scripts/seed-v2-posture-dimensions.ts)
// ---------------------------------------------------------------------------

/** Credit-RWA approach dimension key. */
const DIM_APPROACH_CREDIT_RWA = "approach.credit-rwa";
/** Market-risk approach dimension key. */
const DIM_APPROACH_MARKET_RISK = "approach.market-risk";

// ---------------------------------------------------------------------------
// Curated allowlist of UNAMBIGUOUSLY approach-specific provenance
// ---------------------------------------------------------------------------

/**
 * A curated rule mapping an unambiguous provenance signal (a citation /
 * derivesFrom token that is, by construction, approach- or permission-specific)
 * to the RESTRICTING scope the obligation should carry. Each entry is documented
 * with WHY it is unambiguous — the bar for membership is high: a generic
 * prudential chapter does NOT qualify; only chapters that exist solely to govern
 * a specific internal-model / IRB approach do.
 *
 * `match` is tested (case-insensitively) against every `derivesFrom` token AND
 * the `citation`. A hit yields `scope`; the first matching rule wins.
 */
interface ScopeRule {
  /** Stable id for the rule (for auditability). */
  readonly id: string;
  /** Substring matched (lower-cased) against derivesFrom tokens + citation. */
  readonly match: readonly string[];
  /** The restricting scope emitted on a match. */
  readonly scope: AppliesToScope;
  /** Why this provenance is UNAMBIGUOUSLY approach/permission specific. */
  readonly rationale: string;
}

/**
 * Helper: `and(jurisdiction ZA, dimension <key>=<value>)`. The jurisdiction
 * conjunct is retained so the obligation still scopes to ZA — the dimension
 * conjunct is the discriminating term. Against the bank's single ZA-bank
 * context this resolves to "applies" iff the bank HOLDS that dimension value.
 */
function zaWithDimension(dimensionKey: string, dimensionValue: string): AppliesToScope {
  return {
    kind: "and",
    conditions: [
      { kind: "jurisdiction", jurisdiction: "ZA" },
      { kind: "dimension", dimensionKey, dimensionValue },
    ],
  };
}

/**
 * The curated allowlist. SHORT and unambiguous by design. Each entry's `match`
 * tokens identify a Basel chapter that exists SOLELY to govern a specific
 * internal-model / IRB approach — provisions that genuinely do not bind a bank
 * on the standardised approach. Generic chapters are deliberately absent so they
 * fall through to the conservative jurisdiction-ZA default.
 */
const SCOPE_RULES: readonly ScopeRule[] = [
  {
    id: "bcbs-cre-irb",
    // CRE30–CRE36 are the Basel CREDIT-risk INTERNAL-RATINGS-BASED chapters.
    // They define the IRB approach itself (PD/LGD/EAD modelling, IRB roll-out,
    // supervisory-formula). A standardised-approach bank does not apply them.
    // We scope to ADVANCED-IRB (the most-specific IRB value the bank does not
    // hold); the bank holds neither foundation- nor advanced-IRB, so either
    // value yields "does-not-apply" — advanced-irb is chosen as the canonical
    // representative of "an IRB-only rule".
    match: ["cre30", "cre31", "cre32", "cre33", "cre34", "cre35", "cre36"],
    scope: zaWithDimension(DIM_APPROACH_CREDIT_RWA, "advanced-irb"),
    rationale:
      "BCBS CRE30–CRE36 are the credit-risk internal-ratings-based (IRB) chapters; they govern the IRB approach only and do not bind a standardised-approach bank.",
  },
  {
    id: "bcbs-mar-ima",
    // MAR30–MAR33 are the Basel MARKET-risk INTERNAL-MODELS-APPROACH chapters
    // (expected-shortfall IMA, model-eligibility, backtesting / P&L
    // attribution). They define the IMA itself. A standardised-approach
    // market-risk bank does not apply them.
    match: ["mar30", "mar31", "mar32", "mar33"],
    scope: zaWithDimension(DIM_APPROACH_MARKET_RISK, "internal-models"),
    rationale:
      "BCBS MAR30–MAR33 are the market-risk internal-models-approach (IMA) chapters; they govern the IMA only and do not bind a standardised-approach bank.",
  },
];

// ---------------------------------------------------------------------------
// The extractor
// ---------------------------------------------------------------------------

/**
 * Derive an obligation's `appliesToScope` from its provenance.
 *
 * Returns a RESTRICTING scope ONLY when the provenance unambiguously matches a
 * curated approach-/permission-specific rule. In every other case — including
 * empty/ambiguous `derivesFrom` and unrecognised citations — returns the flat
 * `{ kind: "jurisdiction", jurisdiction: "ZA" }` predicate (the conservative
 * compliance default: over-include, never wrongly exclude).
 *
 * Pure + deterministic: same args always yield the same scope (replay-safe).
 */
export function deriveObligationScope(args: {
  obligationId: string;
  derivesFrom: string[];
  domain: string;
  citation?: string;
}): AppliesToScope {
  const jurisdictionZa: AppliesToScope = { kind: "jurisdiction", jurisdiction: "ZA" };

  // Build the lower-cased haystack from derivesFrom tokens + citation.
  const tokens: string[] = [];
  for (const d of args.derivesFrom) {
    if (typeof d === "string" && d.length > 0) tokens.push(d.toLowerCase());
  }
  if (typeof args.citation === "string" && args.citation.length > 0) {
    tokens.push(args.citation.toLowerCase());
  }

  // Empty / ambiguous provenance → conservative default.
  if (tokens.length === 0) return jurisdictionZa;

  for (const rule of SCOPE_RULES) {
    for (const needle of rule.match) {
      if (tokens.some((t) => t.includes(needle))) {
        return rule.scope;
      }
    }
  }

  // No unambiguous approach-specific signal → conservative default.
  return jurisdictionZa;
}

/** Exposed for audit/recon: the curated rule ids and rationales. */
export function listScopeRules(): readonly { id: string; rationale: string }[] {
  return SCOPE_RULES.map((r) => ({ id: r.id, rationale: r.rationale }));
}
