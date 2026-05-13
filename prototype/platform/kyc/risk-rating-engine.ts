// platform/kyc/risk-rating-engine.ts
//
// Risk-based approach (RBA) risk-rating engine for the KYC onboarding gateway.
//
// Authority: PROC-FC-01 (Approved), KYC/CDD/EDD Policy (BRC-approved)
// Citations: ORG-FC-02 (KYC/CDD/EDD), FIC-ACT-S21 (FIC Act s.21A),
//   FATF-REC-10
//
// Pure function — no side effects, no I/O. The gateway agent calls this
// after screening is complete and emits RiskRatingAssigned with the result.
//
// RBA factors (FATF Rec 10 + FIC Act s.21A):
//   - entityType "trust" | "legal-entity"  → +1 complexity factor
//   - jurisdictionRisk "high"              → escalate to HIGH
//   - pepStatus true                        → PEP rating (unless PROHIBITED)
//   - sanctionsClear false                  → PROHIBITED (blocked entirely)
//   - uboChainDepth >= 3                   → HIGH (complex UBO structure)
//
// Precedence: PROHIBITED > PEP > HIGH > STANDARD
//
// Author: Mira (Regulatory Intelligence Engineer)

export type RiskRating = "STANDARD" | "HIGH" | "PEP" | "PROHIBITED";

export interface RbaInput {
  entityType: "natural-person" | "legal-entity" | "trust";
  jurisdictionRisk: "low" | "medium" | "high";
  pepStatus: boolean;
  sanctionsClear: boolean;
  uboChainDepth: number;
  productTypes: readonly string[];
}

/**
 * Assign a risk rating based on FATF Rec 10 + FIC Act s.21A factors.
 *
 * Returns a tuple of [rating, scoreFactors] where scoreFactors is a
 * human-readable list of which factors drove the rating — used as
 * RiskRatingAssigned.rbaScoreFactors for the event record.
 */
export function assignRiskRating(input: RbaInput): { rating: RiskRating; factors: string[] } {
  const factors: string[] = [];

  // PROHIBITED gate: sanctions hit blocks onboarding entirely.
  // FIC Act s.21B — entity on consolidated list must not be onboarded.
  if (!input.sanctionsClear) {
    factors.push("sanctions:not-clear — PROHIBITED (FIC-ACT-S21, ORG-FC-03)");
    return { rating: "PROHIBITED", factors };
  }

  let rating: RiskRating = "STANDARD";

  // Entity complexity: trusts and legal entities add structural opacity.
  // FATF Rec 10 — higher scrutiny for complex legal structures.
  if (input.entityType === "trust" || input.entityType === "legal-entity") {
    factors.push(`entity-type:${input.entityType} — complexity factor (FATF-REC-10, ORG-FC-02)`);
    if (rating === "STANDARD") rating = "HIGH";
  }

  // Jurisdiction risk: high-risk jurisdiction escalates to HIGH.
  // FATF Rec 10 — enhanced measures for higher-risk jurisdictions.
  if (input.jurisdictionRisk === "high") {
    factors.push("jurisdiction-risk:high — escalate to HIGH (FATF-REC-10, ORG-FC-02)");
    if (rating === "STANDARD") rating = "HIGH";
  }

  // UBO chain depth: complex beneficial ownership structure.
  // FIC Act s.21B — UBO threshold 25%; chain depth >= 3 flags opacity.
  if (input.uboChainDepth >= 3) {
    factors.push(
      `ubo-chain-depth:${input.uboChainDepth} >= 3 — complex UBO structure (FIC-ACT-S21B, ORG-FC-02)`,
    );
    if (rating === "STANDARD") rating = "HIGH";
  }

  // PEP status: political exposure overrides STANDARD/HIGH with PEP rating.
  // FATF Rec 12 — PEPs require EDD regardless of other factors.
  if (input.pepStatus) {
    factors.push("pep-status:true — PEP rating (FATF-REC-12, ORG-FC-04)");
    // PEP supersedes STANDARD and HIGH (EDD required either way).
    // PROHIBITED was already handled above and returned early.
    rating = "PEP";
  }

  if (factors.length === 0) {
    factors.push("no elevated factors — STANDARD (FATF-REC-10, ORG-FC-02)");
  }

  return { rating, factors };
}
