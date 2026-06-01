// platform/risk/taxonomy.ts
//
// Canonical Risk Taxonomy v1 — typed mirror of the register at
// `Regulations/_risk-taxonomy.md`. That register is the canonical
// authoring location (per `feedback_canonical_source_registry.md`);
// this enum is its derived form.
//
// Eleven level-1 risk types + level-2 expansion (56 nodes) + selected
// level-3 nodes (27) where regulatory granularity demands. Every
// policy, obligation, RAS line, control, incident, and finding maps
// to exactly one terminal node in this taxonomy (Principle 2 —
// single-graph discipline).
//
// Stable-code format: `RT-<L1>.<L2>.<L3>`. Codes are never renumbered;
// retired nodes carry `@deprecated` JSDoc. Adding / retiring a node
// is a Board-approved CeoDecision — see register §9 amendment process.
//
// Mapping rules — see register §6:
//   1. Start at level 1; narrow to deepest stable node.
//   2. One risk = one terminal node. If a risk spans two, decompose.
//   3. No fit → propose taxonomy amendment (Board-gated). Interim:
//      tag at nearest level-1 + `pendingTaxonomyAmendment` attribute.
//   4. RT-RP (reputational) + RT-CL (climate) attach as *secondary*
//      axes on the primary risk record where applicable.
//
// Author: Helena (Chief Risk Officer, governance — reports to CEO) +
//         Rohan (Risk engineer, engineering — reports to Helena).
//
// Substrate gap (v1): Vera (Internal-audit engineer, engineering —
// functionally to Thandiwe CAE; administratively to CEO) Wave-5 will
// ship a `taxonomy-coverage` recon pipeline asserting (a) typed enum
// derives byte-for-byte from the register, (b) every obligation, RAS
// line, policy frontmatter, and emitted incident/breach event carries
// a valid `riskTaxonomy` code, (c) no orphan codes in the enum.

// ---------------------------------------------------------------------------
// Code union — every level-1 + level-2 + level-3 code in the register.
// ---------------------------------------------------------------------------

export type RiskTaxonomyCode =
  // Level-1 — eleven top-level risk types.
  | "RT-CR"
  | "RT-MK"
  | "RT-LQ"
  | "RT-IRRBB"
  | "RT-OP"
  | "RT-CD"
  | "RT-FC"
  | "RT-LR"
  | "RT-ST"
  | "RT-RP"
  | "RT-CL"
  // Level-2 — RT-CR (credit).
  | "RT-CR.OB"
  | "RT-CR.CP"
  | "RT-CR.SL"
  | "RT-CR.CC"
  | "RT-CR.CV"
  | "RT-CR.WW"
  // Level-2 — RT-MK (market).
  | "RT-MK.IR"
  | "RT-MK.EQ"
  | "RT-MK.FX"
  | "RT-MK.CO"
  | "RT-MK.CS"
  | "RT-MK.OP"
  | "RT-MK.BR"
  // Level-2 — RT-LQ (liquidity & funding).
  | "RT-LQ.FN"
  | "RT-LQ.MK"
  | "RT-LQ.IN"
  | "RT-LQ.CN"
  | "RT-LQ.CR"
  // Level-2 — RT-IRRBB.
  | "RT-IRRBB.EVE"
  | "RT-IRRBB.NII"
  | "RT-IRRBB.BH"
  | "RT-IRRBB.CSRBB"
  // Level-2 — RT-OP (operational).
  | "RT-OP.PR"
  | "RT-OP.PE"
  | "RT-OP.TE"
  | "RT-OP.CY"
  | "RT-OP.TP"
  | "RT-OP.MD"
  | "RT-OP.LE"
  | "RT-OP.EX"
  | "RT-OP.RE"
  | "RT-OP.PA"
  // Level-2 — RT-CD (conduct).
  | "RT-CD.CC"
  | "RT-CD.MA"
  | "RT-CD.TC"
  | "RT-CD.CI"
  // Level-2 — RT-FC (financial crime).
  | "RT-FC.ML"
  | "RT-FC.TF"
  | "RT-FC.PF"
  | "RT-FC.SA"
  | "RT-FC.FR"
  | "RT-FC.BC"
  | "RT-FC.TE"
  // Level-2 — RT-LR (legal & regulatory).
  | "RT-LR.RC"
  | "RT-LR.LI"
  | "RT-LR.CT"
  | "RT-LR.IP"
  | "RT-LR.DP"
  // Level-2 — RT-ST (strategic).
  | "RT-ST.BM"
  | "RT-ST.EV"
  | "RT-ST.MD"
  | "RT-ST.EX"
  | "RT-ST.GV"
  // Level-2 — RT-RP (reputational).
  | "RT-RP.CL"
  | "RT-RP.RG"
  | "RT-RP.MK"
  // Level-2 — RT-CL (climate & ESG).
  | "RT-CL.PH"
  | "RT-CL.TR"
  | "RT-CL.LI"
  | "RT-CL.NA"
  | "RT-CL.SO"
  // Level-3 — RT-OP.CY (cyber).
  | "RT-OP.CY.CF"
  | "RT-OP.CY.IN"
  | "RT-OP.CY.AV"
  | "RT-OP.CY.RS"
  // Level-3 — RT-OP.TP (third-party).
  | "RT-OP.TP.CL"
  | "RT-OP.TP.MS"
  | "RT-OP.TP.IT"
  | "RT-OP.TP.PR"
  // Level-3 — RT-OP.MD (model).
  | "RT-OP.MD.T1"
  | "RT-OP.MD.T2"
  | "RT-OP.MD.T3"
  // Level-3 — RT-FC.ML (money-laundering vectors).
  | "RT-FC.ML.CU"
  | "RT-FC.ML.PR"
  | "RT-FC.ML.GE"
  | "RT-FC.ML.CH"
  // Level-3 — RT-FC.SA (sanctions regimes).
  | "RT-FC.SA.UN"
  | "RT-FC.SA.US"
  | "RT-FC.SA.EU"
  | "RT-FC.SA.UK"
  | "RT-FC.SA.ZA"
  // Level-3 — RT-CR.SL (settlement).
  | "RT-CR.SL.FX"
  | "RT-CR.SL.SC";

// ---------------------------------------------------------------------------
// Node shape + flat registry.
// ---------------------------------------------------------------------------

export interface RiskTaxonomyNode {
  readonly code: RiskTaxonomyCode;
  readonly level: 1 | 2 | 3;
  readonly parent: RiskTaxonomyCode | null;
  readonly name: string;
  /** Governance seat (or seat-pair) that holds policy authority. Level-1 only. */
  readonly owner: string;
  readonly definition: string;
}

/**
 * Level-1 owner constants. Re-exported for downstream typed reference.
 * Pairs name + position on first mention (per CLAUDE.md identity discipline).
 */
const OWNER_HELENA = "Helena (Chief Risk Officer, governance)";
const OWNER_HELENA_EITAN =
  "Helena (Chief Risk Officer, governance) + Eitan (Treasurer, engineering — reports to Camille CFO)";
const OWNER_HELENA_DEVON =
  "Helena (Chief Risk Officer, governance) co-owner with Devon (Chief Operating Officer, governance)";
const OWNER_ZARA = "Zara (Chief Compliance Officer, governance)";
const OWNER_ZARA_MLRO =
  "Zara (Chief Compliance Officer, governance) + future Money Laundering Reporting Officer";
const OWNER_LEGAL =
  "Owen (Company Secretary, governance) + Imani (Legal-as-code engineer, engineering — reports to Devon COO interim); future General Counsel at hire";
const OWNER_CEO_CFO =
  "Marc (Chief Executive Officer) for strategy; Camille (Chief Financial Officer, governance) for earnings dimension";
const OWNER_REPUTATION = "Marc (Chief Executive Officer); CRO + CCO + Company Secretary co-monitor";
const OWNER_CLIMATE = "Helena (Chief Risk Officer, governance) with Marc (Chief Executive Officer)";
/** Non-level-1 nodes inherit owner from their level-1 parent — sentinel empty string. */
const OWNER_INHERIT = "";

export const RISK_TAXONOMY: ReadonlyArray<RiskTaxonomyNode> = [
  // -----------------------------------------------------------------------
  // Level 1.
  // -----------------------------------------------------------------------
  {
    code: "RT-CR",
    level: 1,
    parent: null,
    name: "Credit risk",
    owner: OWNER_HELENA,
    definition:
      "Risk that an obligor fails to meet contractual obligations as they fall due, producing a financial loss for the bank.",
  },
  {
    code: "RT-MK",
    level: 1,
    parent: null,
    name: "Market risk",
    owner: OWNER_HELENA,
    definition:
      "Risk of loss in on- and off-balance-sheet positions arising from movements in market prices (interest rate in trading book, equity, FX, commodity, credit-spread).",
  },
  {
    code: "RT-LQ",
    level: 1,
    parent: null,
    name: "Liquidity & funding risk",
    owner: OWNER_HELENA_EITAN,
    definition:
      "Risk that the bank cannot meet obligations as they fall due (funding-liquidity) or cannot liquidate positions without unacceptable loss (market-liquidity).",
  },
  {
    code: "RT-IRRBB",
    level: 1,
    parent: null,
    name: "Interest-rate risk in the banking book",
    owner: OWNER_HELENA,
    definition:
      "Risk to earnings (NII) and economic value (EVE) from interest-rate movements affecting banking-book positions.",
  },
  {
    code: "RT-OP",
    level: 1,
    parent: null,
    name: "Operational risk",
    owner: OWNER_HELENA_DEVON,
    definition:
      "Risk of loss from inadequate or failed internal processes, people, systems, or external events. Includes cyber, third-party, model, conduct-execution; excludes strategic and reputational.",
  },
  {
    code: "RT-CD",
    level: 1,
    parent: null,
    name: "Conduct risk",
    owner: OWNER_ZARA,
    definition:
      "Risk that the bank's behaviour in markets or with clients produces unfair outcomes, market abuse, or breaches of conduct duties.",
  },
  {
    code: "RT-FC",
    level: 1,
    parent: null,
    name: "Financial-crime risk",
    owner: OWNER_ZARA_MLRO,
    definition:
      "Risk that the bank is used to launder funds, finance terrorism, evade sanctions, facilitate tax evasion, or transact bribery and corruption.",
  },
  {
    code: "RT-LR",
    level: 1,
    parent: null,
    name: "Legal & regulatory risk",
    owner: OWNER_LEGAL,
    definition:
      "Risk of loss from unenforceable contracts, litigation, regulatory enforcement, or non-compliance with binding obligations. Excludes financial-crime obligations (under RT-FC).",
  },
  {
    code: "RT-ST",
    level: 1,
    parent: null,
    name: "Strategic & business risk",
    owner: OWNER_CEO_CFO,
    definition:
      "Risk to the bank's earnings or franchise from adverse business decisions, poor execution, or failure to respond to industry change.",
    // No FIBO IRI or L2 standard — internal strategic classification
  },
  {
    code: "RT-RP",
    level: 1,
    parent: null,
    name: "Reputational risk",
    owner: OWNER_REPUTATION,
    definition:
      "Risk that negative perception by clients, counterparties, regulators, or the public produces value erosion, funding loss, or licence threat. Treated as a second-order risk that shadows first-order categories at Critical severity.",
    // No FIBO IRI or L2 standard — internal reputational classification
  },
  {
    code: "RT-CL",
    level: 1,
    parent: null,
    name: "Climate & ESG risk",
    owner: OWNER_CLIMATE,
    definition:
      "Risk to financial position or franchise from physical and transition climate impacts, biodiversity loss, and broader ESG dimensions. Treated as a transverse risk that manifests through credit, market, operational, liquidity, strategic, and reputational nodes.",
    // No FIBO IRI or L2 standard — emerging taxonomy; TCFD/TNFD alignment planned
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-CR.
  // -----------------------------------------------------------------------
  {
    code: "RT-CR.OB",
    level: 2,
    parent: "RT-CR",
    name: "Obligor credit risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from a specific obligor defaulting on a credit exposure (loan, bond, derivative receivable, settlement claim).",
  },
  {
    code: "RT-CR.CP",
    level: 2,
    parent: "RT-CR",
    name: "Counterparty credit risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from a counterparty defaulting before final settlement of a transaction whose value is positive to the bank (OTC derivatives, repos, securities financing).",
  },
  {
    code: "RT-CR.SL",
    level: 2,
    parent: "RT-CR",
    name: "Settlement risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss when the bank delivers value but does not receive the offsetting leg (Herstatt-style FX settlement, securities-vs-cash settlement).",
  },
  {
    code: "RT-CR.CC",
    level: 2,
    parent: "RT-CR",
    name: "Credit-concentration risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk from disproportionate exposure to a single name, group of connected counterparties, sector, geography, or product.",
  },
  {
    code: "RT-CR.CV",
    level: 2,
    parent: "RT-CR",
    name: "CVA / valuation-adjustment risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from changes in credit-valuation adjustments and related XVAs on derivative portfolios.",
  },
  {
    code: "RT-CR.WW",
    level: 2,
    parent: "RT-CR",
    name: "Wrong-way risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that exposure to a counterparty is adversely correlated with the counterparty's credit quality.",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-MK.
  // -----------------------------------------------------------------------
  {
    code: "RT-MK.IR",
    level: 2,
    parent: "RT-MK",
    name: "Interest-rate risk (trading book)",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss in trading-book positions from interest-rate movements. IRRBB in the banking book is RT-IRRBB.",
  },
  {
    code: "RT-MK.EQ",
    level: 2,
    parent: "RT-MK",
    name: "Equity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from movements in equity prices in the trading book (cash + derivative).",
  },
  {
    code: "RT-MK.FX",
    level: 2,
    parent: "RT-MK",
    name: "Foreign-exchange risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from movements in foreign-exchange rates affecting bank positions and earnings.",
  },
  {
    code: "RT-MK.CO",
    level: 2,
    parent: "RT-MK",
    name: "Commodity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from movements in commodity prices in held positions. Out-of-scope for Hoz day-one strategic foundation; node reserved.",
  },
  {
    code: "RT-MK.CS",
    level: 2,
    parent: "RT-MK",
    name: "Credit-spread risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from movements in credit spreads (issuer or index) in the trading book.",
  },
  {
    code: "RT-MK.OP",
    level: 2,
    parent: "RT-MK",
    name: "Options / convexity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from changes in option volatility, second-order Greeks, and convexity in non-linear positions.",
  },
  {
    code: "RT-MK.BR",
    level: 2,
    parent: "RT-MK",
    name: "Basis risk",
    owner: OWNER_INHERIT,
    definition: "Risk of loss from imperfect correlation between hedging and hedged instruments.",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-LQ.
  // -----------------------------------------------------------------------
  {
    code: "RT-LQ.FN",
    level: 2,
    parent: "RT-LQ",
    name: "Funding-liquidity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that the bank cannot meet cash obligations as they fall due without producing material losses. Captured in LCR + NSFR + idiosyncratic stress.",
  },
  {
    code: "RT-LQ.MK",
    level: 2,
    parent: "RT-LQ",
    name: "Market-liquidity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that the bank cannot liquidate positions at or near the prevailing market price (HQLA composition; trading-book exit costs).",
  },
  {
    code: "RT-LQ.IN",
    level: 2,
    parent: "RT-LQ",
    name: "Intraday-liquidity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that the bank cannot meet payment and settlement obligations at the moment they fall due during the operating day (correspondent RTGS-funding scale).",
  },
  {
    code: "RT-LQ.CN",
    level: 2,
    parent: "RT-LQ",
    name: "Funding-concentration risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk from disproportionate reliance on a single funding counterparty, tenor, currency, or product.",
  },
  {
    code: "RT-LQ.CR",
    level: 2,
    parent: "RT-LQ",
    name: "Cross-currency funding risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from FX-swap-implied funding mismatches across significant currencies.",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-IRRBB.
  // -----------------------------------------------------------------------
  {
    code: "RT-IRRBB.EVE",
    level: 2,
    parent: "RT-IRRBB",
    name: "Economic-value-of-equity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk to the present value of banking-book assets minus liabilities from interest-rate shocks.",
  },
  {
    code: "RT-IRRBB.NII",
    level: 2,
    parent: "RT-IRRBB",
    name: "Net-interest-income risk",
    owner: OWNER_INHERIT,
    definition: "Risk to forward-period net interest income from interest-rate shocks.",
  },
  {
    code: "RT-IRRBB.BH",
    level: 2,
    parent: "RT-IRRBB",
    name: "Behavioural-assumption risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk from non-maturity-deposit, prepayment, and pipeline assumptions used in IRRBB measurement.",
  },
  {
    code: "RT-IRRBB.CSRBB",
    level: 2,
    parent: "RT-IRRBB",
    name: "Credit-spread risk in the banking book",
    owner: OWNER_INHERIT,
    definition:
      "Risk to banking-book economic value from changes in credit spreads on banking-book positions (per PA Prudential Communication 15/2024 field testing).",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-OP.
  // -----------------------------------------------------------------------
  {
    code: "RT-OP.PR",
    level: 2,
    parent: "RT-OP",
    name: "Process risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from inadequate or failed processes (execution, recording, settlement-processing, reporting failures).",
  },
  {
    code: "RT-OP.PE",
    level: 2,
    parent: "RT-OP",
    name: "People risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from human error, unauthorised activity, key-person dependency, skills gap, or insider misconduct.",
  },
  {
    code: "RT-OP.TE",
    level: 2,
    parent: "RT-OP",
    name: "Technology resilience risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from technology failure, system unavailability, capacity, performance degradation, or data integrity failure outside cyber-attack scope.",
  },
  {
    code: "RT-OP.CY",
    level: 2,
    parent: "RT-OP",
    name: "Cyber risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from cyber-attack — confidentiality, integrity, availability, or cyber-resilience failure.",
  },
  {
    code: "RT-OP.TP",
    level: 2,
    parent: "RT-OP",
    name: "Third-party risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from material outsourcing or service-provider failure, including critical cloud, market-data, and clearing dependencies.",
  },
  {
    code: "RT-OP.MD",
    level: 2,
    parent: "RT-OP",
    name: "Model risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from incorrect model outputs used in decisioning, valuation, capital, or reporting.",
  },
  {
    code: "RT-OP.LE",
    level: 2,
    parent: "RT-OP",
    name: "Legal-execution risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from defective contracting, unenforceable clauses, or improperly executed legal acts in the course of business operations. Distinct from strategic legal-regulatory exposure under RT-LR.",
  },
  {
    code: "RT-OP.EX",
    level: 2,
    parent: "RT-OP",
    name: "External-events risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from natural disasters, civil disturbance, infrastructure failure outside the bank's control.",
  },
  {
    code: "RT-OP.RE",
    level: 2,
    parent: "RT-OP",
    name: "Operational-resilience risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that an important business service is disrupted beyond its impact tolerance through any cause (cyber, third-party, infrastructure, key-person).",
  },
  {
    code: "RT-OP.PA",
    level: 2,
    parent: "RT-OP",
    name: "Payments & settlement processing risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from failed or mis-routed payments and settlements in the operational pipeline (distinct from RT-CR.SL Herstatt settlement-credit risk).",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-CD.
  // -----------------------------------------------------------------------
  {
    code: "RT-CD.CC",
    level: 2,
    parent: "RT-CD",
    name: "Client-conduct risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of unfair client outcomes (mis-selling, mis-pricing, suitability failure, conflict-of-interest mis-management).",
  },
  {
    code: "RT-CD.MA",
    level: 2,
    parent: "RT-CD",
    name: "Market-abuse risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of insider dealing, market manipulation, false-or-misleading disclosure, or other prohibited market conduct by the bank, its agents, or employees.",
  },
  {
    code: "RT-CD.TC",
    level: 2,
    parent: "RT-CD",
    name: "Treating-customers-fairly risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of breach of FSCA TCF Conduct Standards across the six TCF outcomes (institutional client overlay applies under wholesale licence).",
  },
  {
    code: "RT-CD.CI",
    level: 2,
    parent: "RT-CD",
    name: "Conflict-of-interest risk",
    owner: OWNER_INHERIT,
    definition: "Risk of unmanaged conflicts between bank, employee, agent, and client interests.",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-FC.
  // -----------------------------------------------------------------------
  {
    code: "RT-FC.ML",
    level: 2,
    parent: "RT-FC",
    name: "Money-laundering risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that the bank's products, customers, or channels are used to launder proceeds of crime.",
  },
  {
    code: "RT-FC.TF",
    level: 2,
    parent: "RT-FC",
    name: "Terrorism-financing risk",
    owner: OWNER_INHERIT,
    definition: "Risk that the bank's products or channels are used to finance terrorism.",
  },
  {
    code: "RT-FC.PF",
    level: 2,
    parent: "RT-FC",
    name: "Proliferation-financing risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that the bank's products or channels are used to finance proliferation of weapons of mass destruction (per FATF Recommendation 7 + FIC Act post-Greylisting).",
  },
  {
    code: "RT-FC.SA",
    level: 2,
    parent: "RT-FC",
    name: "Sanctions risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of breach of UNSC, OFAC, EU, UK, or domestic sanctions through transactions, customers, or counterparties.",
  },
  {
    code: "RT-FC.FR",
    level: 2,
    parent: "RT-FC",
    name: "Fraud risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from internal or external fraud (excluding cyber-enabled fraud which is RT-OP.CY if the primary vector is cyber).",
  },
  {
    code: "RT-FC.BC",
    level: 2,
    parent: "RT-FC",
    name: "Bribery & corruption risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of bank, employee, or agent giving or receiving improper inducement; failure-to-prevent-bribery exposure.",
  },
  {
    code: "RT-FC.TE",
    level: 2,
    parent: "RT-FC",
    name: "Tax-evasion-facilitation risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that the bank facilitates tax evasion by customers (Tax Administration Act §234 facilitation; FATCA / CRS reporting failures with crime-facilitation overlay).",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-LR.
  // -----------------------------------------------------------------------
  {
    code: "RT-LR.RC",
    level: 2,
    parent: "RT-LR",
    name: "Regulatory-compliance risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of breach of binding obligations in the obligations register (excluding financial-crime obligations under RT-FC and conduct obligations under RT-CD).",
  },
  {
    code: "RT-LR.LI",
    level: 2,
    parent: "RT-LR",
    name: "Litigation risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from civil, commercial, or regulatory-enforcement litigation against the bank.",
  },
  {
    code: "RT-LR.CT",
    level: 2,
    parent: "RT-LR",
    name: "Contract-enforceability risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that contracts the bank relies on are unenforceable, frustrated, or void (netting opinions, ISDA / GMRA close-out, jurisdiction).",
  },
  {
    code: "RT-LR.IP",
    level: 2,
    parent: "RT-LR",
    name: "Intellectual-property risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from third-party IP infringement claims or failure to protect bank-owned IP.",
  },
  {
    code: "RT-LR.DP",
    level: 2,
    parent: "RT-LR",
    name: "Data-protection risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of breach of POPIA, GDPR (where applicable to cross-border data), or sectoral data obligations.",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-ST.
  // -----------------------------------------------------------------------
  {
    code: "RT-ST.BM",
    level: 2,
    parent: "RT-ST",
    name: "Business-model risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that the chosen business model fails to produce sustainable earnings (wholesale institutional global-markets trading bank model).",
  },
  {
    code: "RT-ST.EV",
    level: 2,
    parent: "RT-ST",
    name: "Earnings-volatility risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that earnings are materially volatile from period to period, eroding capital or franchise.",
  },
  {
    code: "RT-ST.MD",
    level: 2,
    parent: "RT-ST",
    name: "Market-disruption risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk from technology, competitor, or industry-structure change disrupting the bank's franchise.",
  },
  {
    code: "RT-ST.EX",
    level: 2,
    parent: "RT-ST",
    name: "Execution risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of failure to execute a defined strategic initiative (build-phase to licence-day gate; capital raise; product launch).",
  },
  {
    code: "RT-ST.GV",
    level: 2,
    parent: "RT-ST",
    name: "Governance-effectiveness risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk that Board or management structures fail to produce sound decisions, oversight, or culture.",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-RP.
  // -----------------------------------------------------------------------
  {
    code: "RT-RP.CL",
    level: 2,
    parent: "RT-RP",
    name: "Client-perception risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of damage to the bank's franchise from adverse client or counterparty perception.",
  },
  {
    code: "RT-RP.RG",
    level: 2,
    parent: "RT-RP",
    name: "Regulator-perception risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of damage to the bank's regulatory standing or licence position from adverse regulator perception.",
  },
  {
    code: "RT-RP.MK",
    level: 2,
    parent: "RT-RP",
    name: "Market / media-perception risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of damage from adverse media coverage, social-media events, or analyst commentary.",
  },

  // -----------------------------------------------------------------------
  // Level 2 — RT-CL.
  // -----------------------------------------------------------------------
  {
    code: "RT-CL.PH",
    level: 2,
    parent: "RT-CL",
    name: "Physical climate risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from acute (storm, flood, wildfire) or chronic (sea-level, temperature, water-stress) physical climate impacts affecting counterparties, collateral, or operations.",
  },
  {
    code: "RT-CL.TR",
    level: 2,
    parent: "RT-CL",
    name: "Transition climate risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from policy, technology, market, or reputational shifts in the transition to a lower-carbon economy.",
  },
  {
    code: "RT-CL.LI",
    level: 2,
    parent: "RT-CL",
    name: "Climate-litigation risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from climate-related litigation against the bank or its counterparties.",
  },
  {
    code: "RT-CL.NA",
    level: 2,
    parent: "RT-CL",
    name: "Nature & biodiversity risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from biodiversity loss, ecosystem degradation, or land-use change affecting counterparties or collateral.",
  },
  {
    code: "RT-CL.SO",
    level: 2,
    parent: "RT-CL",
    name: "Social & governance (broader ESG) risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk of loss from social-licence or broader-ESG failures (human rights, labour standards, supply chain).",
  },

  // -----------------------------------------------------------------------
  // Level 3 — RT-OP.CY (cyber).
  // -----------------------------------------------------------------------
  {
    code: "RT-OP.CY.CF",
    level: 3,
    parent: "RT-OP.CY",
    name: "Confidentiality",
    owner: OWNER_INHERIT,
    definition: "Risk of unauthorised disclosure of bank, client, or counterparty data.",
  },
  {
    code: "RT-OP.CY.IN",
    level: 3,
    parent: "RT-OP.CY",
    name: "Integrity",
    owner: OWNER_INHERIT,
    definition: "Risk of unauthorised modification of data, transactions, or systems.",
  },
  {
    code: "RT-OP.CY.AV",
    level: 3,
    parent: "RT-OP.CY",
    name: "Availability",
    owner: OWNER_INHERIT,
    definition:
      "Risk of system unavailability from cyber-attack (DoS, ransomware operational disruption).",
  },
  {
    code: "RT-OP.CY.RS",
    level: 3,
    parent: "RT-OP.CY",
    name: "Cyber-resilience",
    owner: OWNER_INHERIT,
    definition:
      "Risk of failure to recover from a cyber incident within stated impact tolerances (per Joint Standard 2/2024).",
  },

  // -----------------------------------------------------------------------
  // Level 3 — RT-OP.TP (third-party).
  // -----------------------------------------------------------------------
  {
    code: "RT-OP.TP.CL",
    level: 3,
    parent: "RT-OP.TP",
    name: "Critical cloud-provider",
    owner: OWNER_INHERIT,
    definition:
      "Risk from material outage, security failure, or service degradation at the bank's critical cloud provider (Azure).",
  },
  {
    code: "RT-OP.TP.MS",
    level: 3,
    parent: "RT-OP.TP",
    name: "Market-services provider",
    owner: OWNER_INHERIT,
    definition:
      "Risk from market-data, index-provider, clearing-broker, or correspondent-bank failure.",
  },
  {
    code: "RT-OP.TP.IT",
    level: 3,
    parent: "RT-OP.TP",
    name: "IT-service provider",
    owner: OWNER_INHERIT,
    definition: "Risk from non-cloud IT outsourcers (managed services, software vendors).",
  },
  {
    code: "RT-OP.TP.PR",
    level: 3,
    parent: "RT-OP.TP",
    name: "Professional-services provider",
    owner: OWNER_INHERIT,
    definition: "Risk from external counsel, audit firm, consultancy dependencies.",
  },

  // -----------------------------------------------------------------------
  // Level 3 — RT-OP.MD (model).
  // -----------------------------------------------------------------------
  {
    code: "RT-OP.MD.T1",
    level: 3,
    parent: "RT-OP.MD",
    name: "Tier-1 model (regulatory)",
    owner: OWNER_INHERIT,
    definition:
      "Risk in models classified Tier-1 per D-MODEL-TIERING — regulatory capital RWA, IFRS 9 ECL, AML monitoring core.",
  },
  {
    code: "RT-OP.MD.T2",
    level: 3,
    parent: "RT-OP.MD",
    name: "Tier-2 model (decisioning)",
    owner: OWNER_INHERIT,
    definition:
      "Risk in Tier-2 models — pricing engines, risk sensitivities, behavioural-deposit models.",
  },
  {
    code: "RT-OP.MD.T3",
    level: 3,
    parent: "RT-OP.MD",
    name: "Tier-3 model (analytics)",
    owner: OWNER_INHERIT,
    definition:
      "Risk in Tier-3 models — operational analytics, customer segmentation, non-decisioning.",
  },

  // -----------------------------------------------------------------------
  // Level 3 — RT-FC.ML (money-laundering vectors).
  // -----------------------------------------------------------------------
  {
    code: "RT-FC.ML.CU",
    level: 3,
    parent: "RT-FC.ML",
    name: "Customer-ML risk",
    owner: OWNER_INHERIT,
    definition:
      "ML risk arising from customer profile (PEPs, complex ownership, high-risk jurisdictions).",
  },
  {
    code: "RT-FC.ML.PR",
    level: 3,
    parent: "RT-FC.ML",
    name: "Product-ML risk",
    owner: OWNER_INHERIT,
    definition:
      "ML risk arising from product features (cross-border payments, anonymous instruments). Note: Hoz is institutional-only — wholesale-product risk profile.",
  },
  {
    code: "RT-FC.ML.GE",
    level: 3,
    parent: "RT-FC.ML",
    name: "Geography-ML risk",
    owner: OWNER_INHERIT,
    definition:
      "ML risk from counterparty-geography exposure (FATF grey/black-list, sanctioned jurisdictions).",
  },
  {
    code: "RT-FC.ML.CH",
    level: 3,
    parent: "RT-FC.ML",
    name: "Channel-ML risk",
    owner: OWNER_INHERIT,
    definition:
      "ML risk from channel characteristics (non-face-to-face onboarding, agent intermediation).",
  },

  // -----------------------------------------------------------------------
  // Level 3 — RT-FC.SA (sanctions regimes).
  // -----------------------------------------------------------------------
  {
    code: "RT-FC.SA.UN",
    level: 3,
    parent: "RT-FC.SA",
    name: "UN Security Council sanctions",
    owner: OWNER_INHERIT,
    definition: "Risk of breach of UNSC sanctions regimes.",
  },
  {
    code: "RT-FC.SA.US",
    level: 3,
    parent: "RT-FC.SA",
    name: "OFAC (US) sanctions",
    owner: OWNER_INHERIT,
    definition: "Risk of breach of OFAC SDN + sectoral sanctions; secondary-sanctions exposure.",
  },
  {
    code: "RT-FC.SA.EU",
    level: 3,
    parent: "RT-FC.SA",
    name: "EU sanctions",
    owner: OWNER_INHERIT,
    definition: "Risk of breach of EU restrictive measures.",
  },
  {
    code: "RT-FC.SA.UK",
    level: 3,
    parent: "RT-FC.SA",
    name: "UK (OFSI) sanctions",
    owner: OWNER_INHERIT,
    definition: "Risk of breach of UK OFSI consolidated sanctions list.",
  },
  {
    code: "RT-FC.SA.ZA",
    level: 3,
    parent: "RT-FC.SA",
    name: "Domestic (TPRA) sanctions",
    owner: OWNER_INHERIT,
    definition:
      "Risk of breach of South Africa's Targeted Financial Sanctions regime under POCDATARA + FIC Act §28A.",
  },

  // -----------------------------------------------------------------------
  // Level 3 — RT-CR.SL (settlement).
  // -----------------------------------------------------------------------
  {
    code: "RT-CR.SL.FX",
    level: 3,
    parent: "RT-CR.SL",
    name: "FX-settlement risk",
    owner: OWNER_INHERIT,
    definition:
      "Herstatt risk on FX trades not settled PvP (per Hoz indirect-participant posture — CLS via correspondent only).",
  },
  {
    code: "RT-CR.SL.SC",
    level: 3,
    parent: "RT-CR.SL",
    name: "Securities-settlement risk",
    owner: OWNER_INHERIT,
    definition:
      "Risk on securities-vs-cash settlement (JSE Strate; international CSDs via custodian).",
  },
];

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

const CODE_SET: ReadonlySet<RiskTaxonomyCode> = new Set(RISK_TAXONOMY.map((n) => n.code));

const CHILDREN_BY_PARENT: ReadonlyMap<RiskTaxonomyCode, ReadonlySet<RiskTaxonomyCode>> = (() => {
  const out = new Map<RiskTaxonomyCode, Set<RiskTaxonomyCode>>();
  for (const node of RISK_TAXONOMY) {
    if (node.parent !== null) {
      const set = out.get(node.parent) ?? new Set<RiskTaxonomyCode>();
      set.add(node.code);
      out.set(node.parent, set);
    }
  }
  return out;
})();

/**
 * True if `code` has no child node in the taxonomy. A risk is classified
 * at its narrowest stable terminal node (register §6 mapping rules).
 */
export function isTerminal(code: RiskTaxonomyCode): boolean {
  if (!CODE_SET.has(code)) {
    throw new Error(`Unknown RiskTaxonomyCode: ${code}`);
  }
  const children = CHILDREN_BY_PARENT.get(code);
  return children === undefined || children.size === 0;
}

/**
 * Lookup a node by its code. Returns `undefined` if the code is not in
 * the taxonomy. Callers in code paths should narrow via the union type;
 * this helper is for register / display use.
 */
export function getRiskTaxonomyNode(code: RiskTaxonomyCode): RiskTaxonomyNode | undefined {
  return RISK_TAXONOMY.find((n) => n.code === code);
}

/**
 * All codes — typed handle for iteration sites that need every node.
 */
export const RISK_TAXONOMY_CODES: ReadonlyArray<RiskTaxonomyCode> = RISK_TAXONOMY.map(
  (n) => n.code,
);

// ---------------------------------------------------------------------------
// DCAM assembly — Risk taxonomy
// ---------------------------------------------------------------------------

import {
  CONCEPTUAL_REGISTRY,
  PHYSICAL_RISK_L1,
  getLogicalMappings,
} from "../taxonomies/dcam/index";
import type { DcamAlignment } from "../taxonomies/dcam/types";

/**
 * Assemble the full DCAM three-layer alignment for a risk taxonomy L1 code.
 * Returns undefined for codes with no conceptual anchor (RT-ST, RT-RP, RT-CL).
 * L2/L3 nodes inherit alignment from their L1 parent — call with the L1 code.
 */
export function getRiskDcamAlignment(code: string): DcamAlignment | undefined {
  const physical = PHYSICAL_RISK_L1[code];
  if (!physical) return undefined;
  const concept = CONCEPTUAL_REGISTRY.get(physical.conceptKey);
  if (!concept) return undefined;
  const logical = getLogicalMappings(physical.conceptKey);

  // For risk codes, override with the per-code BCBS ref if present;
  // otherwise fall through to any BCBS mappings on the shared concept.
  const bcbsLogical = physical.bcbsRef
    ? [
        {
          standard: "BCBS" as const,
          ref: physical.bcbsRef,
          label:
            logical.find(
              (m) => m.standard === "BCBS" && m.notes?.includes(code.replace("RT-", "RT-")),
            )?.label ??
            logical.find((m) => m.standard === "BCBS")?.label ??
            "BCBS Reference",
          skosMatch: "exactMatch" as const,
        },
      ]
    : logical
        .filter((m) => m.standard === "BCBS")
        .map((m) => ({
          standard: m.standard,
          ref: m.ref,
          label: m.label,
          skosMatch: m.skosMatch,
          ...(m.notes !== undefined ? { notes: m.notes } : {}),
        }));

  const nonBcbsLogical = logical
    .filter((m) => m.standard !== "BCBS")
    .map((m) => ({
      standard: m.standard,
      ref: m.ref,
      label: m.label,
      skosMatch: m.skosMatch,
      ...(m.notes !== undefined ? { notes: m.notes } : {}),
    }));

  const allLogical = [...bcbsLogical, ...nonBcbsLogical];

  const conceptual = {
    fiboModule: concept.fiboModule,
    fiboIri: concept.fiboIri,
    fiboLabel: concept.fiboLabel,
    skosMatch: concept.skosMatch,
    ...(concept.definition !== undefined ? { definition: concept.definition } : {}),
  };

  return {
    conceptual,
    ...(allLogical.length > 0 ? { logical: allLogical } : {}),
  };
}
