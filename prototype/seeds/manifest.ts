// seeds/manifest.ts
//
// Canonical inventory of the bank's foundational build-phase seeds. Every seed
// source that establishes standing build-phase state has exactly one entry
// here. This is what makes the seed layer *visible* (the /api/seeds + Seeds page
// read it): a seed may not ship invisibly (objective 1 of
// D-TRUSTED-FIGURES-PROGRAM-V1).
//
// Seeds now exist in two forms, both registered here:
//   1. `boot-ingester`     — market-data fixtures ingested into the
//                            MarketDataStore on every server boot
//                            (`bootDerive()` in dashboard/server.ts). These
//                            write reference *ticks*, not event-store events.
//   2. `idempotent-script` — standing `scripts/*.ts` that append foundational
//                            *events* to the event store (party register,
//                            security master, models, RAS limits, KYC, policy,
//                            capital). Run manually / out-of-band; idempotent.
//
// Parity is enforced by `recon:seed-manifest-parity`: every entry's source file
// (and any data fixture) must exist on disk, every boot-ingester's `bootFn` must
// be wired in server.ts, and every declared `emittedEventTypes` must be in
// EVENT_TYPE_REGISTRY. A new seed cannot ship invisibly.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

/** Classification of what a seed populates. */
export type SeedKind =
  | "identity"
  | "instruments"
  | "market-data"
  | "models"
  | "risk-limits"
  | "kyc"
  | "policy"
  | "capital";

/** Which of the two seed forms an entry is. */
export type SeedSource = "boot-ingester" | "idempotent-script";

/** A pointer to the authoring UI that replaces a seed with real-simulated events. */
export interface SeedReplaceTarget {
  /** Display label for the authoring surface. */
  label: string;
  /** Dashboard page that authors the real-simulated equivalent. */
  href: string;
}

export interface SeedManifestEntry {
  /** Stable identifier — the key SeedDescoped / SeedPromotedToSimulated reference. */
  seedId: string;
  /** Which seed form this is — boot-time ingester vs standing idempotent script. */
  source: SeedSource;
  /**
   * Repo-relative path to the file that runs the seed: the ingester module
   * (boot-ingester) or the `scripts/*.ts` (idempotent-script). The recon
   * asserts this exists on disk.
   */
  sourcePath: string;
  /** Human string describing how the seed runs (shown on the Seeds page). */
  invocation: string;
  /**
   * For boot-ingester seeds: the ingest function name called in
   * `dashboard/server.ts` `bootDerive()`. The recon asserts it is wired there.
   */
  bootFn?: string;
  /** Repo-relative path to the JSON/TS data fixture the seed consumes, if any. */
  dataFile?: string;
  /** Short human title for the Seeds page. */
  title: string;
  /** What the seed populates and why it exists. */
  description: string;
  /** Classification. */
  kind: SeedKind;
  /**
   * Event types this seed emits into the event store (for the Seeds page live
   * counts + parity registration check). Empty for pure market-data ingesters.
   */
  emittedEventTypes: readonly string[];
  /**
   * MarketDataStore dataTypes this seed writes (reference ticks). Used for the
   * Seeds page live tick counts. Set for market-data feeds.
   */
  marketDataTypes?: readonly string[];
  /**
   * May an operator descope this at next boot? Visibility-only in the current
   * slice — all entries are `false` (the Seeds page renders read-only). Descope
   * wiring is a follow-up.
   */
  descopable: boolean;
  /** If the seed can be replaced with real-simulated events, the authoring UI. */
  replaceWith?: SeedReplaceTarget;
  /** Citations for the seed's authority. */
  citations: readonly string[];
}

const TFP = "D-TRUSTED-FIGURES-PROGRAM-V1";

export const SEED_MANIFEST: readonly SeedManifestEntry[] = [
  // ---------------------------------------------------------------------------
  // Boot-ingester seeds — market-data reference fixtures loaded every boot.
  // ---------------------------------------------------------------------------
  {
    seedId: "md-zaronia",
    source: "boot-ingester",
    sourcePath: "platform/market-data/sarb-zaronia-ingester.ts",
    invocation: "bootDerive() → ingestZaroniaFixtureFromFile",
    bootFn: "ingestZaroniaFixtureFromFile",
    dataFile: "seeds/zaronia-rates.json",
    title: "SARB ZARONIA fixings",
    description:
      "SARB ZARONIA (ZAR Overnight Index Average) daily fixings — the ZAR risk-free rate that anchors the FTP curve. Loaded into the MarketDataStore as reference ticks on every boot.",
    kind: "market-data",
    emittedEventTypes: [],
    marketDataTypes: ["zaronia-rate"],
    descopable: false,
    citations: ["D-PNL-ATTR-FTP-CURVE-FIX", TFP],
  },
  {
    seedId: "md-jibar-fixing",
    source: "boot-ingester",
    sourcePath: "platform/market-data/jibar-fixing-ingester.ts",
    invocation: "bootDerive() → ingestJibarFixingFixtureFromFile",
    bootFn: "ingestJibarFixingFixtureFromFile",
    dataFile: "seeds/jibar-fixings.json",
    title: "AFMA JIBAR 3M fixings",
    description:
      "AFMA JIBAR 3-month daily fixings — the benchmark interbank reference rate used for IRS coupon and discount-curve input. Reference ticks only.",
    kind: "market-data",
    emittedEventTypes: [],
    marketDataTypes: ["jibar-fixing"],
    descopable: false,
    citations: ["D-PRODUCT-CONSTRUCTION-SLICES-4-8", "D-MARKETS-SCHEMA-FOUNDATION"],
  },
  {
    seedId: "md-jibar-swap-curve",
    source: "boot-ingester",
    sourcePath: "platform/market-data/jibar-swap-curve-ingester.ts",
    invocation: "bootDerive() → ingestJibarSwapCurveFixtureFromFile",
    bootFn: "ingestJibarSwapCurveFixtureFromFile",
    dataFile: "seeds/jibar-swap-curve.json",
    title: "ZAR IRS swap curve",
    description:
      "ZAR interest-rate-swap curve (multiple tenors) — reference curve for IRS pricing and discount-factor generation. Reference ticks only.",
    kind: "market-data",
    emittedEventTypes: [],
    marketDataTypes: ["swap-curve"],
    descopable: false,
    citations: ["D-PRODUCT-CONSTRUCTION-SLICES-4-8", "D-MARKETS-SCHEMA-FOUNDATION"],
  },
  {
    seedId: "md-sarb-repo-prime",
    source: "boot-ingester",
    sourcePath: "platform/market-data/sarb-repo-prime-ingester.ts",
    invocation: "bootDerive() → ingestSarbRepoPrimeFixtureFromFile",
    bootFn: "ingestSarbRepoPrimeFixtureFromFile",
    dataFile: "seeds/sarb-repo-rate.json",
    title: "SARB repo / prime rate",
    description:
      "SARB repo (policy) rate and prime reference rate daily fixings — input to liquidity and repricing models. Reference ticks only.",
    kind: "market-data",
    emittedEventTypes: [],
    marketDataTypes: ["repo-prime"],
    descopable: false,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
  },
  {
    seedId: "md-bond-prices",
    source: "boot-ingester",
    sourcePath: "platform/market-data/bond-price-ingester.ts",
    invocation: "bootDerive() → ingestBondPriceFixtureFromFile",
    bootFn: "ingestBondPriceFixtureFromFile",
    dataFile: "seeds/bond-prices.json",
    title: "SA government bond prices",
    description:
      "SA government bond (R186, R2030, R2040) JSE end-of-day clean prices and yields — reference prices for the Market Data Bonds section. Reference ticks, not valuation marks.",
    kind: "market-data",
    emittedEventTypes: [],
    marketDataTypes: ["bond-price"],
    descopable: false,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "D-FINANCIAL-INSTRUMENT-ENTITY"],
  },

  // ---------------------------------------------------------------------------
  // Idempotent-script seeds — standing scripts that append foundational events.
  // ---------------------------------------------------------------------------
  {
    seedId: "party-register",
    source: "idempotent-script",
    sourcePath: "scripts/party-backfill.ts",
    invocation: "bun run scripts/party-backfill.ts",
    dataFile: "seeds/legal-entity-tree.json",
    title: "Party register & legal-entity tree",
    description:
      "The single master party register — legal entities (Hoz group, counterparties, sim banks), agents, and the founding CEO seat, plus the party-relationship graph and classifications. The identity axis the whole substrate rests on (Principle 2).",
    kind: "identity",
    emittedEventTypes: ["PartyRegistered", "PartyRelationshipAsserted", "PartyClassified"],
    descopable: false,
    citations: ["D-PARTY-REGISTER", "D-LEGAL-ENTITY-TREE-V0"],
  },
  {
    seedId: "fleet-register",
    source: "idempotent-script",
    sourcePath: "scripts/register-fleet.ts",
    invocation: "bun run scripts/register-fleet.ts",
    title: "Agent fleet register",
    description:
      "Registers the standing autonomous-agent fleet (the bank's labour force, Principle 6) as AgentRegistered events — the agent axis joined to the party register.",
    kind: "identity",
    emittedEventTypes: ["AgentRegistered"],
    descopable: false,
    citations: ["D-PARTY-REGISTER", TFP],
  },
  {
    seedId: "security-master",
    source: "idempotent-script",
    sourcePath: "scripts/seed-financial-instruments.ts",
    invocation: "bun run scripts/seed-financial-instruments.ts",
    dataFile: "seeds/financial-instruments/sa-government-bonds.ts",
    title: "Security master (instruments)",
    description:
      "The financial-instrument security master — SA government bonds, JSE equities, ZAR IRS, and treasury instruments (REPO/MMD/IBL) defined and classified (HQLA level, Basel risk weight, IFRS 9 category).",
    kind: "instruments",
    emittedEventTypes: ["FinancialInstrumentDefined", "FinancialInstrumentClassified"],
    descopable: false,
    citations: ["D-FINANCIAL-INSTRUMENT-ENTITY"],
  },
  {
    seedId: "bank-trading-attributes",
    source: "idempotent-script",
    sourcePath: "scripts/patch-bank-fx-attributes.ts",
    invocation: "bun run scripts/patch-bank-fx-attributes.ts",
    title: "Counterparty trading attributes",
    description:
      "Patches BIC, LEI, authorised products, and eligible FX pairs onto every bank counterparty (real + sim) in the party register, so the FX sim engine and trading desks can resolve them.",
    kind: "identity",
    emittedEventTypes: ["PartyAttributeChanged"],
    descopable: false,
    citations: ["D-PARTY-REGISTER", "D-FX-SALES-TRADING-FRONTEND"],
  },
  {
    seedId: "real-bank-kyc",
    source: "idempotent-script",
    sourcePath: "scripts/seed-real-banks-kyc.ts",
    invocation: "bun run scripts/seed-real-banks-kyc.ts",
    title: "Institutional counterparty KYC",
    description:
      "Full KYC onboarding chain for the real institutional counterparties (Standard Bank, Investec) — candidate registration through identity, sanctions/PEP, UBO, risk-rating, decision, acceptance, and lawful-processing registration.",
    kind: "kyc",
    emittedEventTypes: [
      "ClientCandidateRegistered",
      "KYCIdentityCollected",
      "KYCIdentityVerified",
      "KYCSanctionsPEPScreened",
      "KYCUBOResolved",
      "KYCRiskRated",
      "KYCDecisionMade",
      "ClientAccepted",
      "LawfulProcessingRegistered",
    ],
    descopable: false,
    citations: ["D-KYC-ONBOARDING-BUILD", "D-FX-SALES-TRADING-FRONTEND"],
  },
  {
    seedId: "counterparty-eligibility",
    source: "idempotent-script",
    sourcePath: "scripts/seed-counterparty-eligibility.ts",
    invocation: "bun run scripts/seed-counterparty-eligibility.ts",
    title: "Counterparty eligibility screening",
    description:
      "Emits institutional-eligible CounterpartyEligibilityScreened decisions for KYC-onboarded clients, gating which counterparties may trade.",
    kind: "kyc",
    emittedEventTypes: ["CounterpartyEligibilityScreened"],
    descopable: false,
    citations: ["D-FX-SALES-TRADING-FRONTEND"],
  },
  {
    seedId: "calc-models",
    source: "idempotent-script",
    sourcePath: "scripts/run-calc-model-seed.ts",
    invocation: "bun run scripts/run-calc-model-seed.ts",
    title: "Regulatory calculation models",
    description:
      "The regulatory-metric calculation models (LCR, NSFR, CET1, RWA, ECL, IRRBB, market-risk, CVA) — submitted, tier-classified, and validation-approved in the model registry.",
    kind: "models",
    emittedEventTypes: ["ModelSubmitted", "ModelTierClassified", "ModelValidationApproved"],
    descopable: false,
    citations: [TFP, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1"],
  },
  {
    seedId: "pricing-models",
    source: "idempotent-script",
    sourcePath: "scripts/run-model-registry-seed.ts",
    invocation: "bun run scripts/run-model-registry-seed.ts",
    title: "Pricing models",
    description:
      "The pricing models (SAGB DCF, ZARONIA OIS + IRS-PV, FX-forward IRP) — submitted and tier-classified in the model registry.",
    kind: "models",
    emittedEventTypes: ["ModelSubmitted", "ModelTierClassified"],
    descopable: false,
    citations: ["D-PRODUCT-CONSTRUCTION-SLICES-4-8", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
  },
  {
    seedId: "bank-mode-policy",
    source: "idempotent-script",
    sourcePath: "scripts/seed-bank-mode-policy.ts",
    invocation: "bun run scripts/seed-bank-mode-policy.ts",
    title: "Bank-mode provenance policy",
    description:
      "Sets the initial bank-wide provenance policy (default: sim / build-phase, with per-category granularity) that drives the canonical operating-book filter and the sandbox-simulator gate.",
    kind: "policy",
    emittedEventTypes: ["BankModePolicySet"],
    descopable: false,
    citations: ["D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE"],
  },
  {
    seedId: "ras-limits",
    source: "idempotent-script",
    sourcePath: "scripts/seed-ras-limits.ts",
    invocation: "bun run scripts/seed-ras-limits.ts",
    title: "Risk-appetite limit schedule",
    description:
      "Publishes the Risk Appetite Statement limit schedule (the RAS Tier-1 limits the risk engines measure utilisation against).",
    kind: "risk-limits",
    emittedEventTypes: ["RasLimitSchedulePublished"],
    descopable: false,
    citations: ["D-RAS-V1"],
  },
  {
    seedId: "mr-1-fx-ras",
    source: "idempotent-script",
    sourcePath: "scripts/seed-mr-1-fx-ras-schedule.ts",
    invocation: "bun run scripts/seed-mr-1-fx-ras-schedule.ts",
    title: "MR-1-FX market-risk RAS limit",
    description:
      "Publishes the MR-1-FX market-risk RAS limit schedule for the FX-spot controlled launch (Helena's limit proposal).",
    kind: "risk-limits",
    emittedEventTypes: ["RasLimitSchedulePublished"],
    descopable: false,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
  },
  {
    seedId: "fx-spot-controlled-launch-limits",
    source: "idempotent-script",
    sourcePath: "scripts/seed-fx-spot-controlled-launch-limits.ts",
    invocation: "bun run scripts/seed-fx-spot-controlled-launch-limits.ts",
    title: "FX-spot counterparty credit limits",
    description:
      "Loads the FX-spot controlled-launch counterparty credit limits and ISDA/CSA assessments for the institutional counterparties.",
    kind: "risk-limits",
    emittedEventTypes: ["CreditLimitLoaded", "ISDACSAAssessmentCompleted"],
    descopable: false,
    citations: ["D-FX-SALES-TRADING-FRONTEND"],
  },
  {
    seedId: "sarb-fx-fixings",
    source: "idempotent-script",
    sourcePath: "scripts/bootstrap/seed-sarb-fixings.ts",
    invocation: "bun run seed:sarb-fixings",
    dataFile: "seeds/sarb-fixing-rates.json",
    title: "SARB FX spot fixings",
    description:
      "SARB ZAR fixing rates (USD/ZAR 17:00 SAST) loaded as MarketDataStore ticks and adopted as OfficialMarkAdopted IFRS-13 Level-2 marks for FX valuation.",
    kind: "market-data",
    emittedEventTypes: ["OfficialMarkAdopted"],
    marketDataTypes: ["fx-quote"],
    descopable: false,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
  },
  {
    seedId: "capital-injection",
    source: "idempotent-script",
    sourcePath: "scripts/emit-capital-injection-sim.ts",
    invocation: "bun run scripts/emit-capital-injection-sim.ts",
    title: "Founding capital injection",
    description:
      "Posts the simulated founding capital injection (CapitalEvent + GL sub-ledger postings) that capitalises the bank for the build phase.",
    kind: "capital",
    emittedEventTypes: ["CapitalEvent", "SubLedgerPostingEmitted"],
    descopable: false,
    citations: ["D-MARKETS-CAPITAL-TIME-SHAPE"],
  },
  {
    seedId: "permission-policies",
    source: "idempotent-script",
    sourcePath: "scripts/seed-permission-policies.ts",
    invocation: "bun run seed:permission-policies",
    title: "Permission policies",
    description:
      "Publishes the permission-gate policies that govern which agents/seats may perform which capability actions (least-privilege, Principle 4).",
    kind: "policy",
    emittedEventTypes: ["PermissionPolicyPublished"],
    descopable: false,
    citations: ["D-PERMISSION-GATE"],
  },
];

/** Look up a manifest entry by seedId. */
export function getSeedManifestEntry(seedId: string): SeedManifestEntry | undefined {
  return SEED_MANIFEST.find((e) => e.seedId === seedId);
}

/** All seedIds in the manifest. */
export function allSeedIds(): string[] {
  return SEED_MANIFEST.map((e) => e.seedId);
}
