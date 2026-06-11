// platform/risk/ras-appetite-register.ts
//
// Canonical typed register of the bank's Risk Appetite Statement (RAS)
// appetite lines — the single source of truth for the 14 appetite lines,
// their tiers, structured thresholds, measurement bindings, and citations.
//
// Previously these lived as a HAND-CURATED `AppetiteLine` interface +
// `APPETITE_LINES` array inside `runtime/agents/helena-risk-appetite-watch.ts`,
// with thresholds ALSO re-embedded as hardcoded strings in that handler's
// render functions. That coupled the appetite framework (governance-owned,
// CRO-approved) to one runtime handler's source and produced a split-brain
// render: the appetite-line table derived status live while the threshold
// strings were typed by hand in two places. This register collapses both
// into one typed-canonical-data module (Principle 2 — single-graph
// discipline), mirroring the precedent in `platform/risk/taxonomy.ts` and
// `platform/substrate/gap-register.ts`.
//
// HARD CONSTRAINT — byte-faithful extraction of the CRO's approved RAS
// (D-RAS, CEO-approved 2026-05-06). This module changes NO threshold, tier,
// category, or line. The `thresholds.format()` helper round-trips to the
// EXACT human strings the daily report has always printed, and the
// `classify()` helper reproduces the exact band logic the handler's
// `statusForLcrRatio` / `statusForNsfrRatio` functions evaluated. The
// `recon:ras-register-parity` gate + the handler faithfulness test pin this.
//
// Authority: D-RAS (CEO-approved 2026-05-06); D-RAS-STRUCTURED-REGISTER
//   (CEO-approved 2026-06-08); D-BOND-RAS-APPETITE (CRO-approved 2026-06-08);
//   D-INTRADAY-RAS-APPETITE (CRO-approved 2026-06-11, under
//   D-TREASURER-WAVE1-SUBSTRATE); RAS §§B2–B8 + A2.
// Author: Atlas (Substrate engineer, engineering) — extraction substrate;
//         Helena (Chief Risk Officer, governance) — appetite-line authority.

// ---------------------------------------------------------------------------
// Shared status + tier vocabulary
// ---------------------------------------------------------------------------

/** Breach tier per RAS §B9 breach taxonomy. */
export type RasTier = "tier-1" | "tier-2" | "tier-3" | "zero-appetite";

/** Per-line measurement status reported on the daily RiskAppetiteSnapshot. */
export type RasMetricStatus = "green" | "amber" | "red" | "unmeasured" | "n/a-build-phase";

/** Risk-taxonomy category (Helena's domain) the line maps to. */
export type RasCategory =
  | "credit"
  | "market"
  | "liquidity"
  | "irrbb"
  | "operational"
  | "conduct"
  | "financial-crime"
  | "legal-regulatory"
  | "strategic"
  | "model"
  | "climate"
  | "capital";

// ---------------------------------------------------------------------------
// Structured thresholds
// ---------------------------------------------------------------------------
//
// A threshold band is a named RAG/critical band with the EXACT formatted token
// the report prints (e.g. "green ≥120%"). For ratio-measured lines we also
// carry the typed numeric bound so a status-classifier can EVALUATE the band
// without parsing prose. Non-ratio lines (posture / zero-appetite) carry the
// formatted token only — their appetite is a posture, not a numeric cut.

/** Comparator for a numeric ratio band. `gte` = ≥ lower; `lt` = < upper. */
export type RasBandComparator = "gte" | "between" | "lt";

/** One band in a structured threshold ladder. */
export interface RasThresholdBand {
  /** RAG / critical band name. */
  readonly band: "green" | "amber" | "red" | "critical";
  /**
   * EXACT formatted token the report prints for this band, e.g. "green ≥120%"
   * or "amber 110-120%". Round-trips byte-for-byte to the legacy hardcoded
   * threshold strings. Never the source of an evaluated bound — the numeric
   * fields below are.
   */
  readonly formatted: string;
  /** Numeric comparator shape for ratio bands; absent for posture bands. */
  readonly comparator?: RasBandComparator;
  /** Inclusive lower bound (percent) for `gte` / `between` bands. */
  readonly lowerPct?: number;
  /** Exclusive upper bound (percent) for `lt` / `between` bands. */
  readonly upperPct?: number;
}

/**
 * Structured thresholds for an appetite line. `kind: "ratio"` lines carry an
 * ordered band ladder (green → amber → red → critical) with both formatted
 * tokens and numeric bounds. `kind: "posture"` lines carry a single formatted
 * statement (e.g. zero-appetite, governance posture) with no numeric cut.
 */
export type RasThresholds =
  | {
      readonly kind: "ratio";
      /**
       * The ` / `-joined human string the report prints. Stored explicitly so
       * the round-trip is a field equality, not a re-derivation. MUST equal
       * `bands.map((b) => b.formatted).join(" / ")`.
       */
      readonly printed: string;
      /** Ordered bands, best → worst. */
      readonly bands: readonly RasThresholdBand[];
    }
  | {
      readonly kind: "posture";
      /** The human posture statement (e.g. zero-appetite description). */
      readonly printed: string;
    };

/** Format the threshold ladder back to the exact human string the report prints. */
export function formatThresholds(t: RasThresholds): string {
  return t.printed;
}

/**
 * Classify a ratio (percent, or `null` for the "effectively infinite" no-flow
 * case) into a RAG status under a `ratio` threshold ladder. Reproduces the
 * exact band logic the handler's `statusForLcrRatio` / `statusForNsfrRatio`
 * evaluated: null → green; below the critical bound → red; below the red
 * bound → red; below the amber lower bound → amber; else green.
 *
 * LOWER-IS-WORSE ladders only (LCR / NSFR style: green is the ≥ band). For
 * usage-style HIGHER-IS-WORSE ladders (green is the < band) use
 * `classifyUsageRatio`.
 *
 * Returns `null` for posture thresholds (no numeric classification).
 */
export function classifyRatio(t: RasThresholds, ratioPct: number | null): RasMetricStatus | null {
  if (t.kind !== "ratio") return null;
  // null + above-minimum is the "effectively infinite" case (buffer present,
  // zero net flow). Treat as green — identical to the legacy classifier.
  if (ratioPct === null) return "green";
  const green = t.bands.find((b) => b.band === "green");
  const amber = t.bands.find((b) => b.band === "amber");
  // Below the amber lower bound (== red upper bound) → red; the critical band
  // is a sub-band of red and resolves to red in the legacy classifier too.
  const amberLower = amber?.lowerPct;
  const greenLower = green?.lowerPct;
  if (amberLower !== undefined && ratioPct < amberLower) return "red";
  if (greenLower !== undefined && ratioPct < greenLower) return "amber";
  return "green";
}

/**
 * Classify a usage-style ratio (percent, or `null` for the build-phase
 * no-usage case) into a RAG status under a HIGHER-IS-WORSE `ratio` threshold
 * ladder (green is the `<` band; amber/red/critical rise with the measure —
 * e.g. `appetite:liquidity:intraday` peak intraday usage as % of available
 * start-of-day liquidity). Mirrors `classifyRatio`'s contract: null → green
 * (no measurable usage); at/above the red lower bound → red (the critical
 * band is a sub-band of red and resolves to red, exactly as in
 * `classifyRatio`); at/above the amber lower bound → amber; else green.
 *
 * Returns `null` for posture thresholds (no numeric classification).
 */
export function classifyUsageRatio(
  t: RasThresholds,
  usagePct: number | null,
): RasMetricStatus | null {
  if (t.kind !== "ratio") return null;
  // Null usage is the build-phase "nothing to measure" case (zero start-of-day
  // availability ⇒ the headline measure is undefined). Treat as green —
  // consistent with classifyRatio's null-handling.
  if (usagePct === null) return "green";
  const amber = t.bands.find((b) => b.band === "amber");
  const red = t.bands.find((b) => b.band === "red");
  const redLower = red?.lowerPct;
  const amberLower = amber?.lowerPct;
  if (redLower !== undefined && usagePct >= redLower) return "red";
  if (amberLower !== undefined && usagePct >= amberLower) return "amber";
  return "green";
}

// ---------------------------------------------------------------------------
// Appetite-line shape
// ---------------------------------------------------------------------------

/** One canonical RAS appetite line. */
export interface RasAppetiteLine {
  /** Stable id; convention `appetite:<category>:<short-slug>`. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** RAS section this line is sourced from. */
  readonly rasSection: string;
  /** Risk-taxonomy category. */
  readonly category: RasCategory;
  /** Breach tier per RAS §B9. */
  readonly tier: RasTier;
  /** Structured thresholds — typed, evaluable, round-trippable to print. */
  readonly thresholds: RasThresholds;
  /**
   * Governed monetary floor (ZAR, major units) for lines whose calibration
   * carries an absolute buffer floor in addition to the ratio bands. This is
   * the CANONICAL source of the value consuming engines evaluate — e.g.
   * `platform/alm/intraday-stress.ts` reads the intraday floor from here
   * rather than a module-local constant (D-INTRADAY-RAS-APPETITE). Absent for
   * lines with no monetary-floor calibration.
   */
  readonly floorZar?: number;
  /**
   * The projection / event that MEASURES this line (function name or event
   * type), or `null` when the line is genuinely unmeasured today. Turns the
   * "measurement substrate" gap into a per-line checkable fact.
   */
  readonly measurementBinding: string | null;
  /** Engineer-owner → governance-owner chain that builds + owns measurement. */
  readonly measurementOwner: string;
  /**
   * Citations: RAS section + D-RAS + any line-specific threshold decision.
   * Principle 2 — every line traces upward to its source.
   */
  readonly citations: readonly string[];
  /**
   * Human one-line summary of what the line says. Documentation ONLY — never
   * the source of any threshold the code evaluates (use `thresholds`).
   */
  readonly summary: string;
}

// Decision citations shared across many lines.
const D_RAS = "D-RAS";
const RAS_FRAMEWORK = "RAS-FRAMEWORK-2026-05-06";

// ---------------------------------------------------------------------------
// Canonical register — 14 appetite lines as of the 2026-05-06 RAS approval
// (D-RAS-STRUCTURED-REGISTER), plus 2 bond-trading lines added 2026-06-08
// (D-BOND-RAS-APPETITE), plus 1 intraday-liquidity line added 2026-06-11
// (D-INTRADAY-RAS-APPETITE): 17 lines total.
// Byte-faithful extraction (D-RAS-STRUCTURED-REGISTER). Order preserved from
// the legacy APPETITE_LINES array so the snapshot keyset is identical.
// ---------------------------------------------------------------------------

export const RAS_APPETITE_LINES: readonly RasAppetiteLine[] = [
  {
    id: "appetite:liquidity:lcr",
    label: "LCR buffer",
    rasSection: "RAS §B3",
    category: "liquidity",
    tier: "tier-1",
    thresholds: {
      kind: "ratio",
      printed: "green ≥120% / amber 110-120% / red <110% / critical <105%",
      bands: [
        { band: "green", formatted: "green ≥120%", comparator: "gte", lowerPct: 120 },
        {
          band: "amber",
          formatted: "amber 110-120%",
          comparator: "between",
          lowerPct: 110,
          upperPct: 120,
        },
        { band: "red", formatted: "red <110%", comparator: "lt", upperPct: 110 },
        { band: "critical", formatted: "critical <105%", comparator: "lt", upperPct: 105 },
      ],
    },
    measurementBinding: "computeLCR",
    measurementOwner: "Ravi (eng) → Eitan (Treasurer)",
    citations: [D_RAS, RAS_FRAMEWORK, "RRTB-REG-26"],
    summary:
      "Operate at 120% PA min in normal conditions; trigger management action <110%; mandatory BRC escalation <105%.",
  },
  {
    id: "appetite:liquidity:nsfr",
    label: "NSFR buffer",
    rasSection: "RAS §B3",
    category: "liquidity",
    tier: "tier-1",
    thresholds: {
      kind: "ratio",
      printed: "green ≥115% / amber 108-115% / red <108% / critical <103%",
      bands: [
        { band: "green", formatted: "green ≥115%", comparator: "gte", lowerPct: 115 },
        {
          band: "amber",
          formatted: "amber 108-115%",
          comparator: "between",
          lowerPct: 108,
          upperPct: 115,
        },
        { band: "red", formatted: "red <108%", comparator: "lt", upperPct: 108 },
        { band: "critical", formatted: "critical <103%", comparator: "lt", upperPct: 103 },
      ],
    },
    measurementBinding: "computeNSFR",
    measurementOwner: "Ravi (eng) → Eitan (Treasurer)",
    citations: [D_RAS, RAS_FRAMEWORK, "RRTB-REG-26A"],
    summary: "Operate at 115% PA min; trigger at 108%; escalate at 103%.",
  },
  {
    id: "appetite:capital:cet1-buffer",
    label: "CET1 buffer over PA min",
    rasSection: "RAS §B3",
    category: "capital",
    tier: "tier-1",
    thresholds: {
      kind: "posture",
      printed:
        "Operate above PA min + Pillar 2A + CCB + 1.5pp; trigger at PA min + 0.75pp; escalate at PA min + 0.25pp.",
    },
    measurementBinding: "computeCapitalMetrics",
    measurementOwner: "Bea (eng) → Camille (CFO) joint with Helena (CRO)",
    citations: [D_RAS, RAS_FRAMEWORK, "D-MARKETS-CAPITAL-TIME-SHAPE"],
    summary:
      "Operate above PA min + Pillar 2A + CCB + 1.5pp; trigger at PA min + 0.75pp; escalate at PA min + 0.25pp.",
  },
  {
    id: "appetite:capital:leverage-ratio",
    label: "Basel III leverage ratio (Tier-1 / total exposure)",
    rasSection: "RAS §B3",
    category: "capital",
    tier: "tier-1",
    thresholds: {
      kind: "ratio",
      printed: "green ≥4.5% / amber 4.0-4.5% / red 3.5-4.0% / critical <3.5%",
      bands: [
        { band: "green", formatted: "green ≥4.5%", comparator: "gte", lowerPct: 4.5 },
        {
          band: "amber",
          formatted: "amber 4.0-4.5%",
          comparator: "between",
          lowerPct: 4.0,
          upperPct: 4.5,
        },
        {
          band: "red",
          formatted: "red 3.5-4.0%",
          comparator: "between",
          lowerPct: 3.5,
          upperPct: 4.0,
        },
        { band: "critical", formatted: "critical <3.5%", comparator: "lt", upperPct: 3.5 },
      ],
    },
    measurementBinding: "computeLeverageRatioMetrics",
    measurementOwner: "Bea (eng) → Camille (CFO) joint with Helena (CRO)",
    citations: [
      D_RAS,
      RAS_FRAMEWORK,
      "D-MARKETS-CAPITAL-TIME-SHAPE",
      "D-RAS-LEVERAGE-RATIO-THRESHOLDS",
    ],
    summary:
      "Non-risk-weighted Tier-1 / total exposure measure per BCBS §147–§165 + RRTB Reg 38. Regulatory minimum 3%; proposed appetite thresholds green ≥4.5% / amber 4.0-4.5% / red 3.5-4.0% / critical <3.5% (Marc pending — Decision(requested) D-RAS-LEVERAGE-RATIO-THRESHOLDS).",
  },
  {
    id: "appetite:credit:single-name-concentration",
    label: "Single-name credit concentration",
    rasSection: "RAS §B2",
    category: "credit",
    tier: "tier-2",
    thresholds: {
      kind: "posture",
      printed:
        "Default single-name exposure cap as % of CET1 (RAS §B2 default; PA Concentration Risk regs binding).",
    },
    measurementBinding: null,
    measurementOwner: "Rohan (eng) → Helena (CRO)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary:
      "Default single-name exposure cap as % of CET1 (RAS §B2 default; PA Concentration Risk regs binding).",
  },
  {
    id: "appetite:credit:sector-concentration",
    label: "Sector concentration",
    rasSection: "RAS §B2",
    category: "credit",
    tier: "tier-2",
    thresholds: {
      kind: "posture",
      printed:
        "Default sector cap as % of credit RWA (RAS §B2; cascade authored at first portfolio).",
    },
    measurementBinding: null,
    measurementOwner: "Rohan (eng) → Helena (CRO)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary:
      "Default sector cap as % of credit RWA (RAS §B2; cascade authored at first portfolio).",
  },
  {
    id: "appetite:market:trading-var",
    label: "Trading-book 1-day 99% VaR",
    rasSection: "RAS §B4",
    category: "market",
    tier: "tier-2",
    thresholds: {
      kind: "posture",
      printed: "Default trading-book VaR as % of CET1 (RAS §B4; calibrated when book opens).",
    },
    measurementBinding: null,
    measurementOwner: "Rohan (eng) joint with Kai (eng) → Saskia (Head of Markets)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary: "Default trading-book VaR as % of CET1 (RAS §B4; calibrated when book opens).",
  },
  {
    id: "appetite:market:counterparty-concentration",
    label: "Counterparty concentration (markets)",
    rasSection: "RAS §B8",
    category: "market",
    tier: "tier-2",
    thresholds: {
      kind: "posture",
      printed: "Default per-counterparty cap PFE-based (RAS §B8; cascade at first counterparty).",
    },
    measurementBinding: null,
    measurementOwner: "Rohan (eng) joint with Kai (eng) → Saskia (Head of Markets)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary: "Default per-counterparty cap PFE-based (RAS §B8; cascade at first counterparty).",
  },
  {
    id: "appetite:financial-crime:sanctions-match",
    label: "Sanctions true-positive matches blocked end-to-end pre-execution",
    rasSection: "RAS §B5",
    category: "financial-crime",
    tier: "zero-appetite",
    thresholds: {
      kind: "posture",
      printed:
        "All true-positive matches blocked pre-execution; any production override is a Zara-signed event.",
    },
    measurementBinding: null,
    measurementOwner: "Mira (eng) → Zara (CCO)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary:
      "All true-positive matches blocked pre-execution; any production override is a Zara-signed event.",
  },
  {
    id: "appetite:financial-crime:str-filing-judgement",
    label: "STR-filing judgement (no internal override)",
    rasSection: "RAS §B5",
    category: "financial-crime",
    tier: "zero-appetite",
    thresholds: {
      kind: "posture",
      printed: "STR filing is Zara's judgement; no internal override permitted.",
    },
    measurementBinding: null,
    measurementOwner: "Mira (eng) → Zara (CCO)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary: "STR filing is Zara's judgement; no internal override permitted.",
  },
  {
    id: "appetite:operational:cyber-severity-tiers",
    label: "Cyber-incident severity tiering",
    rasSection: "RAS §B6",
    category: "operational",
    tier: "tier-2",
    thresholds: {
      kind: "posture",
      printed: "Default cyber-incident severity tiers and response SLAs (RAS §B6).",
    },
    measurementBinding: "computeCyberSeverityPosture",
    measurementOwner: "Senna (eng) → Rashida (CISO)",
    citations: [D_RAS, RAS_FRAMEWORK, "CY-IRP-01"],
    summary: "Default cyber-incident severity tiers and response SLAs (RAS §B6).",
  },
  {
    id: "appetite:model:tier-discipline",
    label: "Model-risk tier discipline",
    rasSection: "RAS §B7",
    category: "model",
    tier: "tier-2",
    thresholds: {
      kind: "posture",
      printed: "Independent validation per model tier; production-use gated on validation status.",
    },
    measurementBinding: "getModelTierDisciplineMetric",
    measurementOwner: "Independent Validation (Nolan hire) → Helena (CRO)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary: "Independent validation per model tier; production-use gated on validation status.",
  },
  {
    id: "appetite:climate:guidance-note-1-2024",
    label: "Climate-risk governance per PA GN 1 of 2024",
    rasSection: "RAS A2 — Climate risk",
    category: "climate",
    tier: "tier-2",
    thresholds: {
      kind: "posture",
      printed: "Governance posture for climate risk per PA Guidance Note 1 of 2024.",
    },
    measurementBinding: "getClimateRiskMetric",
    measurementOwner: "Helena (CRO) — substrate not yet specified",
    citations: [D_RAS, RAS_FRAMEWORK, "D-RAS-CLIMATE-SCENARIO-FRAMEWORK"],
    summary: "Governance posture for climate risk per PA Guidance Note 1 of 2024.",
  },
  {
    id: "appetite:conduct:tcf",
    label: "Treating Customers Fairly — zero appetite for unfair treatment",
    rasSection: "RAS A2 — Conduct risk",
    category: "conduct",
    tier: "zero-appetite",
    thresholds: {
      kind: "posture",
      printed:
        "Zero appetite for treating customers unfairly, mis-selling, fee opacity, conflicts of interest unmanaged, or market abuse.",
    },
    measurementBinding: null,
    measurementOwner: "Niko (eng) [paused] joint with Mira (eng) → Zara (CCO)",
    citations: [D_RAS, RAS_FRAMEWORK],
    summary:
      "Zero appetite for treating customers unfairly, mis-selling, fee opacity, conflicts of interest unmanaged, or market abuse.",
  },
  // ── Bond trading appetite lines — added 2026-06-08 per D-BOND-RAS-APPETITE ──
  // Authority: D-BOND-RAS-APPETITE (CRO-approved 2026-06-08).
  {
    id: "appetite:market:bond-inventory-face-value",
    label: "Gross long bond inventory cap — trading book face value",
    rasSection: "RAS §B4",
    category: "market",
    tier: "tier-2",
    thresholds: {
      kind: "ratio",
      printed: "green <R140m face value / amber R140m-R200m / red ≥R200m",
      bands: [
        { band: "green", formatted: "green <R140m face value", comparator: "lt", upperPct: 70 },
        {
          band: "amber",
          formatted: "amber R140m-R200m",
          comparator: "between",
          lowerPct: 70,
          upperPct: 100,
        },
        { band: "red", formatted: "red ≥R200m", comparator: "gte", lowerPct: 100 },
      ],
    },
    measurementBinding:
      "UnifiedPositionProjection: sum(nominalMinor) where assetClass='bond' AND side='long' — as % of R200m cap",
    measurementOwner: "Rohan (eng) joint with Kai (eng) → Saskia (Head of Markets, governance)",
    citations: [
      D_RAS,
      "D-BOND-RAS-APPETITE",
      "D-NPA-SAGB-BOND-INTERNAL-TEST",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
    summary:
      "Gross long bond inventory (face value ZAR, trading book) capped at R200m. " +
      "Amber warning at R140m (70%); red at R200m. " +
      "Build-phase cap promotes BondSimEngine positionCapZarMinor hardcoded constant into structured governance register. " +
      "Position guard in BondSimEngine engages at amber (70%) and red (95%); CRO review within 1 business day on breach.",
  },
  {
    id: "appetite:irrbb:delta-eve-outlier",
    label: "IRRBB δEVE outlier threshold — BCBS d365 §A-3.4 supervisory test",
    rasSection: "RAS §B4",
    category: "irrbb",
    tier: "tier-1",
    thresholds: {
      kind: "ratio",
      printed: "green <10% Tier-1 / amber 10-15% Tier-1 / red ≥15% Tier-1",
      bands: [
        { band: "green", formatted: "green <10% Tier-1", comparator: "lt", upperPct: 10 },
        {
          band: "amber",
          formatted: "amber 10-15% Tier-1",
          comparator: "between",
          lowerPct: 10,
          upperPct: 15,
        },
        { band: "red", formatted: "red ≥15% Tier-1", comparator: "gte", lowerPct: 15 },
      ],
    },
    measurementBinding:
      "IRRBBChecked: max(abs(deltaEveMinor)) / tier1CapitalTargetMinor × 100 across all BCBS d365 shock scenarios",
    measurementOwner: "Rohan (eng) → Helena (CRO, governance)",
    citations: [D_RAS, "D-BOND-RAS-APPETITE", "BCBS-D365-IRRBB", "BANKS-REG-26"],
    summary:
      "Maximum |δEVE| under any BCBS d365 shock scenario as % of Tier-1 capital. " +
      "BCBS d365 §A-3.4 supervisory outlier threshold is 15% of Tier-1; early-warning amber at 10%. " +
      "Build-phase Tier-1 target R300m (licence-day capital plan). " +
      "Breach triggers ALCO escalation within 1 business day and PA notification pathway per BCBS d365 Principle 5; " +
      "escalate to CEO if breach persists >5 business days.",
  },
  // ── Intraday-liquidity appetite line — added 2026-06-11 per D-INTRADAY-RAS-APPETITE ──
  // Authority: D-INTRADAY-RAS-APPETITE (CRO-approved 2026-06-11), under
  //   D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11).
  // Calibration (Helena, Chief Risk Officer, governance):
  //   - Headline measure: `peakUsagePctOfAvailable` — BCBS 248 tool 1 (daily
  //     maximum intraday usage) over tool 2 (available at start of day), from
  //     `computeIntradayLiquidityMetrics` (platform/alm/intraday-liquidity-
  //     metrics.ts, PR #1206).
  //   - red ≥80% IS the LRM Policy v1 §4.5 intraday-stress definition ("peak
  //     intraday usage exceeds 80% of the intraday buffer") — the §4.5
  //     response protocol activates at red.
  //   - amber 60-80% is the CRO early-warning band ahead of the §4.5 trigger;
  //     coherent with the §4.3 buffer-sizing target (buffer = 120% of the
  //     99th-percentile peak ⇒ at-target peak usage ≈ 83% — amber lights well
  //     before the sizing target is consumed).
  //   - critical ≥100%: usage exceeds available start-of-day liquidity —
  //     reliance on uncovered correspondent intraday credit; breaches the
  //     §4.4 zero-net-intraday-credit objective (High-severity event per
  //     §9.2). Resolves to red in classifyUsageRatio, as critical bands do
  //     in classifyRatio.
  //   - floorZar R50m: the governed intraday HQLA floor — promotes the former
  //     `INTRADAY_FLOOR_ZAR` build-phase constant in
  //     `platform/alm/intraday-stress.ts` into this register (that module now
  //     reads it from here). Value unchanged at calibration (build-phase
  //     behaviour preserved); recalibrated via ILAAP once live flow history
  //     exists (§4.3 backward-looking 99th-percentile sizing).
  {
    id: "appetite:liquidity:intraday",
    label: "Intraday liquidity usage — BCBS 248 peak usage vs available",
    rasSection: "RAS §B3",
    category: "liquidity",
    tier: "tier-1",
    thresholds: {
      kind: "ratio",
      printed: "green <60% / amber 60-80% / red ≥80% / critical ≥100%",
      bands: [
        { band: "green", formatted: "green <60%", comparator: "lt", upperPct: 60 },
        {
          band: "amber",
          formatted: "amber 60-80%",
          comparator: "between",
          lowerPct: 60,
          upperPct: 80,
        },
        { band: "red", formatted: "red ≥80%", comparator: "gte", lowerPct: 80 },
        { band: "critical", formatted: "critical ≥100%", comparator: "gte", lowerPct: 100 },
      ],
    },
    floorZar: 50_000_000,
    measurementBinding: "computeIntradayLiquidityMetrics",
    measurementOwner: "Ravi (eng) → Eitan (Treasurer)",
    citations: [
      D_RAS,
      "D-INTRADAY-RAS-APPETITE",
      "D-TREASURER-WAVE1-SUBSTRATE",
      "BCBS-248",
      "BANKS-REG-26",
      "ORG-PR-08",
    ],
    summary:
      "Peak intraday liquidity usage (BCBS 248 tool 1) as % of available start-of-day liquidity (tool 2); " +
      "headline measure peakUsagePctOfAvailable from computeIntradayLiquidityMetrics. " +
      "Red at 80% is the LRM Policy v1 §4.5 intraday-stress trigger (30-min Eitan response; persistent stress " +
      "activates CFP Tier 1 and notifies Helena); amber at 60% is the CRO early-warning band; critical at 100% " +
      "means reliance on uncovered correspondent intraday credit (§4.4 zero-net-intraday-credit objective breached). " +
      "Governed intraday HQLA floor R50m (floorZar) — promotes the former intraday-stress.ts build-phase constant " +
      "into this register; ILAAP-recalibrated once live flow history exists.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable ordered list of every appetite-line id. */
export const RAS_APPETITE_LINE_IDS: readonly string[] = RAS_APPETITE_LINES.map((l) => l.id);

/** Look up an appetite line by id. */
export function getRasAppetiteLine(id: string): RasAppetiteLine | undefined {
  return RAS_APPETITE_LINES.find((l) => l.id === id);
}

/**
 * Look up an appetite line by id, throwing if it is not in the register.
 * Use this at call sites that depend on a stable known id (handler render,
 * recon line-identity reads) so a removed/renamed id fails loudly rather than
 * via a non-null assertion.
 */
export function requireRasAppetiteLine(id: string): RasAppetiteLine {
  const line = getRasAppetiteLine(id);
  if (line === undefined) {
    throw new Error(`Unknown RAS appetite-line id: ${id}`);
  }
  return line;
}
