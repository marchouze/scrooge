// platform/collateral/hqla-classifier.ts
//
// HQLA classifier — classifies any security into L1 / L2a / L2b / non-HQLA
// per BA 110 Annex 1 (Banks Act Regulations relating to Banks, Regulation 26,
// LCR liquidity-buffer eligibility framework).
//
// Classification logic:
//   L1:   ZAR cash equivalents; SARB claims; SA government bonds (0% RW)
//         → haircut 0%
//   L2a:  SA government bonds (20% RW); qualifying covered bonds;
//         corporate bonds AA- or better → haircut 15%
//   L2b:  Qualifying equities (JSE Top 40); qualifying corporate bonds
//         BBB- to A+ → haircut 25–50%
//   non-HQLA: everything else → not eligible (haircut 100%)
//
// Authority: BA 110 Annex 1; Banks Act Reg 26; BCBS-D365-IRRBB.
// Author: Atlas (Core banking platform architect, engineering)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityDescriptor {
  isin: string;
  issuer: string;
  assetClass: "sovereign-bond" | "corporate-bond" | "equity" | "covered-bond" | "cash" | "other";
  creditRating?: string | undefined; // e.g. "AAA", "AA+", "BBB-"
  riskWeight?: number | undefined; // 0, 20, 50, 100
  currency: string;
  residualMaturityDays?: number | undefined;
}

export interface HQLAClassification {
  level: "L1" | "L2a" | "L2b" | "non-HQLA";
  haircut: number; // 0, 0.15, 0.25, 0.50, or 1.0 (non-eligible)
  eligibilityRationale: string;
}

// ---------------------------------------------------------------------------
// Rating utilities
// ---------------------------------------------------------------------------

/**
 * Numeric rating score (lower = better).
 * Returns undefined if rating is unrecognised.
 */
function ratingScore(rating: string | undefined): number | undefined {
  if (!rating) return undefined;
  const SCALE: Record<string, number> = {
    AAA: 1,
    "AA+": 2,
    AA: 3,
    "AA-": 4,
    "A+": 5,
    A: 6,
    "A-": 7,
    "BBB+": 8,
    BBB: 9,
    "BBB-": 10,
    "BB+": 11,
    BB: 12,
    "BB-": 13,
    "B+": 14,
    B: 15,
    "B-": 16,
    CCC: 17,
    CC: 18,
    C: 19,
    D: 20,
  };
  return SCALE[rating.toUpperCase()];
}

/** True if rating is at least AA- (score ≤ 4). */
function isAAminusOrBetter(rating: string | undefined): boolean {
  const s = ratingScore(rating);
  return s !== undefined && s <= 4;
}

/** True if rating is BBB- to A+ (score 5–10). */
function isBBBminusToAplus(rating: string | undefined): boolean {
  const s = ratingScore(rating);
  return s !== undefined && s >= 5 && s <= 10;
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Classify a security into an HQLA bucket per BA 110 Annex 1.
 *
 * Build-phase note: in production this would cross-check against the SARB
 * published eligible-securities register. During the build phase the
 * classification is rules-based on the descriptor fields provided.
 */
export function classifyHQLA(sec: SecurityDescriptor): HQLAClassification {
  const { assetClass, currency, riskWeight, creditRating } = sec;

  // ------------------------------------------------------------------
  // L1 — zero haircut
  // ------------------------------------------------------------------

  // Cash / ZAR cash equivalents (includes SARB overnight deposits)
  if (assetClass === "cash" && currency === "ZAR") {
    return {
      level: "L1",
      haircut: 0,
      eligibilityRationale: "ZAR cash equivalent — L1 per BA 110 Annex 1 para 1(a). Zero haircut.",
    };
  }

  // SA government bonds with 0% risk weight (direct SARB / Republic of SA claim)
  if (assetClass === "sovereign-bond" && currency === "ZAR" && riskWeight === 0) {
    return {
      level: "L1",
      haircut: 0,
      eligibilityRationale:
        "SA sovereign bond 0% RW (SARB/Republic claim) — L1 per BA 110 Annex 1 para 1(b). Zero haircut.",
    };
  }

  // SA sovereign bond, ZAR, no riskWeight supplied — treat as 0% RW for build-phase defaults
  if (assetClass === "sovereign-bond" && currency === "ZAR" && riskWeight === undefined) {
    return {
      level: "L1",
      haircut: 0,
      eligibilityRationale:
        "SA sovereign bond ZAR, risk weight not supplied — classified L1 as default for ZAR SA sovereign. Zero haircut.",
    };
  }

  // ------------------------------------------------------------------
  // L2a — 15% haircut
  // ------------------------------------------------------------------

  // SA government bonds with 20% risk weight
  if (assetClass === "sovereign-bond" && currency === "ZAR" && riskWeight === 20) {
    return {
      level: "L2a",
      haircut: 0.15,
      eligibilityRationale:
        "SA sovereign bond 20% RW — L2a per BA 110 Annex 1 para 2(a). Haircut 15%.",
    };
  }

  // Qualifying covered bonds (currency-agnostic for ZAR-denominated issuances)
  if (assetClass === "covered-bond") {
    return {
      level: "L2a",
      haircut: 0.15,
      eligibilityRationale:
        "Qualifying covered bond — L2a per BA 110 Annex 1 para 2(b). Haircut 15%.",
    };
  }

  // Corporate bonds rated AA- or better
  if (assetClass === "corporate-bond" && isAAminusOrBetter(creditRating)) {
    return {
      level: "L2a",
      haircut: 0.15,
      eligibilityRationale: `Corporate bond rated ${creditRating ?? "AA- or better"} — L2a per BA 110 Annex 1 para 2(c). Haircut 15%.`,
    };
  }

  // ------------------------------------------------------------------
  // L2b — 25–50% haircut
  // ------------------------------------------------------------------

  // Qualifying equities — JSE Top 40 (equity asset class, ZAR)
  if (assetClass === "equity" && currency === "ZAR") {
    return {
      level: "L2b",
      haircut: 0.5,
      eligibilityRationale:
        "JSE-listed equity — L2b per BA 110 Annex 1 para 3(a). Haircut 50% (qualifying equity).",
    };
  }

  // Corporate bonds BBB- to A+
  if (assetClass === "corporate-bond" && isBBBminusToAplus(creditRating)) {
    return {
      level: "L2b",
      haircut: 0.25,
      eligibilityRationale: `Corporate bond rated ${creditRating ?? "BBB- to A+"} — L2b per BA 110 Annex 1 para 3(b). Haircut 25%.`,
    };
  }

  // ------------------------------------------------------------------
  // non-HQLA — not eligible
  // ------------------------------------------------------------------

  const reason = buildNonHQLARationale(sec);
  return {
    level: "non-HQLA",
    haircut: 1.0,
    eligibilityRationale: reason,
  };
}

function buildNonHQLARationale(sec: SecurityDescriptor): string {
  const parts: string[] = ["Not HQLA-eligible per BA 110 Annex 1."];
  if (sec.assetClass === "corporate-bond") {
    if (!sec.creditRating) {
      parts.push("Corporate bond has no credit rating — minimum BBB- required for L2b.");
    } else {
      parts.push(
        `Corporate bond rated ${sec.creditRating} — below BBB- threshold for L2b eligibility.`,
      );
    }
  } else if (sec.assetClass === "equity" && sec.currency !== "ZAR") {
    parts.push(`Non-ZAR equity (${sec.currency}) — only ZAR JSE equities qualify for L2b.`);
  } else if (sec.assetClass === "other") {
    parts.push("Asset class 'other' is not HQLA-eligible.");
  } else if (sec.assetClass === "sovereign-bond" && sec.currency !== "ZAR") {
    parts.push(
      `Foreign sovereign bond (${sec.currency}) — only ZAR-denominated SA sovereign bonds qualify.`,
    );
  }
  return parts.join(" ");
}
