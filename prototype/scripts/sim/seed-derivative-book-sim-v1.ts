// scripts/sim/seed-derivative-book-sim-v1.ts
//
// SIMULATOR-FIRST DERIVATIVE BOOK — Phase 2b (D-BA-RETURN-SIMULATOR-FIRST).
//
// Seeds a small, clearly-SYNTHETIC derivative book that completes the BA 350
// (Derivatives Instruments) inventory grid: every instrument type (futures,
// forwards/FRAs, swaps, options written + purchased), underlying asset class
// (interest-rate, FX, equity, commodity, credit), ETD vs OTC venue, trading vs
// banking book, and maturity band (<1y / 1-5y / >5y). It drives the BA 350
// notional + fair-value fold (`platform/reporting/ba-350-derivatives-fold.ts`)
// to realistic, oracle-validated, NON-ZERO outputs — and the OTC positions carry
// counterparties so the existing CVA engine reuses the SAME book.
//
// WHAT IT EMITS (all `provenance: simulated`, scenario "derivative-book-sim-v1"):
//   - ETD: IR futures (bought/sold), equity index futures, commodity options.
//   - OTC: IR swaps + FRAs, FX forwards, equity options (written/purchased),
//     credit-default swaps. OTC positions carry a counterparty (for CVA reuse).
// across both the TRADING and the BANKING book (BA 350 reports both, UNLIKE
// BA 320 which is trading-book-only).
//
// PROVENANCE BOUNDARY (CRITICAL — the R300m-into-Prod lesson):
//   Every event carries `simulatedTag(...)`. The PRODUCTION BA 350 read uses
//   `defaultProvenanceFilter()` (production-only), which EXCLUDES every event
//   here — so the production-only BA 350 inventory stays ZERO pre-licence-day.
//   The simulated book appears only under a simulated-inclusive read. Both legs
//   are proven by `recon:ba350-derivatives-sim-drive` + the golden-case test.
//
// IDEMPOTENT + REPLAY-SAFE: fixed asOf, fixed event ids, guarded on event_id in
// the store. No wall-clock (Charter cmd 6).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-FRTB-TRADING-DESK-STRUCTURE;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-MARKETS-CAPITAL-TIME-SHAPE;
//   Regulations Relating to Banks Reg 28 / Reg 30; BCBS d424 MAR50;
//   Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../platform/composition";
import { money } from "../../platform/core/decimal-money";
import { encodeMoney } from "../../platform/core/money-codec";
import {
  type DerivativeAssetClass,
  type DerivativeInstrumentType,
  type DerivativeMaturityBand,
  type DerivativeVenue,
  makeDerivativeTradingPositionOpened,
} from "../../platform/event-store/event-types/derivative-book-positions";
import { simulatedTag } from "../../platform/event-store/provenance";
import { DEFAULT_SIM_DESK_ID, SIM_TRADING_BOOK_DESK_IDS } from "../../v2-core/desk/roster";

// ---------------------------------------------------------------------------
// Fixed simulation parameters — no wall-clock; idempotent ids.
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-26T00:00:00.000Z";
const OPENED_DATE = "2026-06-26";
const FUNCTIONAL = "ZAR";

const TRADING_DESK = DEFAULT_SIM_DESK_ID;
const HEDGING_DESK = SIM_TRADING_BOOK_DESK_IDS[1] ?? DEFAULT_SIM_DESK_ID;
// Banking-book derivatives book to the treasury desk.
const TREASURY_DESK = "urn:desk:treasury-desk:treasury-desk-1";

const ACTOR = { type: "service" as const, id: "agent:atlas:seed-derivative-book-sim-v1" };

const CITATIONS = [
  "D-BA-RETURN-SIMULATOR-FIRST",
  "urn:reg:za:regs-relating-to-banks:reg28",
  "urn:reg:bcbs:mar:d424-mar50",
  "P1-EVENTS-AS-TRUTH",
];

const SIM_PROVENANCE = simulatedTag({
  scenario: "derivative-book-sim-v1",
  sourceLineage: "scripts/sim/seed-derivative-book-sim-v1.ts",
  tags: ["manual-simulation", "derivative-book", "ba350", "cva", "d-ba-return-simulator-first"],
});

// Counterparties (for OTC positions → CVA reuse). Names chosen so the CVA
// counterparty-class heuristic resolves: "bank" → bank class; "corp"/"ltd" →
// corporate; sovereign keyword → sovereign.
const CP_BANK = {
  id: "urn:party:legal-entity:standard-bank-za",
  name: "Standard Bank of South Africa (sim)",
  jurisdiction: "ZA",
};
const CP_CORP = {
  id: "urn:party:legal-entity:acme-corp-ltd",
  name: "Acme Corporation Ltd (sim)",
  jurisdiction: "ZA",
};

// ---------------------------------------------------------------------------
// The simulated derivative book. Round numbers so the BA 350 fold lands on the
// hand-computed golden-case figures asserted by the recon + golden test.
// fairValueMajor is SIGNED (positive = net asset; negative = net liability).
// ---------------------------------------------------------------------------

interface DerivSpec {
  positionId: string;
  instrumentId: string;
  instrumentName: string;
  assetClass: DerivativeAssetClass;
  instrumentType: DerivativeInstrumentType;
  venue: DerivativeVenue;
  maturityBand: DerivativeMaturityBand;
  notionalMajor: string;
  fairValueMajor: string; // signed
  book: "trading" | "banking-treasury";
  deskId: string;
  maturityDate: string;
  counterparty?: { id: string; name: string; jurisdiction: string };
}

const DERIVATIVE_BOOK: readonly DerivSpec[] = [
  // ── ETD (exchange-traded; CCP-cleared, no counterparty) ──────────────────
  {
    positionId: "DBSIM-ETD-IR-FUT-BOUGHT",
    instrumentId: "JIBAR-FUT-2026-09",
    instrumentName: "3m JIBAR future (sim)",
    assetClass: "interest-rate",
    instrumentType: "future-bought",
    venue: "exchange-traded",
    maturityBand: "lt-1y",
    notionalMajor: "100000000", // R100m
    fairValueMajor: "500000", // +R500k asset
    book: "trading",
    deskId: TRADING_DESK,
    maturityDate: "2026-09-15",
  },
  {
    positionId: "DBSIM-ETD-IR-FUT-SOLD",
    instrumentId: "R186-FUT-2028-06",
    instrumentName: "R186 bond future short (sim)",
    assetClass: "interest-rate",
    instrumentType: "future-sold",
    venue: "exchange-traded",
    maturityBand: "1y-5y",
    notionalMajor: "60000000", // R60m
    fairValueMajor: "-300000", // -R300k liability
    book: "trading",
    deskId: HEDGING_DESK,
    maturityDate: "2028-06-15",
  },
  {
    positionId: "DBSIM-ETD-EQ-IDX-FUT",
    instrumentId: "ALSI-FUT-2026-09",
    instrumentName: "FTSE/JSE Top40 index future (sim)",
    assetClass: "equity",
    instrumentType: "future-bought",
    venue: "exchange-traded",
    maturityBand: "lt-1y",
    notionalMajor: "40000000", // R40m
    fairValueMajor: "200000", // +R200k
    book: "trading",
    deskId: TRADING_DESK,
    maturityDate: "2026-09-15",
  },
  {
    positionId: "DBSIM-ETD-CM-OPT-PURCH",
    instrumentId: "XPT-CALL-2027-03",
    instrumentName: "Platinum call option purchased (sim)",
    assetClass: "commodity",
    instrumentType: "call-option-purchased",
    venue: "exchange-traded",
    maturityBand: "1y-5y",
    notionalMajor: "20000000", // R20m
    fairValueMajor: "150000", // +R150k premium value
    book: "trading",
    deskId: TRADING_DESK,
    maturityDate: "2027-03-15",
  },
  // ── OTC (carry a counterparty → CVA) ─────────────────────────────────────
  {
    positionId: "DBSIM-OTC-IR-SWAP-BANK",
    instrumentId: "IRS-ZAR-5Y-SBZA",
    instrumentName: "ZAR fixed-vs-ZARONIA IRS 5y (sim)",
    assetClass: "interest-rate",
    instrumentType: "swap",
    venue: "over-the-counter",
    maturityBand: "1y-5y",
    notionalMajor: "200000000", // R200m
    fairValueMajor: "4000000", // +R4m asset (in-the-money to bank)
    book: "trading",
    deskId: TRADING_DESK,
    maturityDate: "2031-06-26",
    counterparty: CP_BANK,
  },
  {
    positionId: "DBSIM-OTC-IR-FRA-BANK",
    instrumentId: "FRA-ZAR-3X6-SBZA",
    instrumentName: "ZAR 3x6 FRA (sim)",
    assetClass: "interest-rate",
    instrumentType: "forward-fra",
    venue: "over-the-counter",
    maturityBand: "lt-1y",
    notionalMajor: "80000000", // R80m
    fairValueMajor: "120000", // +R120k
    book: "trading",
    deskId: TRADING_DESK,
    maturityDate: "2026-12-26",
    counterparty: CP_BANK,
  },
  {
    positionId: "DBSIM-OTC-FX-FWD-CORP",
    instrumentId: "FXFWD-USDZAR-1Y-ACME",
    instrumentName: "USD/ZAR 1y forward (sim)",
    assetClass: "foreign-exchange",
    instrumentType: "forward-fra",
    venue: "over-the-counter",
    maturityBand: "1y-5y",
    notionalMajor: "90000000", // R90m
    fairValueMajor: "-600000", // -R600k liability to bank
    book: "trading",
    deskId: HEDGING_DESK,
    maturityDate: "2027-06-26",
    counterparty: CP_CORP,
  },
  {
    positionId: "DBSIM-OTC-EQ-OPT-WRITTEN",
    instrumentId: "EQOPT-NPN-PUT-W-ACME",
    instrumentName: "Naspers put option written (sim)",
    assetClass: "equity",
    instrumentType: "put-option-written",
    venue: "over-the-counter",
    maturityBand: "lt-1y",
    notionalMajor: "30000000", // R30m
    fairValueMajor: "-250000", // -R250k (written option liability)
    book: "trading",
    deskId: TRADING_DESK,
    maturityDate: "2026-12-26",
    counterparty: CP_CORP,
  },
  {
    positionId: "DBSIM-OTC-CDS-CORP",
    instrumentId: "CDS-ACME-5Y",
    instrumentName: "Acme Corp 5y CDS protection bought (sim)",
    assetClass: "credit",
    instrumentType: "credit-default-swap",
    venue: "over-the-counter",
    maturityBand: "1y-5y",
    notionalMajor: "50000000", // R50m
    fairValueMajor: "300000", // +R300k
    book: "trading",
    deskId: TRADING_DESK,
    maturityDate: "2031-06-26",
    counterparty: CP_BANK,
  },
  // ── BANKING BOOK (BA 350 reports banking-book derivatives too) ───────────
  {
    positionId: "DBSIM-OTC-IR-SWAP-BANKING",
    instrumentId: "IRS-ZAR-7Y-HEDGE-SBZA",
    instrumentName: "Banking-book IR hedge swap 7y (sim)",
    assetClass: "interest-rate",
    instrumentType: "swap",
    venue: "over-the-counter",
    maturityBand: "gt-5y",
    notionalMajor: "150000000", // R150m
    fairValueMajor: "-900000", // -R900k
    book: "banking-treasury",
    deskId: TREASURY_DESK,
    maturityDate: "2033-06-26",
    counterparty: CP_BANK,
  },
];

// ---------------------------------------------------------------------------
// Idempotency helper.
// ---------------------------------------------------------------------------

function collectExistingEventIds(): Set<string> {
  const ids = new Set<string>();
  for (const ev of eventStore.replay({})) ids.add(ev.event_id);
  return ids;
}

const EXISTING_EVENT_IDS = collectExistingEventIds();

function alreadyEmitted(eventId: string): boolean {
  return EXISTING_EVENT_IDS.has(eventId);
}

// ---------------------------------------------------------------------------
// Emit.
// ---------------------------------------------------------------------------

function emit(): number {
  let n = 0;
  for (const d of DERIVATIVE_BOOK) {
    const eventId = `EV-${d.positionId}`;
    if (alreadyEmitted(eventId)) continue;
    const ev = makeDerivativeTradingPositionOpened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId,
      provenance: SIM_PROVENANCE,
      payload: {
        positionId: d.positionId,
        instrumentId: d.instrumentId,
        instrumentName: d.instrumentName,
        assetClass: d.assetClass,
        instrumentType: d.instrumentType,
        venue: d.venue,
        maturityBand: d.maturityBand,
        notional: encodeMoney(money(d.notionalMajor, FUNCTIONAL)),
        fairValue: encodeMoney(money(d.fairValueMajor, FUNCTIONAL)),
        deskId: d.deskId,
        bookType: d.book,
        openedDate: OPENED_DATE,
        maturityDate: d.maturityDate,
        ...(d.counterparty
          ? {
              counterpartyId: d.counterparty.id,
              counterpartyName: d.counterparty.name,
              counterpartyJurisdiction: d.counterparty.jurisdiction,
            }
          : {}),
      },
    });
    eventStore.append(ev);
    n += 1;
  }
  return n;
}

function main(): number {
  const emitted = emit();
  console.log(
    `[seed-derivative-book-sim-v1] emitted=${emitted} derivative positions (scenario=derivative-book-sim-v1, provenance=simulated, entity=${ENTITY}). BA 350 inventory + CVA capital fold drive non-zero on the simulated/combined read; the production BA 350 read stays 0 (simulated book excluded by the production provenance filter).`,
  );
  return 0;
}

process.exit(main());
