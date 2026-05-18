// platform/kyc/risk-rating-engine.ts
//
// Typology-based KYC risk-scoring engine for the KYC onboarding gateway.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   PROC-FC-01 (Approved), AML-CFT-POLICY-V1 (BRC-approved);
//   FIC-ACT-38-2001 s.21A; FATF-REC-10, FATF-REC-12.
//
// Score model (0–100; band: low 0–33, medium 34–66, high 67–100):
//
//   Factor              Weight  Notes
//   ────────────────    ──────  ──────────────────────────────────────────
//   country_risk         40%    FATF grey/black list, FATF Rec 10
//   entity_type_risk     25%    Complex structures (trusts) score higher
//   pep_flag             20%    Direct PEP = 100; linked PEP = 70; clean = 0
//   adverse_media        15%    Hit = 80; clean = 0
//
//   composite = Σ (factor_score × weight)
//   band: low (0–33) / medium (34–66) / high (67–100)
//
// High-risk result (score ≥ 67) MUST be followed by a KYCEDDInitiated event.
// This engine returns a recommendation flag `requiresEDD` but does NOT emit
// the event — that is the caller's responsibility.
//
// Pure function — no side effects, no I/O.
//
// Author: Atlas (Core banking platform architect, engineering).

// ---------------------------------------------------------------------------
// Legacy RBA types (retained for backward compatibility with existing callers)
// ---------------------------------------------------------------------------

/** Legacy risk rating returned by `assignRiskRating`. */
export type RiskRating = "STANDARD" | "HIGH" | "PEP" | "PROHIBITED";

/** Legacy input for `assignRiskRating`. */
export interface RbaInput {
  entityType: "natural-person" | "legal-entity" | "trust";
  jurisdictionRisk: "low" | "medium" | "high";
  pepStatus: boolean;
  sanctionsClear: boolean;
  uboChainDepth: number;
  productTypes: readonly string[];
}

/**
 * Legacy risk rating function — retained for backward compatibility with
 * existing callers (projection, tests, gateway agent).
 *
 * Returns a tuple-like object of { rating, factors } where factors is a
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
  if (input.entityType === "trust" || input.entityType === "legal-entity") {
    factors.push(`entity-type:${input.entityType} — complexity factor (FATF-REC-10, ORG-FC-02)`);
    if (rating === "STANDARD") rating = "HIGH";
  }

  // Jurisdiction risk.
  if (input.jurisdictionRisk === "high") {
    factors.push("jurisdiction-risk:high — escalate to HIGH (FATF-REC-10, ORG-FC-02)");
    if (rating === "STANDARD") rating = "HIGH";
  }

  // UBO chain depth.
  if (input.uboChainDepth >= 3) {
    factors.push(
      `ubo-chain-depth:${input.uboChainDepth} >= 3 — complex UBO structure (FIC-ACT-S21B, ORG-FC-02)`,
    );
    if (rating === "STANDARD") rating = "HIGH";
  }

  // PEP status.
  if (input.pepStatus) {
    factors.push("pep-status:true — PEP rating (FATF-REC-12, ORG-FC-04)");
    rating = "PEP";
  }

  if (factors.length === 0) {
    factors.push("no elevated factors — STANDARD (FATF-REC-10, ORG-FC-02)");
  }

  return { rating, factors };
}

// ---------------------------------------------------------------------------
// New typology-based scoring (D-KYC-ONBOARDING-BUILD)
// ---------------------------------------------------------------------------

/** Risk band derived from composite score. */
export type RiskBand = "low" | "medium" | "high";

/** Input for the new typology-based risk engine. */
export interface RiskScoringInput {
  /** ISO 3166-1 alpha-2 jurisdiction code of the entity. */
  jurisdiction: string;
  /** Legal form of the entity. */
  entityType: "company" | "trust" | "partnership" | "individual-sole-trader" | string;
  /** Whether the entity is a directly identified PEP. */
  pep_flag: boolean;
  /** Whether the entity is linked to (close associate of) a PEP. */
  pep_linked: boolean;
  /** Whether adverse media was found. */
  adverse_media: boolean;
  /** Whether a shell-company indicator was flagged. */
  shell_company_indicator?: boolean;
}

/** Per-factor detail returned alongside the composite score. */
export interface RiskFactor {
  factor_name: string;
  weight: number; // 0–1
  value: number; // 0–100 raw factor score
}

/** Full output of the typology-based risk engine. */
export interface RiskScoringResult {
  score: number; // 0–100 composite
  band: RiskBand;
  factors: RiskFactor[];
  requiresEDD: boolean; // true when score ≥ 67 (caller must emit KYCEDDInitiated)
}

// ---------------------------------------------------------------------------
// FATF grey/black-list jurisdiction table (representative; extend at licence-day)
// ---------------------------------------------------------------------------

// FATF "Increased Monitoring" jurisdictions (grey list) — as at 2024 update.
// Scores ≥ 60 → high risk-score contribution.
// Source: https://www.fatf-gafi.org/en/topics/increased-monitoring-list.html
const HIGH_RISK_JURISDICTIONS = new Set([
  // FATF Black list (ICIO jurisdictions with AML/CFT deficiencies, §19 enhanced monitoring)
  "KP", // North Korea
  "IR", // Iran
  "MM", // Myanmar (Burma)
  // FATF Grey list (increased monitoring)
  "AL", // Albania
  "BB", // Barbados
  "BF", // Burkina Faso
  "CM", // Cameroon
  "HR", // Croatia
  "CD", // DR Congo
  "HT", // Haiti
  "JM", // Jamaica
  "ML", // Mali
  "MZ", // Mozambique
  "NG", // Nigeria
  "PH", // Philippines
  "SN", // Senegal
  "SS", // South Sudan
  "SY", // Syria
  "TZ", // Tanzania
  "TT", // Trinidad and Tobago
  "UG", // Uganda
  "AE", // UAE (on grey list at time of writing)
  "VN", // Vietnam
  "YE", // Yemen
  "ZW", // Zimbabwe
]);

const MEDIUM_RISK_JURISDICTIONS = new Set([
  "PK", // Pakistan (recently exited grey list but enhanced monitoring)
  "RU", // Russia (sanctions, elevated risk)
  "BY", // Belarus (sanctions)
  "KZ", // Kazakhstan (AML concerns)
  "VE", // Venezuela (sanctions)
  "CU", // Cuba (OFAC)
  "SO", // Somalia
  "SD", // Sudan
  "LY", // Libya
  "ET", // Ethiopia
]);

/**
 * Compute the country-risk score (0–100) for a given ISO 3166-1 alpha-2 code.
 */
function countryRiskScore(jurisdiction: string): number {
  const code = jurisdiction.toUpperCase();
  if (HIGH_RISK_JURISDICTIONS.has(code)) return 90;
  if (MEDIUM_RISK_JURISDICTIONS.has(code)) return 55;
  return 10; // default — low risk
}

/**
 * Compute the entity-type risk score (0–100).
 *
 * Shell-company indicator overrides to 90 (FATF Rec 24 — corporate vehicles).
 */
function entityTypeRiskScore(
  entityType: string,
  shellCompanyIndicator: boolean,
): number {
  if (shellCompanyIndicator) return 90;
  switch (entityType) {
    case "trust":
      return 60;
    case "partnership":
      return 40;
    case "individual-sole-trader":
      return 30;
    case "company":
    default:
      return 20;
  }
}

/**
 * Compute the composite typology-based risk score.
 *
 * Factor weights:
 *   country_risk:      40%
 *   entity_type_risk:  25%
 *   pep_flag:          20%
 *   adverse_media:     15%
 */
export function computeRiskScore(input: RiskScoringInput): RiskScoringResult {
  const countryScore = countryRiskScore(input.jurisdiction);
  const entityScore = entityTypeRiskScore(
    input.entityType,
    input.shell_company_indicator ?? false,
  );

  // PEP score: direct PEP = 100, linked PEP = 70, clean = 0.
  const pepScore = input.pep_flag ? 100 : input.pep_linked ? 70 : 0;

  // Adverse media score: hit = 80, clean = 0.
  const adverseScore = input.adverse_media ? 80 : 0;

  const factors: RiskFactor[] = [
    { factor_name: "country_risk", weight: 0.4, value: countryScore },
    { factor_name: "entity_type_risk", weight: 0.25, value: entityScore },
    { factor_name: "pep_flag", weight: 0.2, value: pepScore },
    { factor_name: "adverse_media", weight: 0.15, value: adverseScore },
  ];

  const composite = factors.reduce((sum, f) => sum + f.weight * f.value, 0);
  const score = Math.round(Math.min(100, Math.max(0, composite)));

  let band: RiskBand;
  if (score >= 67) {
    band = "high";
  } else if (score >= 34) {
    band = "medium";
  } else {
    band = "low";
  }

  return {
    score,
    band,
    factors,
    requiresEDD: band === "high",
  };
}
