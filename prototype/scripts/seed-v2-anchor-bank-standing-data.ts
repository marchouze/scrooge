// scripts/seed-v2-anchor-bank-standing-data.ts
//
// V2 S4 — one-shot seed that emits the anchor bank's product catalogue,
// chart of accounts, and RAS thresholds as typed v2 events into a SEPARATE
// v2 anchor store (`BANK_V2_ANCHOR_DB` env → default
// `$HOME/.local/share/bank/v2-anchor.db`).
//
// CRITICAL: this script NEVER writes to the v1 canonical store (`BANK_EVENT_DB`
// / `.local/event.db`). It opens an independent SQLite file for the v2 anchor
// standing data.
//
// Products seeded (9 active products from v1 NPA register):
//   prd:bank:equity:jse-equity-cash     — JSE Listed Equity (cash)
//   prd:bank:bond:sagb-fixed-coupon     — SAGB Fixed-Coupon Bond
//   prd:bank:fx:fx-spot-zar-usd         — FX Spot ZAR/USD (superseded — deprecated)
//   prd:bank:fx:otc-vanilla             — FX OTC Vanilla (spot/forward)
//   prd:bank:otc-ird:vanilla-irs-zar    — Vanilla IRS ZAR
//   prd:bank:treasury:repo-sagb-term    — Term Repo (SAGB collateral)
//   prd:bank:treasury:mmd-deposit       — Money-Market Deposit
//   prd:bank:treasury:funding-line      — Funding Line
//   prd:bank:treasury:ibl-placement     — Interbank Loan Placement
//
// CoA account types seeded (key structural groups):
//   Capital / equity, nostro/settlement, FX trading, bond, IRS, repo,
//   deposit, IBL, memo NOP. 18 canonical account types extracted from
//   platform/accounting/chart-of-accounts.json.
//
// RAS appetite lines seeded: all 17 lines from
//   platform/risk/ras-appetite-register.ts (byte-faithful snapshot).
//
// Idempotent: skips events whose natural key is already present.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
// brief: brief:bea:v2-s4-products-coa-ras-as-typed-v2-events-anchor:2026-06-12
// Author: Bea (Financial Controller, accounting).

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { Database } from "bun:sqlite";

import type {
  V2AccountTypeRegistered,
  V2ProductDeprecated,
  V2ProductRegistered,
  V2RiskAppetiteSet,
} from "../v2-core/banking/events";
import { RAS_APPETITE_LINES } from "../platform/risk/ras-appetite-register";

// ---------------------------------------------------------------------------
// Resolve the v2 anchor store path — NEVER the v1 store
// ---------------------------------------------------------------------------

function resolveV2AnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

const DB_PATH = resolveV2AnchorDb();

// Ensure parent directory exists
const parentDir = dirname(DB_PATH);
if (!existsSync(parentDir)) {
  mkdirSync(parentDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Simple schema — same DDL as the v1 store so replays work the same way.
db.exec(`
CREATE TABLE IF NOT EXISTS v2_events (
  sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT    UNIQUE NOT NULL,
  type        TEXT    NOT NULL,
  as_of       TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  actor_type  TEXT    NOT NULL,
  actor_id    TEXT    NOT NULL,
  citations   TEXT    NOT NULL,
  payload     TEXT    NOT NULL,
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_v2_type   ON v2_events(type);
CREATE INDEX IF NOT EXISTS idx_v2_entity ON v2_events(entity);
CREATE INDEX IF NOT EXISTS idx_v2_as_of  ON v2_events(as_of);
`);

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

const AS_OF = "2026-06-12T00:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service", id: "agent:bea:seed-v2-anchor-bank-standing-data" };

const CITATIONS = [
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "D-MODEL-BINDING-CONTRACT-V1",
  "P1-EVENTS-AS-TRUTH",
];

function alreadySeeded(type: string, naturalKey: string): boolean {
  const row = db
    .query<{ payload: string }, [string]>(
      `SELECT payload FROM v2_events WHERE type = ? LIMIT 100`,
    )
    .all(type);
  for (const r of row) {
    try {
      const p = JSON.parse(r.payload) as Record<string, unknown>;
      // For products: naturalKey is productId
      // For CoA: naturalKey is accountTypeKey
      // For RAS: naturalKey is rasLineId
      if (
        p.productId === naturalKey ||
        p.accountTypeKey === naturalKey ||
        p.rasLineId === naturalKey
      ) {
        return true;
      }
    } catch {
      // ignore parse errors
    }
  }
  return false;
}

function append(type: string, payload: Record<string, unknown>): void {
  const eventId = randomUUID();
  db
    .query(
      `INSERT OR IGNORE INTO v2_events
       (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      eventId,
      type,
      AS_OF,
      ENTITY,
      ACTOR.type,
      ACTOR.id,
      JSON.stringify(CITATIONS),
      JSON.stringify(payload),
    );
}

// ---------------------------------------------------------------------------
// Section 1 — Products
// ---------------------------------------------------------------------------

const PRODUCTS: V2ProductRegistered[] = [
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:equity:jse-equity-cash",
    name: "JSE Listed Equity (cash)",
    ifrs9Family: "equity",
    filTypeScopes: ["fil:type:equity:*"],
    v1ProductId: "prd:bank:equity:jse-equity-cash",
    currencies: ["ZAR"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "institutional",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:bond:sagb-fixed-coupon",
    name: "SAGB Fixed-Coupon Bond",
    ifrs9Family: "bond",
    filTypeScopes: ["fil:type:ir:bond.govt:*"],
    v1ProductId: "prd:bank:bond:sagb-fixed-coupon",
    currencies: ["ZAR"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "treasury-own-book",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-NPA-SAGB-BOND-INTERNAL-TEST",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:fx:otc-vanilla",
    name: "FX OTC Vanilla (spot + forward)",
    ifrs9Family: "fx-spot",
    filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
    v1ProductId: "prd:bank:fx:otc-vanilla",
    currencies: ["ZAR", "USD", "EUR", "GBP", "JPY", "CHF", "AUD"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "institutional",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:otc-ird:vanilla-irs-zar",
    name: "Vanilla Interest Rate Swap — ZAR",
    ifrs9Family: "ird-swap",
    filTypeScopes: ["fil:type:ir:swap.vanilla:*"],
    v1ProductId: "prd:bank:otc-ird:vanilla-irs-zar",
    currencies: ["ZAR"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "institutional",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-IRS-FAMILY-CONVERGE-ACCOUNTING",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:treasury:repo-sagb-term",
    name: "Term Repo — SAGB Collateral",
    ifrs9Family: "repo",
    filTypeScopes: ["fil:type:funding:repo:*"],
    v1ProductId: "prd:bank:treasury:repo-sagb-term",
    currencies: ["ZAR"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "treasury-own-book",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:treasury:mmd-deposit",
    name: "Money-Market Deposit",
    ifrs9Family: "money-market",
    filTypeScopes: ["fil:type:funding:deposit.money-market:*"],
    v1ProductId: "prd:bank:treasury:mmd-deposit",
    currencies: ["ZAR"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "treasury-own-book",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:treasury:funding-line",
    name: "Funding Line",
    ifrs9Family: "money-market",
    filTypeScopes: ["fil:type:funding:deposit.money-market:*"],
    v1ProductId: "prd:bank:treasury:funding-line",
    currencies: ["ZAR"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "treasury-own-book",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
  {
    kind: "V2ProductRegistered",
    productId: "v2:prd:bank:treasury:ibl-placement",
    name: "Interbank Loan Placement",
    ifrs9Family: "interbank-loan",
    filTypeScopes: ["fil:type:funding:deposit.money-market:*"],
    v1ProductId: "prd:bank:treasury:ibl-placement",
    currencies: ["ZAR"],
    legalEntityIds: ["LE-ZA-HOZ-BANK"],
    jurisdictions: ["ZA"],
    franchiseScope: "treasury-own-book",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-MARKETS-SCHEMA-FOUNDATION",
    ],
  },
];

// Deprecated product: fx-spot-zar-usd was superseded by otc-vanilla
const DEPRECATED_PRODUCTS: V2ProductDeprecated[] = [
  {
    kind: "V2ProductDeprecated",
    productId: "v2:prd:bank:fx:fx-spot-zar-usd",
    reason: "superseded",
    supersededBy: "v2:prd:bank:fx:otc-vanilla",
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
    ],
  },
];

console.log("\n=== V2 S4 Anchor-Bank Standing-Data Seed ===");
console.log(`Store: ${DB_PATH}\n`);

// Register the deprecated product first (it's also a product)
const FX_SPOT_ZAR_USD_DEPRECATED: V2ProductRegistered = {
  kind: "V2ProductRegistered",
  productId: "v2:prd:bank:fx:fx-spot-zar-usd",
  name: "FX Spot ZAR/USD (superseded)",
  ifrs9Family: "fx-spot",
  filTypeScopes: ["fil:type:fx:spot:*"],
  v1ProductId: "prd:bank:fx:fx-spot-zar-usd",
  currencies: ["ZAR", "USD"],
  legalEntityIds: ["LE-ZA-HOZ-BANK"],
  jurisdictions: ["ZA"],
  franchiseScope: "institutional",
  citations: [
    "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    "D-FX-OTC-NPA-SCOPE-EXPANSION",
  ],
};

let productsSeeded = 0;
let productsSkipped = 0;

// Seed all products (including the one to be deprecated)
const allProducts = [...PRODUCTS, FX_SPOT_ZAR_USD_DEPRECATED];

for (const p of allProducts) {
  if (alreadySeeded("V2ProductRegistered", p.productId)) {
    console.log(`  [SKIP] V2ProductRegistered ${p.productId}`);
    productsSkipped++;
    continue;
  }
  append("V2ProductRegistered", p as unknown as Record<string, unknown>);
  console.log(`  [OK]   V2ProductRegistered ${p.productId}`);
  productsSeeded++;
}

// Seed deprecations
let deprecationsSeeded = 0;
for (const d of DEPRECATED_PRODUCTS) {
  // Check by both productId and kind=V2ProductDeprecated
  const existing = db
    .query<{ payload: string }, [string, string]>(
      `SELECT payload FROM v2_events WHERE type = ? AND payload LIKE ? LIMIT 1`,
    )
    .all("V2ProductDeprecated", `%"${d.productId}"%`);
  if (existing.length > 0) {
    console.log(`  [SKIP] V2ProductDeprecated ${d.productId}`);
    continue;
  }
  append("V2ProductDeprecated", d as unknown as Record<string, unknown>);
  console.log(`  [OK]   V2ProductDeprecated ${d.productId}`);
  deprecationsSeeded++;
}

console.log(
  `\nProducts: ${productsSeeded} seeded, ${deprecationsSeeded} deprecated, ${productsSkipped} skipped.`,
);

// ---------------------------------------------------------------------------
// Section 2 — Chart of Accounts (18 canonical account types)
// ---------------------------------------------------------------------------

const COA_TYPES: V2AccountTypeRegistered[] = [
  // Capital / equity
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "cet1-share-capital",
    name: "Share Capital (CET1)",
    category: "equity",
    normalSide: "credit",
    currency: "ZAR",
    v1AccountIds: ["ACC-5000-001"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-MARKETS-CAPITAL-TIME-SHAPE"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "retained-earnings",
    name: "Retained Earnings",
    category: "equity",
    normalSide: "credit",
    currency: "ZAR",
    v1AccountIds: ["ACC-5000-002"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-MARKETS-CAPITAL-TIME-SHAPE"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "tier-2-subordinated-debt",
    name: "Subordinated Debt — Tier 2 (≥5yr remaining maturity)",
    category: "liability-t2-capital",
    normalSide: "credit",
    currency: "ZAR",
    v1AccountIds: ["ACC-5200-001"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-MARKETS-CAPITAL-TIME-SHAPE"],
  },
  // Nostro / settlement
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "central-bank-reserve",
    name: "Central Bank Reserve Account",
    category: "asset",
    normalSide: "debit",
    currency: "ZAR",
    v1AccountIds: ["ACC-1100-001"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-TREASURY-GAPS-WAVE1"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "nostro",
    name: "Nostro Account",
    category: "asset",
    normalSide: "debit",
    // Multi-currency — no `currency` field; instances carry designatedCurrency
    v1AccountIds: [
      "ACC-1100-002",
      "ACC-1100-003",
      "ACC-1200-001",
      "ACC-1200-002",
      "ACC-1200-003",
      "ACC-1200-004",
      "ACC-1200-005",
      "ACC-1200-006",
      "ACC-1200-007",
    ],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-TREASURY-GAPS-WAVE1"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "fx-settlement-suspense",
    name: "FX Settlement Suspense",
    category: "asset",
    normalSide: "debit",
    v1AccountIds: ["ACC-1100-004", "ACC-1100-005"],
    filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-FX-OTC-NPA-SCOPE-EXPANSION"],
  },
  // FX trading
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "fx-trading-receivable",
    name: "FX Trading Receivable",
    category: "asset",
    normalSide: "debit",
    v1AccountIds: [
      "ACC-2100-001",
      "ACC-2100-002",
      "ACC-2100-010",
      "ACC-2100-013",
      "ACC-2100-016",
      "ACC-2100-019",
      "ACC-2100-022",
    ],
    filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-FX-OTC-NPA-SCOPE-EXPANSION"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "fx-trading-payable",
    name: "FX Trading Payable",
    category: "liability",
    normalSide: "credit",
    v1AccountIds: [
      "ACC-2100-003",
      "ACC-2100-004",
      "ACC-2100-011",
      "ACC-2100-014",
      "ACC-2100-017",
      "ACC-2100-020",
      "ACC-2100-023",
    ],
    filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-FX-OTC-NPA-SCOPE-EXPANSION"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "unrealised-fx-pnl-fvtpl",
    name: "Unrealised FX P&L — FVTPL",
    category: "income",
    normalSide: "credit",
    v1AccountIds: [
      "ACC-2100-005",
      "ACC-2100-012",
      "ACC-2100-015",
      "ACC-2100-018",
      "ACC-2100-021",
      "ACC-2100-024",
    ],
    filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-FX-OTC-NPA-SCOPE-EXPANSION"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "realised-fx-pnl",
    name: "Realised FX P&L",
    category: "income",
    normalSide: "credit",
    currency: "ZAR",
    v1AccountIds: ["ACC-2100-006"],
    filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-FX-OTC-NPA-SCOPE-EXPANSION"],
  },
  // Bond
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "bond-asset-fvtpl",
    name: "Bond Asset — Trading Book (FVTPL)",
    category: "asset",
    normalSide: "debit",
    currency: "ZAR",
    v1AccountIds: ["ACC-3100-002"],
    filTypeScopes: ["fil:type:ir:bond.govt:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-NPA-SAGB-BOND-INTERNAL-TEST"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "bond-asset-amortised-cost",
    name: "Bond Asset — Banking Book (Amortised Cost)",
    category: "asset",
    normalSide: "debit",
    currency: "ZAR",
    v1AccountIds: ["ACC-3100-001"],
    filTypeScopes: ["fil:type:ir:bond.govt:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-NPA-SAGB-BOND-INTERNAL-TEST"],
  },
  // IRS swap
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "swap-asset-fvtpl",
    name: "Swap Asset — FVTPL (Positive NPV)",
    category: "asset",
    normalSide: "debit",
    currency: "ZAR",
    v1AccountIds: ["ACC-3300-001"],
    filTypeScopes: ["fil:type:ir:swap.vanilla:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-IRS-FAMILY-CONVERGE-ACCOUNTING"],
  },
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "swap-liability-fvtpl",
    name: "Swap Liability — FVTPL (Negative NPV)",
    category: "liability",
    normalSide: "credit",
    currency: "ZAR",
    v1AccountIds: ["ACC-3300-002"],
    filTypeScopes: ["fil:type:ir:swap.vanilla:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-IRS-FAMILY-CONVERGE-ACCOUNTING"],
  },
  // Repo
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "repo-asset",
    name: "Repo Asset (Secured Lending Receivable)",
    category: "asset",
    normalSide: "debit",
    currency: "ZAR",
    v1AccountIds: ["ACC-5100-001"],
    filTypeScopes: ["fil:type:funding:repo:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-TREASURY-GAPS-WAVE1"],
  },
  // Deposit liabilities
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "deposit-liability",
    name: "Deposit Liability",
    category: "liability",
    normalSide: "credit",
    currency: "ZAR",
    v1AccountIds: [
      "ACC-6100-001",
      "ACC-6100-002",
      "ACC-6100-003",
      "ACC-6100-004",
    ],
    filTypeScopes: ["fil:type:funding:deposit.money-market:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-TREASURY-GAPS-WAVE1"],
  },
  // IBL
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "ibl-due-from-banks",
    name: "Due from Banks — Interbank Loan Placements",
    category: "asset",
    normalSide: "debit",
    currency: "ZAR",
    v1AccountIds: ["ACC-7100-001", "ACC-7100-002"],
    filTypeScopes: ["fil:type:funding:deposit.money-market:*"],
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-TREASURY-GAPS-WAVE1"],
  },
  // Memo — NOP
  {
    kind: "V2AccountTypeRegistered",
    accountTypeKey: "nop-memorandum",
    name: "Net Open Position Memorandum",
    category: "memorandum",
    normalSide: "debit",
    v1AccountIds: ["ACC-9000-001", "ACC-9000-002"],
    filTypeScopes: ["fil:type:fx:*"],
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
    ],
  },
];

let coaSeeded = 0;
let coaSkipped = 0;

for (const coa of COA_TYPES) {
  if (alreadySeeded("V2AccountTypeRegistered", coa.accountTypeKey)) {
    console.log(`  [SKIP] V2AccountTypeRegistered ${coa.accountTypeKey}`);
    coaSkipped++;
    continue;
  }
  append("V2AccountTypeRegistered", coa as unknown as Record<string, unknown>);
  console.log(`  [OK]   V2AccountTypeRegistered ${coa.accountTypeKey}`);
  coaSeeded++;
}

console.log(`\nCoA account types: ${coaSeeded} seeded, ${coaSkipped} skipped.`);

// ---------------------------------------------------------------------------
// Section 3 — RAS appetite lines (all 17, verbatim from v1 register)
// ---------------------------------------------------------------------------

let rasSeeded = 0;
let rasSkipped = 0;

for (const line of RAS_APPETITE_LINES) {
  if (alreadySeeded("V2RiskAppetiteSet", line.id)) {
    console.log(`  [SKIP] V2RiskAppetiteSet ${line.id}`);
    rasSkipped++;
    continue;
  }

  // Convert v1 threshold shape to v2 (verbatim snapshot — no re-derivation)
  const thresholds: V2RiskAppetiteSet["thresholds"] =
    line.thresholds.kind === "ratio"
      ? { kind: "ratio", printed: line.thresholds.printed }
      : { kind: "posture", printed: line.thresholds.printed };

  const event: V2RiskAppetiteSet = {
    kind: "V2RiskAppetiteSet",
    rasLineId: line.id,
    label: line.label,
    rasSection: line.rasSection,
    category: line.category,
    tier: line.tier,
    thresholds,
    appliesToScope: { note: "bank-wide" },
    floorZarMinor: line.floorZar !== undefined ? line.floorZar * 100 : undefined,
    citations: [
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-RAS",
      "D-RAS-STRUCTURED-REGISTER",
      ...line.citations.filter((c) => c !== "D-RAS"),
    ],
  };

  append("V2RiskAppetiteSet", event as unknown as Record<string, unknown>);
  console.log(`  [OK]   V2RiskAppetiteSet ${line.id}`);
  rasSeeded++;
}

console.log(`\nRAS lines: ${rasSeeded} seeded, ${rasSkipped} skipped.`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const totalEvents = db
  .query<{ count: number }, []>("SELECT COUNT(*) as count FROM v2_events")
  .get()!.count;

console.log(`\n=== Seed complete ===`);
console.log(`  Products:    ${productsSeeded + deprecationsSeeded} events (${PRODUCTS.length + 1} products + 1 deprecation)`);
console.log(`  CoA types:   ${coaSeeded} events (${COA_TYPES.length} account types)`);
console.log(`  RAS lines:   ${rasSeeded} events (${RAS_APPETITE_LINES.length} appetite lines)`);
console.log(`  Store total: ${totalEvents} v2 events`);
console.log(`  DB path:     ${DB_PATH}`);

db.close();
