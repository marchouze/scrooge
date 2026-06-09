// prototype/scripts/obligation-summaries/domain-a-summaries.ts
//
// P4 PILOT — Mira-authored reviewed requirement summaries for Domain A
// (Prudential: capital, liquidity, large exposures, leverage, market-risk
// capital, Pillar-3 disclosure) under D-OBLIGATIONS-REGISTER-CLEANUP Phase 4.
//
// This module is the SINGLE authored origin for the Domain-A review pass. Both
// the review-event emitter (`author-domain-a-summaries.ts`) and the corrected-
// ObligationAdopted backfill (SA via the seed; BCBS via a one-off emit) read it,
// so the `ObligationReviewCompleted` audit trail and the corrected
// `ObligationAdopted.requirement` cannot drift apart.
//
// Authoring rules (per brief):
//   - `reviewed-confirmed`  — the existing register `requirement` is already an
//     accurate plain-English summary; no rewrite. The review event records the
//     confirmation; the requirement is unchanged.
//   - `reviewed-modified`   — the existing `requirement` is a bare chapter title
//     (every BCBS-* row) or thin (the high-level ORG-PR-01..15 one-liners); the
//     authored `summary` replaces it as the corrected requirement.
//   - BCBS summaries are grounded in the obligation's EXTRACTED source text
//     (chapter-text.json, surfaced by getObligationDetail) plus the urn citation.
//   - SA summaries are authored from the citation + the existing requirement
//     prose; SA source text is `missing` in the drill-down (the graph has no
//     extractable Provision text for the SA instruments), which is noted, not
//     fabricated around.
//
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zara
//   (Chief Compliance Officer, governance)).

export type ReviewVerdict = "reviewed-confirmed" | "reviewed-modified";

export interface DomainASummary {
  /** Owning seat (cfo/cro/treasurer/...) — the obligation's owner; the review
   *  event's reviewerSeat. Mira authors; the owning seat holds accountability. */
  readonly reviewerSeat: string;
  readonly verdict: ReviewVerdict;
  /** Authored summary; present only for `reviewed-modified`. Becomes the
   *  corrected `ObligationAdopted.requirement`. */
  readonly summary?: string;
  /** One-line review rationale; survives in the ObligationReviewCompleted trail. */
  readonly rationale: string;
}

// ---------------------------------------------------------------------------
// BCBS prudential chapters (36) — all `reviewed-modified`: the register row
// carries only the chapter title; the summary is authored from the extracted
// Basel Framework source text + the urn:reg:bcbs citation.
// ---------------------------------------------------------------------------

const BCBS: Record<string, DomainASummary> = {
  // ── Credit risk (CRE) — owner cro ──────────────────────────────────────
  "BCBS-CRE20": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Apply the standardised approach to credit risk: assign the prescribed standardised risk weights to banking-book exposures by counterparty/exposure class and compute risk-weighted assets as risk weight × exposure amount, measured net of specific provisions and partial write-offs. The standardised approach (CRE20–CRE22) is the default methodology where the bank does not use, or is not approved for, the internal ratings-based approach.",
    rationale:
      "Register row was the bare chapter title; summary authored from CRE20 source text (urn:reg:bcbs:cre:20) — standardised RWA = risk weight × net exposure.",
  },
  "BCBS-CRE21": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Where external ratings are used for standardised-approach risk-weighting, only credit assessments from rating agencies recognised as External Credit Assessment Institutions (ECAIs) by the supervisor may be relied upon, and only for exposure types where the ECAI meets the eligibility criteria. Map ECAI ratings to risk-weight buckets per the prescribed correspondence, applying the mapping consistently and avoiding cherry-picking of favourable ratings.",
    rationale:
      "Bare chapter title; summary authored from CRE21 source text (urn:reg:bcbs:cre:21) — ECAI recognition + rating-to-risk-weight mapping.",
  },
  "BCBS-CRE22": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Recognise eligible credit risk mitigation (collateral, on-balance-sheet netting, guarantees, credit derivatives) against banking-book standardised-approach exposures, subject to the legal-certainty and operational requirements of the framework. Apply the prescribed haircuts and the substitution or comprehensive treatment so that the capital benefit reflects only the residual, mitigated risk.",
    rationale:
      "Bare chapter title; summary authored from CRE22 source text (urn:reg:bcbs:cre:22) — eligible CRM techniques, legal certainty, haircuts.",
  },
  "BCBS-CRE50": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Apply the counterparty-credit-risk (CCR) definitions and terminology that underpin the CCR capital framework. CCR is the risk that a counterparty to a derivative, securities-financing or long-settlement transaction defaults before final settlement, creating a bilateral risk of loss because the transaction's market value can be positive or negative to either party; netting sets, margin and collateral terms are defined here for use across CRE51–CRE55.",
    rationale:
      "Bare chapter title; summary authored from CRE50 source text (urn:reg:bcbs:cre:50) — CCR definition, bilateral loss, netting-set terminology.",
  },
  "BCBS-CRE51": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Identify all transactions that expose the bank to counterparty credit risk and calculate a CCR capital charge for them. Select the permitted exposure-measurement approach (SA-CCR per CRE52, or the internal model method where approved) and compute the resulting capital requirement, distinct from the issuer/market-risk treatment of the same instruments.",
    rationale:
      "Bare chapter title; summary authored from CRE51 source text (urn:reg:bcbs:cre:51) — identify CCR transactions, choose measurement approach, charge capital.",
  },
  "BCBS-CRE52": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Use the Standardised Approach for Counterparty Credit Risk (SA-CCR) to compute exposure-at-default for OTC derivatives, exchange-traded derivatives and long-settlement transactions where the bank is not approved for the internal model method. Calculate EAD per netting set as 1.4 × (replacement cost + potential future exposure), recognising eligible margin and collateral as prescribed.",
    rationale:
      "Bare chapter title; summary authored from CRE52 source text (urn:reg:bcbs:cre:52) — SA-CCR EAD = 1.4 × (RC + PFE) per netting set.",
  },
  "BCBS-CRE54": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Capitalise exposures to central counterparties (CCPs) arising from cleared derivatives, SFTs and long-settlement transactions per the prescribed treatment, distinguishing qualifying CCPs (QCCPs) from non-qualifying CCPs. Hold capital against trade exposures and default-fund contributions to QCCPs at the concessionary risk weights, and apply full bilateral treatment to non-qualifying CCPs.",
    rationale:
      "Bare chapter title; summary authored from CRE54 source text (urn:reg:bcbs:cre:54) — QCCP vs non-QCCP trade-exposure + default-fund capital.",
  },
  "BCBS-CRE55": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Calculate the counterparty-credit-risk charge for OTC derivatives, repo-style and other transactions booked in the trading book separately from the market-risk capital requirement, using risk weights consistent with those applied in the banking book (standardised or IRB as applicable). The CCR charge for trading-book positions is additive to, and does not displace, the market-risk capital requirement.",
    rationale:
      "Bare chapter title; summary authored from CRE55 source text (urn:reg:bcbs:cre:55) — trading-book CCR charge separate from + additive to market risk.",
  },
  "BCBS-CRE70": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Hold capital against unsettled and failed securities, commodities and foreign-exchange transactions from trade date, irrespective of booking or accounting treatment. For delivery-versus-payment transactions apply the prescribed escalating risk weights by the number of business days past the contractual settlement date; for non-DvP (free-delivery) transactions treat the unsettled exposure as a counterparty exposure and capitalise accordingly.",
    rationale:
      "Bare chapter title; summary authored from CRE70 source text (urn:reg:bcbs:cre:70) — DvP escalating weights + non-DvP free-delivery treatment.",
  },

  // ── Pillar-3 disclosure (DIS) — owner cfo ──────────────────────────────
  "BCBS-DIS10": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the Pillar-3 disclosure framework's definitions, scope and general presentation requirements: disclosures are made at the top consolidated level of the banking group, on the prescribed fixed and flexible templates and tables, at the frequency set per template, to promote market discipline and comparability of banks' risk profiles. Governs which entities disclose, the signposting and location rules, and the qualitative narrative expected alongside the quantitative templates.",
    rationale:
      "Bare chapter title; summary authored from DIS10 source text (urn:reg:bcbs:dis:10) — Pillar-3 scope, consolidation level, template/table conventions.",
  },
  "BCBS-DIS20": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Publish the Pillar-3 overview disclosures: template KM1 (key prudential metrics — available capital and ratios including buffers, RWA, leverage ratio, LCR and NSFR as a time series), KM2 (TLAC key metrics at resolution-group level where applicable), table OVA (the bank's risk-management approach) and template OV1 (overview of risk-weighted assets by risk type). These give market participants a consolidated, comparable snapshot of the bank's capital adequacy, liquidity and RWA composition.",
    rationale:
      "Bare chapter title; summary authored from DIS20 source text (urn:reg:bcbs:dis:20) — KM1/KM2/OVA/OV1 overview disclosure set.",
  },

  // ── Large exposures (LEX) — owner cro ──────────────────────────────────
  "BCBS-LEX10": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Apply the large-exposures framework's definitions and scope: it limits the maximum loss a bank could face from the sudden default of a single counterparty or group of connected counterparties to a level that does not threaten solvency, complementing the risk-based capital standard. Defines a 'large exposure' (≥10% of Tier-1 capital), a 'group of connected counterparties' (control and economic-interdependence tests), and the consolidation scope at which the limit applies.",
    rationale:
      "Bare chapter title; summary authored from LEX10 source text (urn:reg:bcbs:lex:10) — purpose, ≥10% large-exposure definition, connected-counterparty test.",
  },
  "BCBS-LEX20": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Cap the sum of all exposure values to a single counterparty or group of connected counterparties at 25% of the bank's Tier-1 capital at all times (15% for a G-SIB's exposures to another G-SIB), with Tier-1 capital as defined in CAP10. Breaches must remain exceptional, be reported immediately to the supervisor, and be rapidly rectified.",
    rationale:
      "Bare chapter title; summary authored from LEX20 source text (urn:reg:bcbs:lex:20) — 25%/15% Tier-1 cap, immediate breach reporting.",
  },
  "BCBS-LEX30": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Measure large-exposure values using the same exposure definitions as the risk-based capital framework, including both on- and off-balance-sheet exposures across the banking and trading books and instruments carrying counterparty credit risk. Use the accounting value (or the prescribed regulatory exposure measure) and do not add back to a counterparty's exposure any amount already deducted from capital.",
    rationale:
      "Bare chapter title; summary authored from LEX30 source text (urn:reg:bcbs:lex:30) — exposure measurement basis, banking+trading book, no double-count of capital deductions.",
  },

  // ── Leverage ratio (LEV) — owner cro ───────────────────────────────────
  "BCBS-LEV10": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Apply the leverage-ratio framework over the same regulatory consolidation scope as the risk-based capital framework (per the SCO standard). For entities outside the consolidation scope, include only the carrying value of the investment in the leverage-ratio exposure measure rather than the underlying assets, with the prescribed treatment of investments in unconsolidated financial entities.",
    rationale:
      "Bare chapter title; summary authored from LEV10 source text (urn:reg:bcbs:lev:10) — leverage-ratio consolidation scope, treatment of unconsolidated investments.",
  },
  "BCBS-LEV20": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Calculate the Basel III leverage ratio as Tier-1 capital divided by the total exposure measure, expressed as a percentage and met at the prescribed minimum at all times. The ratio is a simple, non-risk-based backstop to the risk-based capital requirements, designed to restrain the build-up of leverage and to capture both on- and off-balance-sheet sources of leverage.",
    rationale:
      "Bare chapter title; summary authored from LEV20 source text (urn:reg:bcbs:lev:20) — leverage ratio = Tier-1 ÷ exposure measure, non-risk-based backstop.",
  },
  "BCBS-LEV30": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Build the leverage-ratio exposure measure from gross accounting values, comprising on-balance-sheet exposures, derivative exposures (SA-CCR replacement cost plus potential future exposure), securities-financing-transaction exposures and off-balance-sheet items converted at the prescribed credit-conversion factors. Recognise collateral and netting only as specifically permitted, and treat long-settlement transactions and failed trades per their accounting classification.",
    rationale:
      "Bare chapter title; summary authored from LEV30 source text (urn:reg:bcbs:lev:30) — gross-accounting exposure measure: on-BS + derivatives + SFT + off-BS CCF.",
  },

  // ── Liquidity Coverage Ratio (LCR) — owner cfo ─────────────────────────
  "BCBS-LCR10": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the LCR standard and the associated liquidity monitoring metrics over the consolidation scope set in SCO10: the LCR applies to internationally active banks on a consolidated basis and may be extended to other banks and to subsets of group entities. Establishes the application boundary, currency scope and consolidation conventions on which the LCR calculation in LCR20 operates.",
    rationale:
      "Bare chapter title; summary authored from LCR10 source text (urn:reg:bcbs:lcr:10) — LCR scope of application + consolidation conventions.",
  },
  "BCBS-LCR20": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Maintain a Liquidity Coverage Ratio — stock of unencumbered high-quality liquid assets divided by total net cash outflows over a 30-calendar-day stress period — of at least 100%. The prescribed stress scenario combines an idiosyncratic and a market-wide shock (retail-deposit run-off, partial loss of unsecured and secured wholesale funding, and additional contingent outflows), ensuring the bank can survive 30 days of acute liquidity stress.",
    rationale:
      "Bare chapter title; summary authored from LCR20 source text (urn:reg:bcbs:lcr:20) — LCR = HQLA ÷ 30-day net outflows ≥ 100% under the combined stress scenario.",
  },
  "BCBS-LCR30": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Hold the LCR numerator as a stock of unencumbered high-quality liquid assets that remain liquid in stressed markets and are ideally central-bank-eligible, meeting the prescribed fundamental, market-related and operational requirements. Classify assets into Level 1 (no haircut, no cap), Level 2A (15% haircut) and Level 2B (≥25% haircut), with Level 2 capped at 40% of total HQLA and Level 2B capped at 15%.",
    rationale:
      "Bare chapter title; summary authored from LCR30 source text (urn:reg:bcbs:lcr:30) — HQLA eligibility, Level 1/2A/2B haircuts and caps.",
  },
  "BCBS-LCR31": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Where a jurisdiction has an insufficient domestic-currency supply of Level 1 (or Level 1 and Level 2) HQLA to meet aggregate bank demand, apply the prescribed alternative liquidity approaches — contractual committed liquidity facilities from the central bank, foreign-currency HQLA to cover domestic-currency outflows, or additional use of Level 2 assets with a higher haircut — strictly within the qualifying criteria and supervisory conditions.",
    rationale:
      "Bare chapter title; summary authored from LCR31 source text (urn:reg:bcbs:lcr:31) — ALA options for HQLA-short currencies under qualifying criteria.",
  },
  "BCBS-LCR40": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Compute total net cash outflows as total expected cash outflows minus total expected cash inflows over the 30-day stress horizon, with inflows capped at 75% of outflows. Apply the prescribed run-off rates to liability and off-balance-sheet categories (retail/wholesale, stable/less-stable deposits, secured funding, committed facilities) and the prescribed inflow rates to contractual receivables.",
    rationale:
      "Bare chapter title; summary authored from LCR40 source text (urn:reg:bcbs:lcr:40) — net outflows = outflows − min(inflows, 75% outflows); prescribed run-off/inflow rates.",
  },
  "BCBS-LCR99": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the LCR application-guidance summary table when classifying HQLA and assigning run-off and inflow factors: it consolidates the Level 1 (100%), Level 2A (85%) and Level 2B factors for the HQLA stock and the outflow/inflow factors by category into a single reference. This guidance chapter is a computational aid to LCR20–LCR40, not an independent obligation.",
    rationale:
      "Bare chapter title; summary authored from LCR99 source text (urn:reg:bcbs:lcr:99) — consolidated factor table; computational aid to LCR20–40.",
  },

  // ── Net Stable Funding Ratio (NSF) — owner cfo ─────────────────────────
  "BCBS-NSF10": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the NSFR's definitions and scope, mirroring the LCR definitions except where national discretion is explicitly exercised. The NSFR uses internationally agreed definitions and calibrations of available and required stable funding; jurisdiction-specific choices must be clearly set out in national regulation, and the standard applies over the same consolidation scope as the LCR.",
    rationale:
      "Bare chapter title; summary authored from NSF10 source text (urn:reg:bcbs:nsf:10) — NSFR definitions mirror LCR; national-discretion items must be explicit.",
  },
  "BCBS-NSF20": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Maintain a Net Stable Funding Ratio — available stable funding divided by required stable funding — of at least 100% on an ongoing basis, and report it at the prescribed frequency. The NSFR requires a stable funding profile relative to the composition of assets and off-balance-sheet activities over a one-year horizon, limiting over-reliance on short-term wholesale funding and reducing the risk that funding disruptions erode the bank's liquidity position.",
    rationale:
      "Bare chapter title; summary authored from NSF20 source text (urn:reg:bcbs:nsf:20) — NSFR = ASF ÷ RSF ≥ 100%, one-year stable-funding horizon.",
  },
  "BCBS-NSF30": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Compute available stable funding (the NSFR numerator) by applying the prescribed ASF factors to liabilities and capital by funding tenor and counterparty stability (e.g. 100% for capital and ≥1-year funding, 95%/90% for stable/less-stable retail deposits, lower factors for short-term wholesale funding), and required stable funding (the denominator) by applying RSF factors to assets and off-balance-sheet exposures by liquidity and residual maturity. The calibration presumes longer-tenor and more-stable funding sources require less, and less-liquid assets require more, stable funding.",
    rationale:
      "Bare chapter title; summary authored from NSF30 source text (urn:reg:bcbs:nsf:30) — ASF/RSF factor calibration by tenor, counterparty and asset liquidity.",
  },
  "BCBS-NSF99": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the NSFR summary tables that set out each available-stable-funding and required-stable-funding category against its maximum ASF/RSF factor (e.g. 100% ASF for regulatory capital and long-term liabilities, 95% for stable non-maturity deposits, descending factors for shorter and less-stable funding). This reference chapter consolidates the NSF30 calibration into category-factor tables and is a computational aid, not an independent obligation.",
    rationale:
      "Bare chapter title; summary authored from NSF99 source text (urn:reg:bcbs:nsf:99) — ASF/RSF category-factor summary tables; computational aid to NSF30.",
  },

  // ── Market-risk capital (MAR) — owner cro ──────────────────────────────
  "BCBS-MAR10": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Apply the market-risk terminology that underpins the FRTB capital framework: market risk is the risk of losses in on- and off-balance-sheet positions arising from movements in market prices, and the chapter defines notional value, trading desk, pricing model and related terms used consistently across MAR11–MAR50. These definitions fix the scope of instruments and risk factors subject to market-risk capital.",
    rationale:
      "Bare chapter title; summary authored from MAR10 source text (urn:reg:bcbs:mar:10) — market-risk definitions/terminology for the FRTB framework.",
  },
  "BCBS-MAR11": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Capitalise market risk — losses arising from movements in market prices — across default risk, interest-rate, credit-spread, equity, FX and commodities risk for trading-book instruments, plus FX and commodities risk for banking-book instruments. Include all transactions (including forward sales and purchases) from trade date in the capital calculation, applying the trading-book/banking-book boundary rules to determine scope.",
    rationale:
      "Bare chapter title; summary authored from MAR11 source text (urn:reg:bcbs:mar:11) — market-risk scope, risk factors, trading/banking-book boundary.",
  },
  "BCBS-MAR12": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Define trading desks for market-risk capital as groups of traders or trading accounts implementing a well-defined business strategy within a clear risk-management structure, subject to supervisory approval. Maintain a policy document for each desk evidencing how it satisfies the structural requirements; the desk structure is the unit at which internal-model-approach approval, P&L attribution and backtesting are assessed.",
    rationale:
      "Bare chapter title; summary authored from MAR12 source text (urn:reg:bcbs:mar:12) — trading-desk definition + per-desk policy/approval requirement.",
  },
  "BCBS-MAR20": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Compute market-risk RWA under the standardised approach as the capital requirement (the sum of the sensitivities-based method, default-risk capital and residual-risk add-on per MAR21–MAR23) multiplied by 12.5, and report it to the supervisor at least monthly. All banks must be able to calculate the standardised approach as a fallback and disclosure benchmark even where an internal model is approved.",
    rationale:
      "Bare chapter title; summary authored from MAR20 source text (urn:reg:bcbs:mar:20) — SA market-risk RWA = capital × 12.5; monthly reporting; mandatory fallback.",
  },
  "BCBS-MAR21": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Calculate the sensitivities-based-method component of standardised market-risk capital from the delta, vega and curvature sensitivities of instruments to a prescribed list of risk factors across seven risk classes (GIRR, credit-spread non-securitisation, credit-spread securitisation CTP and non-CTP, equity, commodity and FX). Risk-weight the sensitivities and aggregate them within risk buckets and then across buckets using the prescribed correlations and the low/medium/high correlation scenarios.",
    rationale:
      "Bare chapter title; summary authored from MAR21 source text (urn:reg:bcbs:mar:21) — delta/vega/curvature, seven risk classes, bucket+cross-bucket aggregation.",
  },
  "BCBS-MAR22": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Compute the default-risk capital (DRC) requirement to capture jump-to-default risk not reflected in the sensitivities-based credit-spread shocks, calculated separately for non-securitisations, securitisations (non-CTP) and the correlation trading portfolio. Net long and short jump-to-default exposures to the same obligor in full, recognise partial hedging across distinct obligors via the prescribed offsetting/hedge-benefit ratio, and apply the prescribed default risk weights.",
    rationale:
      "Bare chapter title; summary authored from MAR22 source text (urn:reg:bcbs:mar:22) — DRC for jump-to-default; same-obligor netting + cross-obligor hedge benefit.",
  },
  "BCBS-MAR23": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Calculate the residual-risk add-on (RRAO) for all instruments bearing residual risk — instruments with an exotic underlying outside the delta/vega/curvature and DRC scope, and instruments bearing other residual risks (gap, correlation, behavioural) — as a simple add-on on top of the other standardised-approach components. Apply the prescribed RRAO risk weights to the gross notional of the in-scope instruments.",
    rationale:
      "Bare chapter title; summary authored from MAR23 source text (urn:reg:bcbs:mar:23) — RRAO for exotic-underlying + other-residual-risk instruments on gross notional.",
  },
  "BCBS-MAR40": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Where the bank qualifies and elects the simplified standardised approach, compute market-risk RWA as the prescribed interest-rate, equity, FX and commodities risk measures (plus the options treatments) summed arithmetically and multiplied by 12.5. The simplified approach is available to banks with smaller, less-complex trading activities as an alternative to the full sensitivities-based standardised approach.",
    rationale:
      "Bare chapter title; summary authored from MAR40 source text (urn:reg:bcbs:mar:40) — simplified SA: arithmetic sum of risk measures × 12.5 for eligible banks.",
  },
  "BCBS-MAR50": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Capitalise credit-valuation-adjustment (CVA) risk — the risk of mark-to-market losses from changes in counterparty credit spreads and associated market factors on derivatives and securities-financing transactions — under the prescribed standardised (SA-CVA) or basic (BA-CVA) approach, with CVA RWA computed as the capital requirement multiplied by 12.5. Regulatory CVA is defined separately from accounting CVA and covers the counterparty-level adjustment to default-risk-free prices.",
    rationale:
      "Bare chapter title; summary authored from MAR50 source text (urn:reg:bcbs:mar:50) — CVA-risk capital (SA-CVA/BA-CVA), CVA RWA = capital × 12.5.",
  },
};

// ---------------------------------------------------------------------------
// SA ORG-PR thin high-level rows (7) — `reviewed-modified`: existing one-liner
// is accurate but thin; expanded to a 2-sentence summary grounded in the
// citation. SA source text is `missing` in the drill-down (no extractable
// graph Provision text for the SA instruments) — noted in the rationale, not
// fabricated around.
// ---------------------------------------------------------------------------

const SA_MODIFIED: Record<string, DomainASummary> = {
  "ORG-PR-02": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the Pillar 2A capital add-on set by the Prudential Authority under Regulation 38 of the Regulations relating to Banks, holding qualifying capital above the Pillar 1 minimum to cover risks not fully captured by the standardised/IMA Pillar 1 charges. The add-on is PA-determined and bank-specific and must be met at all times alongside the Pillar 1 minima and capital buffers.",
    rationale:
      "Existing requirement was a thin one-liner; expanded to a 2-sentence summary from the Reg 38 citation. SA source text missing in the drill-down (no extractable graph Provision text for Reg 38).",
  },
  "ORG-PR-05": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Maintain a Basel III leverage ratio — Tier-1 capital divided by the total leverage exposure measure — at or above the regulatory minimum at all times, as a non-risk-based backstop to the risk-based capital requirements. The exposure measure follows gross accounting values across on-balance-sheet, derivative (SA-CCR), securities-financing and off-balance-sheet exposures per the SA transposition of the BCBS leverage framework.",
    rationale:
      "Thin one-liner; expanded from the BCBS LEV citation and the SA Reg 38 leverage transposition. SA source text missing in the drill-down.",
  },
  "ORG-PR-08": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Monitor intraday liquidity positions and the prescribed BCBS intraday-liquidity monitoring metrics (daily maximum intraday liquidity usage, available intraday liquidity, total payments and time-specific obligations), and report them to the Prudential Authority on the prescribed cadence. The monitoring supports management of the bank's ability to meet payment and settlement obligations on a timely basis under both normal and stressed conditions.",
    rationale:
      "Thin one-liner; expanded from the BCBS 248 intraday-liquidity citation. SA source text missing in the drill-down.",
  },
  "ORG-PR-11": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Measure and manage interest-rate risk in the banking book (IRRBB) using both the economic-value-of-equity (EVE) and net-interest-income (NII) metrics across the prescribed interest-rate shock scenarios, per BCBS d368. Keep the EVE sensitivity within the supervisory outlier threshold and govern IRRBB through board-approved limits, behavioural assumptions and regular reporting.",
    rationale:
      "Thin one-liner; expanded from the BCBS d368 IRRBB citation (EVE + NII, supervisory outlier test). SA source text missing in the drill-down.",
  },
  "ORG-PR-13": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Submit an annual Internal Capital Adequacy Assessment Process (ICAAP) to the Prudential Authority under the Banks Act and the PA's Pillar 2 guidance, evidencing that the bank holds capital commensurate with its full risk profile under base and stressed conditions. The ICAAP covers risk identification, capital planning, stress testing and board oversight, and informs the PA's supervisory review and Pillar 2A determination.",
    rationale:
      "Thin one-liner; expanded from the Banks Act + PA Pillar 2 citation. SA source text missing in the drill-down.",
  },
  "ORG-PR-14": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Submit an annual Internal Liquidity Adequacy Assessment Process (ILAAP) to the Prudential Authority under the Banks Act and the PA's liquidity guidance, evidencing that the bank's liquidity resources and funding profile are adequate under base and stressed conditions. The ILAAP covers liquidity-risk identification, the funding plan, stress testing, the contingency funding plan and board oversight, and informs the PA's supervisory liquidity review.",
    rationale:
      "Thin one-liner; expanded from the Banks Act + PA liquidity citation. SA source text missing in the drill-down.",
  },
  "ORG-PR-15": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Maintain a board-approved Contingency Funding Plan (CFP) setting out the early-warning indicators, escalation governance, and the menu of funding actions the bank would take under liquidity stress, consistent with the BCBS Principles for Sound Liquidity Risk Management (BCBS 144). Rehearse and review the CFP at least annually and after material changes to the funding profile or market conditions.",
    rationale:
      "Thin one-liner; expanded from the BCBS 144 sound-liquidity-management citation. SA source text missing in the drill-down.",
  },
};

/** Every Domain-A obligation that carries an explicit modification verdict. */
export const DOMAIN_A_MODIFICATIONS: Record<string, DomainASummary> = {
  ...BCBS,
  ...SA_MODIFIED,
};

/** Set of Domain-A ids the authoring pass treats as BCBS (event-level correction). */
export const BCBS_MODIFIED_IDS: ReadonlySet<string> = new Set(Object.keys(BCBS));

/** Set of Domain-A ids the authoring pass treats as SA seed modifications. */
export const SA_MODIFIED_IDS: ReadonlySet<string> = new Set(Object.keys(SA_MODIFIED));
