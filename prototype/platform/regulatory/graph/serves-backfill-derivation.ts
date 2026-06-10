// platform/regulatory/graph/serves-backfill-derivation.ts
//
// Rule-based derivation of SERVES edges (Obligation → RegulatoryObjective) for
// the bank's ADOPTED obligation register (`Regulations/_obligations.seed.json`,
// seeded as `OBL-ORG-*` nodes). The keystone edge of the regulatory-intelligence
// objective layer is SERVES — WHY a requirement exists. The per-regulator
// ingestion arcs (#1150–#1164) hand-authored 91 SERVES edges; this module
// derives the remainder from each obligation's SOURCE PROVENANCE (the register
// `citation` text + `urn`), mapping the source instrument to its issuing
// regulator and the matching leaf objective in that regulator's objective graph.
//
// HONESTY BAR (same as #1192's FSCA residuals): an obligation whose source does
// not resolve to one of the six graphed regulators (SARB-PA, FSCA, FIC,
// Information Regulator, IASB, BCBS) stays UNMAPPED with a machine-readable
// reason — a residual with a reason beats a fake edge. Sources with no
// objective graph yet (SARB FinSurv, SARS, DoEL, CIPC/King IV, JSE, DoJ&CD,
// FATF, IRBA, ISO/NIST-class standards bodies, ISDA/ICMA-class market
// standards, internal policy handles) are residual classes, never guesses.
//
// Every emitted edge carries a confidenceScore; edges below
// SERVES_CONFIDENCE_THRESHOLD are never emitted (enforced in code, not just by
// rule construction). Confidence tiers:
//   0.90  single graphed instrument named explicitly (PA directive / guidance /
//         communication; FIC Act section; CS x/2018; POPIA/PAIA section)
//   0.85  graphed instrument named alongside others, instrument primacy clear
//         (Banks Act / Regulations relating to Banks; IFRS/IAS standard)
//   0.80  standard-family mapping (BCBS standard → objective partition per
//         generate-bcbs-objective-graph.ts; FIC topic split via keywords)
//   0.75  joint-instrument attribution judgment (PA/FSCA Joint Standards →
//         prudential seat; JS 2/2020 + JN 2/2024 margin → FSCA market-integrity
//         per the MK-RPT-001 precedent); graphed instrument cited secondary
//
// Leaf-objective conventions follow the existing 91 edges:
//   SARB-PA: prudential → SAFETY-SOUNDNESS; recovery/resolution →
//     CUSTOMER-PROTECTION (the #1192 recovery-resolution-planning precedent);
//     payment/settlement SYSTEM participation → MI-SOUNDNESS.
//   FSCA: conduct/FAIS/CS2 → FAIR-TREATMENT; markets/FMA/CS1/CS3/margin-
//     reporting → MARKET-INTEGRITY.
//   FIC: STR/CTR/tipping-off → FINANCIAL-INTELLIGENCE; CDD/records →
//     CDD-INTEGRITY; TFS → TARGETED-SANCTIONS; RMCP/governance/returns →
//     AML-SUPERVISION.
//   IASB: IFRS/IAS recognition-measurement-disclosure → TRANSPARENCY (default
//     per the existing AC edges).
//   BCBS: standard-family partition identical to generate-bcbs-objective-graph
//     {capital→CA, liquidity→LR, risk/FRTB/IRRBB/op-risk→RC, Pillar-3→MD,
//     governance/compliance/resilience/239→SR}.
//
// Pure module: no I/O, no DB. The generator script
// (scripts/generate-adopted-serves-backfill.ts) feeds it the register rows and
// the already-covered set, and writes the committed Plane-A artefact
// (D-REGULATORY-ARCHITECTURE-TWO-PLANE: reference data, re-derivable, NO events).
//
// Authority: D-QUEUE-CLOSEOUT-2026-06-10 (CEO, 2026-06-10), continuing
// WS-REG-INTELLIGENCE-OBJECTIVE-LAYER.
// Author: Mira (Compliance / RegTech engineer, engineering).

/** Minimum confidence an edge must carry to be emitted (else residual). */
export const SERVES_CONFIDENCE_THRESHOLD = 0.7;

/** Timestamp pinned for deterministic artefact regeneration. */
export const SERVES_BACKFILL_EXTRACTED_AT = "2026-06-10T00:00:00Z";

/** The register row fields the derivation reads (subset of the seed JSON). */
export interface AdoptedRegisterRow {
  /** Register id, e.g. "ORG-PR-02" (graph node id = `OBL-${id}`). */
  readonly id: string;
  /** Free-text source citation — the primary derivation signal. */
  readonly citation: string;
  /** Requirement text — secondary signal for leaf-objective splits. */
  readonly requirement?: string;
  /** Obligation URN where assigned (urn:obligation:bank:* or urn:reg:*). */
  readonly urn?: string;
}

export interface DerivedServesEdge {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly edgeType: "SERVES";
  readonly extractionMethod: "rule-based";
  readonly confidenceScore: number;
  readonly extractedAt: string;
  readonly sourceProvision: string;
  readonly metadata: { readonly derivationRule: string };
}

export interface ServesResidual {
  /** Graph node id (OBL-ORG-*). */
  readonly obligationId: string;
  /** Machine-readable residual class. */
  readonly reasonClass: ResidualClass;
  /** Human-readable reason — why no edge was derived. */
  readonly reason: string;
  /** The citation that failed to resolve (audit trail). */
  readonly citation: string;
}

export type ResidualClass =
  | "internal-policy-source"
  | "no-objective-graph:SARB-FinSurv"
  | "no-objective-graph:SARS"
  | "no-objective-graph:DoEL"
  | "no-objective-graph:CIPC-KingIV"
  | "no-objective-graph:JSE"
  | "no-objective-graph:DoJ-CD"
  | "no-objective-graph:FATF"
  | "no-objective-graph:IRBA"
  | "no-objective-graph:DCDT-ECTA"
  | "standards-body-reference"
  | "market-standard-contractual"
  | "ambiguous-citation";

export interface ServesBackfillResult {
  readonly edges: readonly DerivedServesEdge[];
  readonly residuals: readonly ServesResidual[];
  /** Obligations skipped because they already carry a SERVES edge. */
  readonly alreadyCovered: number;
}

// ---------------------------------------------------------------------------
// Objective targets — id, short suffix for edge ids, statutory anchor URN
// (anchor matches the objective node's sourceCitation in the per-regulator
// objective-graph artefacts; used as the SERVES sourceProvision when the row
// has no urn:reg:* of its own — the PA-pilot convention).
// ---------------------------------------------------------------------------

interface ObjectiveTarget {
  readonly objectiveId: string;
  readonly suffix: string;
  readonly anchor: string;
}

const T = (objectiveId: string, suffix: string, anchor: string): ObjectiveTarget => ({
  objectiveId,
  suffix,
  anchor,
});

const FSR = "urn:reg:za:fsr-act-9-2017";
const PA_SS = T("OBJ-SARB-PA-SAFETY-SOUNDNESS", "SS", `${FSR}:s.33(a)`);
const PA_MIS = T("OBJ-SARB-PA-MI-SOUNDNESS", "MIS", `${FSR}:s.33(b)`);
const PA_CP = T("OBJ-SARB-PA-CUSTOMER-PROTECTION", "CP", `${FSR}:s.33(c)`);
const FSCA_FT = T("OBJ-FSCA-FAIR-TREATMENT", "FT", `${FSR}:s.57(a)`);
const FSCA_MI = T("OBJ-FSCA-MARKET-INTEGRITY", "MI", `${FSR}:s.57(b)`);
const FIC_ANCHOR = "urn:reg:za:fic-act-38-2001:s.3";
const FIC_FI = T("OBJ-FIC-FINANCIAL-INTELLIGENCE", "FI", FIC_ANCHOR);
const FIC_CDD = T("OBJ-FIC-CDD-INTEGRITY", "CDD", FIC_ANCHOR);
const FIC_TS = T("OBJ-FIC-TARGETED-SANCTIONS", "TS", FIC_ANCHOR);
const FIC_AS = T("OBJ-FIC-AML-SUPERVISION", "AS", FIC_ANCHOR);
const IASB_TR = T("OBJ-IASB-TRANSPARENCY", "TR", "urn:reg:ifrs:ifrs-foundation-constitution");
const INFOREG_DP = T("OBJ-INFOREG-DATA-PROTECTION", "DP", "urn:reg:za:popia:s39");
const INFOREG_ATI = T("OBJ-INFOREG-ACCESS-TO-INFORMATION", "ATI", "urn:reg:za:paia-2-2000:s51");
const INFOREG_ME = T("OBJ-INFOREG-MONITORING-ENFORCEMENT", "ME", "urn:reg:za:popia:s39");
const BCBS_CHARTER = "urn:reg:bcbs:charter";
const BCBS_CA = T("OBJ-BCBS-CAPITAL-ADEQUACY", "CA", BCBS_CHARTER);
const BCBS_LR = T("OBJ-BCBS-LIQUIDITY-RESILIENCE", "LR", BCBS_CHARTER);
const BCBS_RC = T("OBJ-BCBS-RISK-CAPTURE", "RC", BCBS_CHARTER);
const BCBS_MD = T("OBJ-BCBS-MARKET-DISCIPLINE", "MD", BCBS_CHARTER);
const BCBS_SR = T("OBJ-BCBS-SUPERVISORY-REVIEW", "SR", BCBS_CHARTER);

/** Every objective id this module can target (generator validates presence). */
export const SERVES_BACKFILL_TARGET_OBJECTIVES: readonly string[] = [
  PA_SS,
  PA_MIS,
  PA_CP,
  FSCA_FT,
  FSCA_MI,
  FIC_FI,
  FIC_CDD,
  FIC_TS,
  FIC_AS,
  IASB_TR,
  INFOREG_DP,
  INFOREG_ATI,
  INFOREG_ME,
  BCBS_CA,
  BCBS_LR,
  BCBS_RC,
  BCBS_MD,
  BCBS_SR,
].map((t) => t.objectiveId);

// ---------------------------------------------------------------------------
// Classification — ordered, first-match-wins, citation-driven.
// ---------------------------------------------------------------------------

type Verdict =
  | { kind: "edge"; target: ObjectiveTarget; confidence: number; rule: string }
  | { kind: "residual"; reasonClass: ResidualClass; reason: string };

const edgeVerdict = (target: ObjectiveTarget, confidence: number, rule: string): Verdict => ({
  kind: "edge",
  target,
  confidence,
  rule,
});

const residual = (reasonClass: ResidualClass, reason: string): Verdict => ({
  kind: "residual",
  reasonClass,
  reason,
});

/** SARB-PA leaf selection — citation only (instrument-descriptive text). */
function paLeaf(citation: string): ObjectiveTarget {
  // #1192 precedent: recovery/resolution PLANNING protects customers against
  // institutional failure (FSR Act s.33(c)). Deliberately narrow — "response
  // and recovery" capabilities in e.g. the cyber Joint Standard are
  // operational soundness, not RRP.
  if (
    /recovery (and resolution|plan)|recovery[- ]plan|resolution plan|resolution information pack/i.test(
      citation,
    )
  ) {
    return PA_CP;
  }
  // Payment/settlement SYSTEM soundness (FSR Act s.33(b)) — participation in
  // market infrastructures, not the bank's own settlement-risk management.
  if (/national payment system|payment system participation/i.test(citation)) return PA_MIS;
  return PA_SS;
}

/** FIC leaf selection — citation + requirement keyword split. */
function ficLeaf(text: string): ObjectiveTarget {
  // Supervisory risk returns / RMCP / governance BEFORE the sanctions check —
  // an ML/TF/PF risk-return directive enumerates sanctions among the risks it
  // surveys without itself being a TFS obligation.
  if (/risk returns?|RMCP|compliance function/i.test(text)) return FIC_AS;
  if (/s\.? ?28A|sanction|targeted financial|\bTFS\b/i.test(text)) return FIC_TS;
  if (
    /s\.? ?29|s\.? ?28\b|s\.? ?31|suspicious|tipping[- ]off|\bSTR\b|\bCTR\b|cash threshold/i.test(
      text,
    )
  ) {
    return FIC_FI;
  }
  if (/due diligence|\bCDD\b|identif|verif|s\.? ?2[12]\b|record[- ]?keep/i.test(text)) {
    return FIC_CDD;
  }
  // RMCP, registration, training, governance, compliance returns.
  return FIC_AS;
}

/** FSCA leaf selection — conduct vs markets. */
function fscaLeaf(citation: string): ObjectiveTarget {
  // CS 2/2018 (ODP conduct), FAIS + General Code of Conduct → fair treatment
  // (the CD/FAIS/CS2 precedent edges).
  if (/CS ?2\/2018|Conduct Standard 2 of 2018|FAIS|General Code of Conduct/i.test(citation)) {
    return FSCA_FT;
  }
  // CS 1/2018 (authorisation), CS 3/2018 (trade reporting), FMA, COFI → the
  // efficiency-and-integrity leaf (the MK/FMA/CS1/CS3 precedent edges).
  return FSCA_MI;
}

/**
 * BCBS leaf selection — the standard-family partition of
 * generate-bcbs-objective-graph.ts, applied to the CITATION only (instrument-
 * descriptive text; requirement prose mentioning e.g. "capital" must not skew
 * the family).
 */
function bcbsLeaf(citation: string): ObjectiveTarget {
  if (/\b239\b|RDARR/i.test(citation)) return BCBS_SR; // bcbs-rdarr precedent
  if (/Pillar 3|disclosure/i.test(citation)) return BCBS_MD;
  if (/liquidity|\bLCR\b|\bNSFR\b|\b248\b|\b144\b|intraday/i.test(citation)) return BCBS_LR;
  if (
    /IRRBB|D368|market risk|FRTB|large exposure|counterparty|operational risk|margin/i.test(
      citation,
    )
  ) {
    return BCBS_RC;
  }
  if (/capital|buffer|\bRBC\b|leverage/i.test(citation)) return BCBS_CA;
  // Governance, compliance, audit, compensation, operational resilience, core
  // principles → sound practices / supervisory review.
  return BCBS_SR;
}

/** INFOREG leaf selection. */
function inforegLeaf(text: string): ObjectiveTarget {
  if (/PAIA|access to information/i.test(text)) return INFOREG_ATI;
  if (/information officer|prior authori[sz]|breach notif/i.test(text)) return INFOREG_ME;
  return INFOREG_DP;
}

/**
 * Classify one adopted register row. Ordered, first-match-wins; the order
 * encodes source primacy (e.g. a PA directive issued UNDER the FIC Act is an
 * AML instrument → FIC tokens before PA tokens; an SA transposition citing both
 * the Regulations relating to Banks and the BCBS original serves the SA
 * regulator → PA tokens before BCBS tokens).
 */
export function classifyAdoptedObligation(row: AdoptedRegisterRow): Verdict {
  const c = row.citation ?? "";
  const full = `${c} ${row.requirement ?? ""}`;

  // 1. Internal policy handles — not regulatory sources at all.
  if (/Internal RAS|Internal policy citation|RAS B\d|RAS §B|RAS \//.test(c)) {
    return residual(
      "internal-policy-source",
      "citation is an internal policy / RAS handle, not an external regulatory instrument — no regulator objective to serve",
    );
  }

  // 2. Exchange control — SARB FinSurv (no objective graph in the reference plane yet).
  if (/Currency and Exchanges Manual|Exchange Control Regulation|FinSurv/i.test(c)) {
    return residual(
      "no-objective-graph:SARB-FinSurv",
      "source instrument is administered by SARB FinSurv, which has no objective graph in the reference plane yet",
    );
  }

  // 3. Tax — SARS (no objective graph).
  if (
    /Income Tax Act|VAT Act|Tax Admin(istration)? Act|Securities Transfer Tax|FATCA|\bCRS\b|Skills Development Levies/.test(
      c,
    )
  ) {
    return residual(
      "no-objective-graph:SARS",
      "source instrument is administered by SARS, which has no objective graph in the reference plane yet",
    );
  }

  // 4. AML/CFT — FIC (incl. PA directives issued UNDER the FIC Act).
  if (/FIC Act|FICA\b|Money Laundering|POCDATARA|\bPCC ?\d|issued under FIC/i.test(c)) {
    const single = /^FIC Act s\.\d+/.test(c.trim());
    return edgeVerdict(ficLeaf(full), single ? 0.9 : 0.8, "fic-instrument");
  }

  // 5a. JSE rule-sets (Equities/Debt/IRC/Clear rules + listings requirements):
  //     exchange/SRO rules, even where the citation notes FMA licensing or
  //     FSCA approval — consistent with the JSE residual class below.
  if (/^JSE /.test(c.trim())) {
    return residual(
      "no-objective-graph:JSE",
      "exchange / SRO rule-set (JSE), which has no objective graph in the reference plane yet",
    );
  }

  // 5. Conduct / markets — FSCA instruments.
  if (
    /FAIS|General Code of Conduct|FSCA Conduct Standard|\bCS ?[123]\/2018|Conduct Standard [123] of 2018|Financial Markets Act|\bFMA\b|COFI/.test(
      c,
    )
  ) {
    const single = /^(CS ?[123]\/2018|FSCA Conduct Standard)/.test(c.trim());
    return edgeVerdict(fscaLeaf(c), single ? 0.9 : 0.8, "fsca-instrument");
  }

  // 6. OTC-derivative margin stack (JS 2/2020 + JN 2/2024) → FSCA market
  //    integrity, per the hand-authored MK-RPT-001 precedent edge.
  if (/JS ?2\/2020|Joint Standard 2[ /](of )?2020|JN ?2\/2024|Joint Notice 2\/2024/.test(c)) {
    return edgeVerdict(FSCA_MI, 0.75, "fsca-margin-stack");
  }

  // 7. PA directives / guidance / communications — explicit PA instrument.
  if (
    /SARB (Prudential Authority )?\*{0,2}Directive|SARB PA Directive|Prudential Authority.{0,4}Directive|PA Directive|Guidance Note \d+ of \d{4}|PA Guidance|Prudential Communication/.test(
      c,
    )
  ) {
    return edgeVerdict(paLeaf(c), 0.9, "pa-directive");
  }

  // 8. Banks Act / Regulations relating to Banks (incl. mixed citations — the
  //    Banks Act presence carries PA primacy over Companies Act / King IV / BCBS
  //    originals cited alongside).
  if (/Banks Act|Regulations? [Rr]elating to Banks|\bReg(ulation)? ?\d+\b.{0,40}Banks/.test(c)) {
    return edgeVerdict(paLeaf(c), 0.85, "pa-banks-act");
  }

  // 9. Remaining PA/FSCA Joint Standards (IT governance JS 1/2023, cyber
  //    JS 2/2024, significant owner JS 1/2020) → prudential operational
  //    soundness; attribution to the PA seat is a judgment call → 0.75.
  if (/Joint Standard|\bJS ?\d\/20\d\d/.test(c)) {
    return edgeVerdict(paLeaf(c), 0.75, "pa-joint-standard");
  }

  // 10. Privacy — Information Regulator.
  if (/POPIA|PAIA|Information Regulator/.test(c)) {
    const single = /^(POPIA|PAIA)/.test(c.trim());
    return edgeVerdict(inforegLeaf(full), single ? 0.9 : 0.8, "inforeg-instrument");
  }

  // 11. Accounting — IASB (IFRS/IAS standards; default transparency per the
  //     existing AC edges).
  if (/IFRS|\bIAS \d|IASB/.test(c)) {
    const single = /^(IFRS|IAS)\b/.test(c.trim());
    return edgeVerdict(IASB_TR, single ? 0.85 : 0.75, "iasb-instrument");
  }

  // 12. Basel originals cited directly (no SA transposition in the citation).
  //     Company-law primacy guard: when Companies Act / King IV LEADS the
  //     citation and BCBS is only a supporting reference, the source is the
  //     (ungraphed) company-law instrument — fall through to the residual
  //     classes rather than crediting BCBS.
  const bcbsIdx = c.search(/BCBS|Basel/);
  if (bcbsIdx >= 0) {
    const companyIdx = c.search(/Companies Act|Companies Reg|King IV/);
    if (companyIdx < 0 || companyIdx > bcbsIdx) {
      return edgeVerdict(bcbsLeaf(c), 0.8, "bcbs-standard-family");
    }
  }

  // 13. Known no-graph sources — honest residual classes.
  if (/FATF/.test(c)) {
    return residual(
      "no-objective-graph:FATF",
      "source is a FATF recommendation / mutual-evaluation output; FATF has no objective graph in the reference plane yet",
    );
  }
  if (/IRBA/.test(c)) {
    return residual(
      "no-objective-graph:IRBA",
      "source is administered by IRBA (audit regulation), which has no objective graph in the reference plane yet",
    );
  }
  if (/Protected Disclosures|PRECCA|Bribery Act|FCPA/.test(c)) {
    return residual(
      "no-objective-graph:DoJ-CD",
      "anti-corruption / whistleblowing source (DoJ&CD / foreign criminal law) — no objective graph in the reference plane yet",
    );
  }
  if (/ECTA|Electronic Communications and Transactions/.test(c)) {
    return residual(
      "no-objective-graph:DCDT-ECTA",
      "ECTA electronic-transactions source — no objective graph in the reference plane yet",
    );
  }
  if (
    /Labour Relations|\bLRA\b|\bBCEA\b|Employment Equity|\bEE Act\b|Skills Development|Occupational Health|B-BBEE/.test(
      c,
    )
  ) {
    return residual(
      "no-objective-graph:DoEL",
      "labour / employment source (DoEL), which has no objective graph in the reference plane yet",
    );
  }
  if (/ISO\/IEC|ISO \d|NIST|SLSA/.test(c)) {
    return residual(
      "standards-body-reference",
      "voluntary standards-body reference (ISO/NIST/SLSA) adopted as internal benchmark — not a regulator with objectives",
    );
  }
  if (/ISDA|GMRA|GMSLA|ICMA|ZARONIA/.test(c)) {
    return residual(
      "market-standard-contractual",
      "market-standard / contractual source (ISDA/ICMA/ZARONIA) — not a regulator with objectives",
    );
  }
  if (/JSE/.test(c)) {
    return residual(
      "no-objective-graph:JSE",
      "exchange / SRO rule-set (JSE), which has no objective graph in the reference plane yet",
    );
  }
  if (/Companies Act|Companies Reg|King IV/.test(c)) {
    return residual(
      "no-objective-graph:CIPC-KingIV",
      "company-law / corporate-governance source (CIPC / King IV), which has no objective graph in the reference plane yet",
    );
  }

  // 14. Nothing matched — honest unknown.
  return residual(
    "ambiguous-citation",
    "citation does not resolve to a graphed regulator instrument by any derivation rule",
  );
}

/**
 * Derive the SERVES backfill for the adopted register: one edge per still-
 * uncovered obligation whose source resolves to a graphed regulator objective
 * with confidence ≥ SERVES_CONFIDENCE_THRESHOLD; everything else is a residual
 * with a reason. Deterministic and pure (stable edge ids, pinned timestamp).
 */
export function deriveServesBackfill(
  rows: readonly AdoptedRegisterRow[],
  coveredObligationIds: ReadonlySet<string>,
): ServesBackfillResult {
  const edges: DerivedServesEdge[] = [];
  const residuals: ServesResidual[] = [];
  let alreadyCovered = 0;

  for (const row of rows) {
    const nodeId = `OBL-${row.id}`;
    if (coveredObligationIds.has(nodeId)) {
      alreadyCovered++;
      continue;
    }
    const verdict = classifyAdoptedObligation(row);
    if (verdict.kind === "residual") {
      residuals.push({
        obligationId: nodeId,
        reasonClass: verdict.reasonClass,
        reason: verdict.reason,
        citation: row.citation,
      });
      continue;
    }
    // Threshold enforced in code — a rule that ever returns a low-confidence
    // verdict degrades to a residual, never a weak edge.
    if (verdict.confidence < SERVES_CONFIDENCE_THRESHOLD) {
      residuals.push({
        obligationId: nodeId,
        reasonClass: "ambiguous-citation",
        reason: `derived mapping confidence ${verdict.confidence} below threshold ${SERVES_CONFIDENCE_THRESHOLD} (rule ${verdict.rule})`,
        citation: row.citation,
      });
      continue;
    }
    const urn = (row.urn ?? "").replace(/`/g, "").trim();
    edges.push({
      id: `OBJ-SERVES-BF-${row.id}-${verdict.target.suffix}`,
      fromId: nodeId,
      toId: verdict.target.objectiveId,
      edgeType: "SERVES",
      extractionMethod: "rule-based",
      confidenceScore: verdict.confidence,
      extractedAt: SERVES_BACKFILL_EXTRACTED_AT,
      sourceProvision: urn.startsWith("urn:reg:") ? urn : verdict.target.anchor,
      metadata: { derivationRule: verdict.rule },
    });
  }

  return { edges, residuals, alreadyCovered };
}
