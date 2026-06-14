// platform/regulatory/domain-ownership-map.ts
//
// Canonical Agent ⟺ Domain ⟺ Obligation ownership map (D-DOMAIN-OWNERSHIP-MAP).
//
// Single source of truth joining three axes:
//   obligation ──(classifyObligationDomain)──▶ sub-domain ──▶ accountable seat ──▶ roster agent
//
// The normalised domain taxonomy (v3, reviewed 2026-06-14) replaces the colliding,
// drifted letter codes: it is keyed off the stable obligation `id-prefix`
// (ORG-FC, BCBS-MAR, ORG-CY…) which — unlike the section letters — does not
// collide. Prudential (capital framework → CFO) and Risk (risk-measurement →
// CRO) are SEPARATE top-level domains; Treasury & Liquidity is its own domain;
// the SARB-PA supervisory directives (`ORG-PA-*`) are decomposed by topic into
// their real domains rather than parked in a sourcing bucket.
//
// This OVERRIDES the partial `basel-family-seat.ts` map (capital/credit families
// and LCR/NSF), which is reconciled to agree with the seats here.
//
// Pure module (no IO) so unit tests assert the classifier, the taxonomy
// completeness, and the resolvers directly. Seat strings use the obligation
// `owner` vocabulary (cfo | cro | cco | coo | ciso | cae | treasurer |
// company-secretary | information-officer | head-of-global-markets).
//
// Authority: D-DOMAIN-OWNERSHIP-MAP (CEO-approved 2026-06-14).
// Author: Atlas (Core banking platform architect, engineering).

/** Governance seat strings = the obligation `owner` vocabulary (1:1 with a roster agent). */
export type Seat =
  | "cfo"
  | "cro"
  | "cco"
  | "coo"
  | "ciso"
  | "cae"
  | "treasurer"
  | "company-secretary"
  | "information-officer"
  | "head-of-global-markets";

export const GOVERNANCE_SEATS: ReadonlySet<Seat> = new Set<Seat>([
  "cfo",
  "cro",
  "cco",
  "coo",
  "ciso",
  "cae",
  "treasurer",
  "company-secretary",
  "information-officer",
  "head-of-global-markets",
]);

/** Seat → named roster agent (Team/_team-roster.json is the source of truth). */
export const SEAT_AGENT: Readonly<Record<Seat, { name: string; position: string }>> = {
  cfo: { name: "Camille", position: "Chief Financial Officer" },
  cro: { name: "Helena", position: "Chief Risk Officer" },
  cco: { name: "Zara", position: "Chief Compliance Officer" },
  coo: { name: "Devon", position: "Chief Operating Officer" },
  ciso: { name: "Rashida", position: "Chief Information Security Officer" },
  cae: { name: "Thandiwe", position: "Chief Audit Executive" },
  treasurer: { name: "Eitan", position: "Treasurer" },
  "company-secretary": { name: "Owen", position: "Company Secretary" },
  "information-officer": { name: "Iris", position: "Information Officer" },
  "head-of-global-markets": { name: "Saskia", position: "Head of Global Markets" },
};

export interface SubDomain {
  /** Stable kebab-case sub-domain key, e.g. "capital-adequacy". */
  readonly key: string;
  /** Top-level domain number (1–10). */
  readonly topLevel: number;
  /** Top-level domain label. */
  readonly topLevelLabel: string;
  /** Sub-domain human label. */
  readonly label: string;
  /** The single accountable governance seat. */
  readonly accountableSeat: Seat;
  /** Optional co-accountable seats (e.g. ICAAP co-owned CRO+CFO). */
  readonly coAccountableSeats?: readonly Seat[];
}

/**
 * The v3 normalised taxonomy — 10 top-level domains, 26 sub-domains, one
 * accountable seat each. Order is the canonical display order.
 */
export const DOMAIN_OWNERSHIP: readonly SubDomain[] = [
  // 1 · PRUDENTIAL (CAPITAL) → cfo
  {
    key: "capital-adequacy",
    topLevel: 1,
    topLevelLabel: "Prudential (Capital)",
    label: "Capital Adequacy & Ratios",
    accountableSeat: "cfo",
  },
  {
    key: "leverage-ratio",
    topLevel: 1,
    topLevelLabel: "Prudential (Capital)",
    label: "Leverage Ratio",
    accountableSeat: "cfo",
  },
  // 2 · TREASURY & LIQUIDITY → treasurer
  {
    key: "liquidity-funding",
    topLevel: 2,
    topLevelLabel: "Treasury & Liquidity",
    label: "Liquidity & Funding",
    accountableSeat: "treasurer",
  },
  {
    key: "exchange-control",
    topLevel: 2,
    topLevelLabel: "Treasury & Liquidity",
    label: "Exchange Control (FinSurv)",
    accountableSeat: "treasurer",
  },
  // 3 · RISK → cro
  {
    key: "credit-risk",
    topLevel: 3,
    topLevelLabel: "Risk",
    label: "Credit & Counterparty Risk",
    accountableSeat: "cro",
  },
  {
    key: "market-risk",
    topLevel: 3,
    topLevelLabel: "Risk",
    label: "Market Risk",
    accountableSeat: "cro",
  },
  {
    key: "operational-risk",
    topLevel: 3,
    topLevelLabel: "Risk",
    label: "Operational Risk",
    accountableSeat: "cro",
  },
  {
    key: "large-exposures",
    topLevel: 3,
    topLevelLabel: "Risk",
    label: "Large Exposures / Concentration",
    accountableSeat: "cro",
  },
  {
    key: "icaap-ilaap",
    topLevel: 3,
    topLevelLabel: "Risk",
    label: "ICAAP / ILAAP",
    accountableSeat: "cro",
    coAccountableSeats: ["cfo"],
  },
  // 4 · FINANCIAL CRIME → cco
  {
    key: "aml-cft",
    topLevel: 4,
    topLevelLabel: "Financial Crime",
    label: "AML / CFT / Sanctions",
    accountableSeat: "cco",
  },
  // 5 · FINANCIAL REPORTING & TAX → cfo
  {
    key: "accounting",
    topLevel: 5,
    topLevelLabel: "Financial Reporting & Tax",
    label: "Accounting & Financial Reporting",
    accountableSeat: "cfo",
  },
  {
    key: "regulatory-returns",
    topLevel: 5,
    topLevelLabel: "Financial Reporting & Tax",
    label: "Regulatory Returns",
    accountableSeat: "cfo",
  },
  {
    key: "tax",
    topLevel: 5,
    topLevelLabel: "Financial Reporting & Tax",
    label: "Tax",
    accountableSeat: "cfo",
  },
  // 6 · GOVERNANCE & CORPORATE → company-secretary (6.4 → cae)
  {
    key: "governance-board",
    topLevel: 6,
    topLevelLabel: "Governance & Corporate",
    label: "Corporate Governance & Board",
    accountableSeat: "company-secretary",
  },
  {
    key: "fit-proper",
    topLevel: 6,
    topLevelLabel: "Governance & Corporate",
    label: "Fit & Proper",
    accountableSeat: "company-secretary",
  },
  {
    key: "group-structure",
    topLevel: 6,
    topLevelLabel: "Governance & Corporate",
    label: "Group Structure & Consolidation",
    accountableSeat: "company-secretary",
  },
  {
    key: "external-audit",
    topLevel: 6,
    topLevelLabel: "Governance & Corporate",
    label: "External Audit",
    accountableSeat: "cae",
  },
  {
    key: "ethics-whistleblowing",
    topLevel: 6,
    topLevelLabel: "Governance & Corporate",
    label: "Ethics & Whistleblowing",
    accountableSeat: "company-secretary",
  },
  // 7 · CYBER & INFORMATION SECURITY → ciso
  {
    key: "cyber-infosec",
    topLevel: 7,
    topLevelLabel: "Cyber & Information Security",
    label: "Cyber & Information Security",
    accountableSeat: "ciso",
  },
  // 8 · CONDUCT & MARKET INTEGRITY → cco (8.3 → head-of-global-markets)
  {
    key: "conduct-fais",
    topLevel: 8,
    topLevelLabel: "Conduct & Market Integrity",
    label: "Conduct / FAIS / TCF",
    accountableSeat: "cco",
  },
  {
    key: "odp",
    topLevel: 8,
    topLevelLabel: "Conduct & Market Integrity",
    label: "OTC Derivative Provider",
    accountableSeat: "cco",
  },
  {
    key: "markets-trading",
    topLevel: 8,
    topLevelLabel: "Conduct & Market Integrity",
    label: "Markets & Trading",
    accountableSeat: "head-of-global-markets",
  },
  // 9 · DATA, PRIVACY & RECORDS → information-officer (9.2/9.3 → company-secretary)
  {
    key: "privacy",
    topLevel: 9,
    topLevelLabel: "Data, Privacy & Records",
    label: "Privacy & Data Protection",
    accountableSeat: "information-officer",
  },
  {
    key: "records-rdarr",
    topLevel: 9,
    topLevelLabel: "Data, Privacy & Records",
    label: "Records Management & RDARR",
    accountableSeat: "company-secretary",
  },
  {
    key: "ecta",
    topLevel: 9,
    topLevelLabel: "Data, Privacy & Records",
    label: "Electronic Transactions (ECTA)",
    accountableSeat: "company-secretary",
  },
  // 10 · PEOPLE (LABOUR & HR) → coo
  {
    key: "labour-hr",
    topLevel: 10,
    topLevelLabel: "People (Labour & HR)",
    label: "Employment & HR",
    accountableSeat: "coo",
  },
];

const BY_KEY: ReadonlyMap<string, SubDomain> = new Map(DOMAIN_OWNERSHIP.map((d) => [d.key, d]));

/** Minimal obligation shape the classifier needs — all event-store-available fields. */
export interface ClassifiableObligation {
  readonly id: string;
  readonly citation?: string;
  readonly requirement?: string;
}

/** Extract the stable id-prefix, e.g. "ORG-FC-02" → "ORG-FC", "BCBS-CRE20" →
 * "BCBS-CRE". The bracketed `ORG-PR(IV)` privacy family is captured whole — it
 * is the POPIA/PAIA convention nested under the `PR(...)` scheme, NOT prudential
 * (a bare `ORG-PR` regex would mis-truncate it to the prudential umbrella). */
export function obligationPrefix(id: string): string {
  const m = id.match(/^(ORG-PR\(IV\)|ORG-[A-Z]+|BCBS-[A-Z]+)/);
  return m?.[1] ?? id;
}

/**
 * Topic classifier for umbrella prefixes (ORG-PR, ORG-PA) whose id-prefix is a
 * SOURCE not a topic — routes by requirement + citation keywords into a
 * sub-domain key. Order matters (specific before general); the final fallback is
 * capital-adequacy (the prudential default for an unrefined PA/PR directive).
 */
function topicByText(o: ClassifiableObligation): string {
  const t = `${o.requirement ?? ""} ${o.citation ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  if (has(/leverage/)) return "leverage-ratio";
  if (has(/liquid|\blcr\b|\bnsfr\b|funding|hqla|net stable|net open foreign|\bcodi\b/))
    return "liquidity-funding";
  if (has(/large exposure/)) return "large-exposures";
  if (has(/cyber|information security|cloud comput|\bit incident/)) return "cyber-infosec";
  if (
    has(
      /operational resilience|sound management of operational|outsourc|third-party depend|business continu|recovery plan/,
    )
  )
    return "operational-risk";
  if (has(/\baml\b|money laundering|terror|money or value transfer/)) return "aml-cft";
  if (
    has(
      /credit risk|counterparty|\becl\b|provision|sa-ccr|\bdefault\b|restructured|\becai\b|securitis|\birb\b|specialised lending/,
    )
  )
    return "credit-risk";
  if (has(/market risk|trading book|value-at-risk|\bvar\b|prudent valuation/)) return "market-risk";
  if (has(/\breturn\b|\bba ?\d|report|submission|disclos|pillar 3/)) return "regulatory-returns";
  if (has(/governance|board|committee|director/)) return "governance-board";
  if (has(/\baudit\b/)) return "external-audit";
  return "capital-adequacy";
}

/** Direct id-prefix → sub-domain key map (non-umbrella prefixes). */
const PREFIX_TO_KEY: Readonly<Record<string, string>> = {
  "ORG-BNK": "icaap-ilaap",
  "BCBS-CRE": "credit-risk",
  "BCBS-MAR": "market-risk",
  "ORG-OR": "operational-risk",
  "BCBS-LEX": "large-exposures",
  "ORG-LR": "large-exposures", // residual finding: leverage-vs-large-exp pending citation check
  "BCBS-LEV": "leverage-ratio",
  "BCBS-LCR": "liquidity-funding",
  "BCBS-NSF": "liquidity-funding",
  "BCBS-DIS": "regulatory-returns",
  // Basel families not yet present as obligations, mapped for emit-time owner
  // stamping (basel-family-seat.ts delegates here — the single source of truth).
  "BCBS-RBC": "capital-adequacy",
  "BCBS-CAP": "capital-adequacy",
  "BCBS-OPE": "operational-risk",
  "BCBS-BCP": "governance-board",
  "BCBS-SCO": "governance-board",
  "ORG-FC": "aml-cft",
  "ORG-CY": "cyber-infosec",
  "ORG-JS": "cyber-infosec",
  "ORG-CD": "conduct-fais",
  "ORG-FAIS": "conduct-fais",
  "ORG-ODP": "odp",
  "ORG-CS": "odp",
  "ORG-JN": "odp",
  "ORG-MK": "markets-trading",
  "ORG-FMA": "markets-trading",
  "ORG-JSE": "markets-trading",
  "ORG-AC": "accounting",
  "ORG-TX": "tax",
  "ORG-GV": "governance-board",
  "ORG-GOV": "governance-board",
  "ORG-CMP": "governance-board",
  "ORG-FIT": "fit-proper",
  "ORG-GRP": "group-structure",
  "ORG-EA": "external-audit",
  "ORG-WB": "ethics-whistleblowing",
  "ORG-RM": "records-rdarr",
  "ORG-PR(IV)": "privacy", // POPIA / PAIA privacy family (nested PR(...) scheme)
  "ORG-EL": "ecta",
  "ORG-FX": "exchange-control",
  "ORG-EXCON": "exchange-control",
  "ORG-HR": "labour-hr",
};

/** ORG-PR section-derived sub-codes refine into the right sub-domain; else by text. */
function classifyOrgPr(o: ClassifiableObligation): string {
  return topicByText(o);
}

/**
 * Classify an obligation to its normalised sub-domain key. Deterministic, pure.
 * Returns `null` only for an id whose prefix is genuinely unknown (a finding).
 *
 *   - Umbrella prefixes (ORG-PR, ORG-PA): routed by requirement/citation topic.
 *   - All other prefixes: direct id-prefix map.
 */
export function classifyObligationDomain(o: ClassifiableObligation): string | null {
  const prefix = obligationPrefix(o.id);
  if (prefix === "ORG-PA") return topicByText(o);
  if (prefix === "ORG-PR") return classifyOrgPr(o);
  return PREFIX_TO_KEY[prefix] ?? null;
}

/** The sub-domain record for an obligation (null when unclassifiable). */
export function ownershipForObligation(o: ClassifiableObligation): SubDomain | null {
  const key = classifyObligationDomain(o);
  return key ? (BY_KEY.get(key) ?? null) : null;
}

/** The accountable seat for an obligation (null when unclassifiable). */
export function seatForObligation(o: ClassifiableObligation): Seat | null {
  return ownershipForObligation(o)?.accountableSeat ?? null;
}

/** Sub-domain by key. */
export function subDomain(key: string): SubDomain | undefined {
  return BY_KEY.get(key);
}

/** All sub-domain keys owned (or co-owned) by a seat. */
export function domainsForSeat(seat: Seat): SubDomain[] {
  return DOMAIN_OWNERSHIP.filter(
    (d) => d.accountableSeat === seat || (d.coAccountableSeats?.includes(seat) ?? false),
  );
}

/** Distinct top-level domains in canonical order: { topLevel, label, seats }. */
export function topLevelDomains(): Array<{ topLevel: number; label: string; seats: Seat[] }> {
  const byTop = new Map<number, { topLevel: number; label: string; seats: Set<Seat> }>();
  for (const d of DOMAIN_OWNERSHIP) {
    const e =
      byTop.get(d.topLevel) ??
      (() => {
        const v = { topLevel: d.topLevel, label: d.topLevelLabel, seats: new Set<Seat>() };
        byTop.set(d.topLevel, v);
        return v;
      })();
    e.seats.add(d.accountableSeat);
  }
  return [...byTop.values()]
    .sort((a, b) => a.topLevel - b.topLevel)
    .map((e) => ({ topLevel: e.topLevel, label: e.label, seats: [...e.seats] }));
}
