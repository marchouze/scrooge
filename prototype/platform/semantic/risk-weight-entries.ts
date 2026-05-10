// platform/semantic/risk-weight-entries.ts
//
// D-REGULATORY-READINESS-W2-SLICE-3 — risk-weight + RWA semantic entries.
//
// Extends the Slice-1 base registry (`entries.ts`) and the Slice-3 (LCR)
// liquidity registry (`liquidity-entries.ts`) with the minimum vocabulary
// the RWA engine + downstream BA 700 (capital-adequacy) generator need to
// compute Pillar-1 risk-weighted assets under the **standardised approach**.
//
// Scope (per W2 pack §3 Slice 3 + dispatch brief):
//
//   RiskWeight                     — base scalar — the regulatory risk-weight
//                                    (0..N, typically 0.0 to 12.5) applied to
//                                    a credit exposure under the standardised
//                                    approach (BCBS *Basel III: Finalising
//                                    post-crisis reforms* / Reg 38).
//   CreditRwa                      — credit risk-weighted assets per exposure
//                                    class. The Pillar-1 credit-risk
//                                    contribution to total RWA.
//   MarketRwa                      — market risk-weighted assets per the
//                                    standardised market-risk framework
//                                    (FRTB-SA at v0; pre-FRTB Basel-2.5
//                                    standardised acceptable for licence-day
//                                    rehearsal per `ORG-PR-33` PA PC 18/2024
//                                    FRTB-CVA implementation roadmap).
//   OperationalRwa                 — operational risk-weighted assets under
//                                    the **revised standardised approach**
//                                    (BCBS *OPE25* — BIC × ILM, where ILM
//                                    is set to 1 for build-phase per
//                                    Reg 38(11) optionality).
//   TotalRwa                       — sum of credit + market + operational +
//                                    CVA RWAs (CVA is its own line; v0
//                                    treats CVA as a placeholder zero pending
//                                    the Slice-4 Reporting BA 600 build).
//
// IRB foundation / IRB advanced approaches are deferred to a later slice
// (the dispatch brief explicitly scopes v1 to standardised). The semantic
// entries name the `rwaApproach` dimension on each entry so a future IRB
// slice can register `CreditRwa@v1.0-irb` without re-keying the v0.1
// standardised entry.
//
// Per Marc's Q1 default (rehearsal-grade with placeholders), each entry
// carries:
//   - one resolved citation chain (Banks Act 94/1990 + Regulations Relating
//     to Banks Reg 38 + BCBS Basel III/IV finalised reforms), and
//   - a `[citation: TBC]` marker pointing at Mira's (Compliance / RegTech
//     engineer) WS-INSTRUMENT-ANALYSES workstream which will resolve precise
//     paragraph indices once the published Reg 38 + Basel III/IV §§ are
//     cross-referenced.
//
// Hoz Bank only — Hoz Securities + Hoz Group are not capital-adequacy
// bound on the same basis (Hoz Securities is securities-firm-scoped under
// FSCA + JSE Member Rules; Hoz Group consolidated reading is
// `ORG-BNK-ICAAP-CONS` consolidated supervision per Banks Act § 60+, which
// the RWA engine handles via the consolidated entity scope on `TotalRwa`).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Camille (Chief Financial Officer, governance — reports to CEO;
//   capital-management owner + RWA-engine accountable)
//   + Atlas (Core banking platform architect — substrate consult on
//   projection contract + as-of replay).

import type { SemanticEntry } from "./types";

const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";
const HOZ_GROUP = "urn:legal-entity:hoz:hoz-group:v1";

const FIRST_AUTHORED = "2026-05-10T00:00:00.000Z";

/**
 * `RiskWeight` — the regulatory risk-weight (dimensionless scalar) applied
 * to a credit exposure under the **standardised approach** for credit risk
 * per Reg 38 + BCBS Basel III/IV finalised reforms.
 *
 * The standardised approach assigns a percentage risk-weight to each
 * exposure based on the counterparty type (sovereign, bank, corporate,
 * retail, residential mortgage, etc.) and external credit rating where
 * applicable. Typical weights:
 *   - Sovereign / SARB exposure (ZAR-denominated, ZAR-funded): 0%
 *   - Highly-rated bank exposure (AAA-AA): 20%
 *   - Investment-grade corporate (BBB+ to BBB-): 100% (50% under finalised
 *     reforms with credit-rating recognition)
 *   - Unrated corporate: 100%
 *   - Residential mortgage (≤ 80% LTV): 35%
 *   - Past-due (≥ 90 days): 150%
 *   - Equity (non-trading-book, non-significant investment): 250%
 *
 * The actual lookup table lives in `prototype/platform/risk/rwa-engine.ts`
 * (`STANDARDISED_RISK_WEIGHTS`) — this semantic entry stores the
 * **definition** of the quantity, not the lookup.
 */
export const riskWeight: SemanticEntry = {
  id: "RiskWeight",
  version: "v0.1",
  description:
    "Regulatory risk-weight (dimensionless scalar in [0, 12.5]) applied to a credit exposure under the standardised approach per Banks Act § 70 + Regulations Relating to Banks Reg 38 + BCBS Basel III/IV finalised reforms. Looked up by (counterpartyType, creditRating, residualMaturity, ltvBucket).",
  units: "scalar",
  dimensions: ["counterparty", "exposureKind", "rwaApproach"],
  projection: "rwa-projection",
  formula:
    "lookup(STANDARDISED_RISK_WEIGHTS, {counterpartyType, creditRating, residualMaturity, ltvBucket})",
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision for the standardised approach.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-01",
      note: "Banks Act + Regulations Relating to Banks Reg 38 — capital-adequacy minima (CET1 / AT1 / T2) sit on top of RWA.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-31",
      note: "SARB PA Guidance Note 3/2023 — Basel III/IV implementation dates (revised SA approach for credit risk: 1 Jan 2024).",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact Reg 38 + BCBS Basel III/IV § references for the standardised-approach risk-weight table; SA-specific overlays where applicable]",
    },
  ],
  signers: ["Bea", "Camille", "Helena"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0.1 standardised approach only. IRB foundation / IRB advanced approaches register as separate `RiskWeight@v1.0-irb-foundation` / `@v1.0-irb-advanced` entries in a later slice. The `rwaApproach` dimension lets a single id carry multiple methodology variants; downstream consumers select by approach.",
};

/**
 * `CreditRwa` — credit risk-weighted assets per exposure class, computed as
 * the sum over exposures of (Exposure × RiskWeight) under the standardised
 * approach. The Pillar-1 credit-risk contribution to total RWA.
 *
 * Per Reg 38 + BCBS Basel III/IV (CRE20 — Standardised approach):
 *   CreditRWA = Σ_exposures (EAD × RW)
 *
 * Where EAD (exposure-at-default) for on-balance-sheet items is the carrying
 * amount; for off-balance-sheet items it's notional × CCF (credit-conversion
 * factor). For derivatives / securities-financing transactions the v0.1
 * scope is the standardised approach for counterparty credit risk
 * (SA-CCR; CRE52) — feeds CreditRwa via the `derivative` and `repo`
 * exposureKinds.
 */
export const creditRwa: SemanticEntry = {
  id: "CreditRwa",
  version: "v0.1",
  description:
    "Credit risk-weighted assets — Σ over exposures of (Exposure-At-Default × RiskWeight) under the standardised approach. Pillar-1 credit-risk contribution to total RWA per Reg 38 + BCBS Basel III/IV CRE20.",
  units: "money-minor",
  dimensions: ["counterparty", "exposureKind", "currency", "rwaApproach"],
  projection: "rwa-projection",
  formula:
    "sum(exposure.eadMinor * lookup(RiskWeight, exposure) for exposure in creditExposures where {entity, asOf <= asOfQuery})",
  regulatoryCells: [
    {
      form: "BA 700",
      line: "Credit risk-weighted exposures — standardised approach (Pillar 1)",
      side: "positive",
      note: "Aggregated to the BA 700 capital-adequacy summary via Reporting Slice 4 generator. BA 400 (credit risk return) decomposes the same total into per-exposure-class sub-lines.",
    },
    {
      form: "BA 400",
      line: "Credit risk — standardised approach total RWA",
      side: "positive",
      note: "Per-exposure-class decomposition via the credit-risk return generator (Slice 4+).",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-01",
      note: "Banks Act + Regulations Relating to Banks Reg 38 — capital-adequacy minima sit on top of RWA.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-31",
      note: "SARB PA G3/2023 — Basel III/IV implementation dates (revised SA approach for credit risk: 1 Jan 2024).",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact Reg 38 + BCBS CRE20 § references for the standardised-approach computation; SA-CCR (CRE52) integration for derivatives + SFTs]",
    },
  ],
  signers: ["Bea", "Camille", "Helena"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["amortised-cost", "fvoci-debt", "fvtpl"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0.1 standardised approach only. IRB methodologies deferred. Build-phase: the bank holds no real customer exposures (Niko's lifecycle paused) so the engine trials against a synthetic exposure fixture; live numbers populate at commencement-of-trading. CVA-add-on is its own semantic entry pending Slice-4 Reporting BA 600 build (v0.1 treats CVA as zero placeholder).",
};

/**
 * `MarketRwa` — market risk-weighted assets per the standardised market-
 * risk framework. Pillar-1 market-risk contribution to total RWA.
 *
 * Per Reg 38 + BCBS Basel III/IV (MAR — Market risk):
 *   MarketRWA = (sensitivity-based capital charge + default-risk charge +
 *                residual-risk add-on) × 12.5
 *
 * Per `ORG-PR-33` PA PC 18/2024 the FRTB framework commences 1 July 2025;
 * pre-FRTB Basel-2.5 standardised is acceptable for licence-day rehearsal.
 * v0.1 implements the simplified standardised approach — sum of (positions
 * by risk type × prescribed risk-weight) × 12.5 to convert capital charge
 * into RWA equivalent. Risk types in scope at v0.1: interest-rate, equity,
 * FX, commodity (commodity is zero pre-FRTB-SA per the bank's product set).
 */
export const marketRwa: SemanticEntry = {
  id: "MarketRwa",
  version: "v0.1",
  description:
    "Market risk-weighted assets per the standardised market-risk framework. Pillar-1 market-risk contribution to total RWA. v0.1: simplified standardised (pre-FRTB-SA) — capital charge × 12.5. FRTB-SA migration sequenced per ORG-PR-33 PA PC 18/2024.",
  units: "money-minor",
  dimensions: ["currency", "rwaApproach"],
  projection: "rwa-projection",
  formula:
    "12.5 * sum(position.notionalMinor * marketRiskWeight(riskType, residualMaturity) for position in tradingBookPositions where {entity, asOf <= asOfQuery})",
  regulatoryCells: [
    {
      form: "BA 700",
      line: "Market risk-weighted exposures — standardised approach (Pillar 1)",
      side: "positive",
      note: "Aggregated to the BA 700 capital-adequacy summary via Reporting Slice 4 generator. BA 350 decomposes the same total into per-risk-type sub-lines.",
    },
    {
      form: "BA 350",
      line: "Market risk — standardised approach total RWA",
      side: "positive",
      note: "Per-risk-type decomposition via the market-risk return generator (Reporting Slice 5 — BA 350).",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-33",
      note: "SARB PA Prudential Communication 18/2024 — FRTB + revised CVA implementation roadmap (1 July 2025 commencement).",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-01",
      note: "Banks Act + Reg 38 — capital-adequacy minima.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — precise BCBS MAR § references for FRTB-SA sensitivity-based + default-risk charges; pre-FRTB Basel-2.5 standardised § references for the build-phase rehearsal]",
    },
  ],
  signers: ["Helena", "Bea", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0.1 simplified pre-FRTB standardised. FRTB-SA full sensitivity-based methodology lands in a later slice once the trading-book substrate (markets-substrate M-phase) reaches sufficient maturity. Build-phase: the bank holds no real trading positions yet; synthetic fixture only.",
};

/**
 * `OperationalRwa` — operational risk-weighted assets under the **revised
 * standardised approach** (BCBS OPE25 — *Standardised approach for
 * operational risk*).
 *
 * Per BCBS OPE25 + Reg 38(11):
 *   OperationalRWA = 12.5 × ORC
 *   ORC (operational-risk capital) = BIC × ILM
 *   BIC (business-indicator component) = piecewise function of BI
 *   BI (business indicator) = ILDC + SC + FC
 *     ILDC = interest, leases, dividend component
 *     SC   = services component
 *     FC   = financial component
 *   ILM (internal loss multiplier) — 1 for build-phase per Reg 38(11)
 *     optionality (no operational-loss history yet); converges to actual
 *     ILM once the bank has 5+ years of operational-loss event data.
 *
 * BIC piecewise (BCBS OPE25):
 *   BI ≤ €1bn:        BIC = 0.12 × BI
 *   €1bn < BI ≤ €30bn: BIC = €120m + 0.15 × (BI − €1bn)
 *   BI > €30bn:        BIC = €4.47bn + 0.18 × (BI − €30bn)
 *
 * The bank's BI at build-phase is essentially zero (no revenue yet); this
 * entry's value is symbolic but the formula is exercised against synthetic
 * BI inputs in the test fixture.
 */
export const operationalRwa: SemanticEntry = {
  id: "OperationalRwa",
  version: "v0.1",
  description:
    "Operational risk-weighted assets under the revised standardised approach (BCBS OPE25). 12.5 × Business Indicator Component × Internal Loss Multiplier. ILM = 1 build-phase per Reg 38(11) optionality.",
  units: "money-minor",
  dimensions: ["currency", "rwaApproach"],
  projection: "rwa-projection",
  formula: "12.5 * businessIndicatorComponent(BI) * internalLossMultiplier(ILM = 1 build-phase)",
  regulatoryCells: [
    {
      form: "BA 700",
      line: "Operational risk-weighted exposures — standardised approach (Pillar 1)",
      side: "positive",
      note: "Aggregated to the BA 700 capital-adequacy summary via Reporting Slice 4 generator. BA 340 carries the per-business-line decomposition.",
    },
    {
      form: "BA 340",
      line: "Operational risk — standardised approach total RWA",
      side: "positive",
      note: "Business-Indicator-Component decomposition via the operational-risk return generator (later Reporting slice).",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-01",
      note: "Banks Act + Reg 38 (specifically Reg 38(11) operational-risk capital) — standardised approach.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-17",
      note: "BCBS Operational Risk (rev. 2021) — operational-risk identification + control framework underpinning ILM = 1 build-phase claim.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — precise BCBS OPE25 § references for BIC piecewise + ILM optionality + SARB transitional posture for new banks]",
    },
  ],
  signers: ["Helena", "Camille", "Bea"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Revised standardised approach (post-2017 Basel III/IV finalised reforms). Old AMA (Advanced Measurement Approach) is no longer permitted under Basel III/IV. BIC threshold values are denominated in EUR per BCBS OPE25; the engine converts to ZAR at the as-of-date FX rate (build-phase: stub rate, sourced from rate master at production).",
};

/**
 * `TotalRwa` — sum of credit + market + operational + CVA RWAs. The
 * denominator of every Pillar-1 capital ratio (CET1, AT1, T2). Reported
 * on BA 700 capital-adequacy summary.
 *
 * v0.1 sums credit + market + operational; CVA is treated as zero
 * placeholder pending Reporting Slice-4 BA 600 build (CVA exists as its
 * own semantic entry in a later slice). The capital-floor under Basel
 * III/IV finalised reforms (output floor — RWAs cannot fall below 72.5%
 * of standardised-approach RWAs) is a no-op at v0.1 because the engine
 * IS the standardised approach; the floor binds when IRB lands.
 *
 * Per Reg 38 + BCBS Basel III/IV:
 *   TotalRWA = max(CreditRWA + MarketRWA + OpRWA + CvaRWA,
 *                  0.725 × StandardisedRWA)
 */
export const totalRwa: SemanticEntry = {
  id: "TotalRwa",
  version: "v0.1",
  description:
    "Total Pillar-1 risk-weighted assets — sum of credit + market + operational + CVA RWAs. Denominator of every Pillar-1 capital ratio. Reported on BA 700.",
  units: "money-minor",
  dimensions: ["currency", "rwaApproach"],
  projection: "rwa-projection",
  formula:
    "max(CreditRwa + MarketRwa + OperationalRwa + CvaRwa, 0.725 * standardisedRwa) — output floor (no-op at v0.1 since engine IS standardised)",
  regulatoryCells: [
    {
      form: "BA 700",
      line: "Total risk-weighted exposures (Pillar-1 denominator)",
      side: "positive",
      note: "Total RWA — denominator of the BA 700 capital ratios. Reporting Slice 4 BA 700 generator consumes this.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-01",
      note: "Banks Act + Reg 38 — capital-adequacy minima sit on top of TotalRwa.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-31",
      note: "SARB PA G3/2023 — Basel III/IV implementation dates including the output-floor progressive implementation 2024–2028.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — precise Reg 38 § for the output floor + SARB-specific transitional arrangements]",
    },
  ],
  signers: ["Camille", "Helena", "Bea"],
  entityScope: [HOZ_BANK, HOZ_GROUP],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Bank-licence-bound (`Hoz Bank Limited`) on solo basis; consolidated reading via `Hoz Group Limited` per `ORG-BNK-ICAAP-CONS` consolidated supervision. Reporting Slice 4 (BA 700) is the primary downstream consumer — defines the API contract via `RwaEngineOutput` shape from `prototype/platform/risk/rwa-engine.ts`.",
};

/**
 * Slice-3 risk-weight + RWA semantic entries, exported as a single array
 * for ease of registry construction in tests + downstream consumers
 * (Reporting Slice-4 BA 700 generator, future BA 350 + BA 340 + BA 400
 * generators).
 */
export const SLICE_3_RWA_ENTRIES: readonly SemanticEntry[] = [
  riskWeight,
  creditRwa,
  marketRwa,
  operationalRwa,
  totalRwa,
] as const;
