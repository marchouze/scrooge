// scripts/sim/seed-banking-book-equity-sim-v1.ts
//
// SIMULATOR-FIRST — Phase 2c (D-BA-RETURN-SIMULATOR-FIRST).
//
// Seeds a small, clearly-SYNTHETIC BANKING-BOOK equity book that drives the
// BA 340 (Equity Risk in the Banking Book) simple-risk-weight engine to a
// realistic, oracle-validated, NON-ZERO output across the holding classes —
// the engine that did NOT exist before Phase 2c (BA 340 was contract-only).
//
// WHAT IT EMITS (all `provenance: simulated`, scenario "banking-book-equity-sim-v1"):
//   - Listed   (publicly-traded, 300%): a long + a short single-name → exposure
//     on the absolute values (Reg 31 footnote 1).
//   - Unlisted (other, 400%): a single strategic stake.
//   - Speculative-unlisted: a holding carried for the R0020 exposure line but
//     NOT Table-1-charged (it routes to the Reg-38(5) deduction/250% regime).
// → BankingBookEquityHoldingOpened
//
// These are equity INVESTMENTS held in the BANKING book (held-to-collect /
// strategic), ECONOMICALLY DISTINCT from Phase 1's held-for-trading equity. They
// book to a BANKING-BOOK (treasury) desk — NEVER a trading-book desk — so they
// can NOT leak into BA 320 trading-book equity risk (the FRTB boundary
// `recon:frtb-desk-integrity` enforces; and the BA 320 fold reads only the
// SEPARATE EquityTradingPositionOpened event family, so leakage is structurally
// impossible regardless of desk).
//
// PROVENANCE BOUNDARY (CRITICAL — the R300m-into-Prod lesson):
//   Every event carries `simulatedTag(...)`. The PRODUCTION BA 340 read uses
//   `defaultProvenanceFilter()` (production-only), which EXCLUDES every event
//   here — so the production-only BA 340 charge stays ZERO pre-licence-day. The
//   simulated book appears only under a simulated-inclusive read. Both legs are
//   proven by `recon:ba340-equity-risk-sim-drive` + the golden-case test.
//
// IDEMPOTENT + REPLAY-SAFE: fixed asOf, fixed event ids, guarded on event_id in
// the store. No wall-clock (Charter cmd 6).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-FRTB-TRADING-DESK-STRUCTURE;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; Regulations Relating to Banks
//   Reg 31(6)(b)(i) (Table 1: 300% listed / 400% unlisted); Reg 38 (8% min ratio);
//   Basel CRE; Principle 1; Principle 5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { eventStore } from "../../platform/composition";
import { money } from "../../platform/core/decimal-money";
import { encodeMoney } from "../../platform/core/money-codec";
import type { BankingBookEquityHoldingClass } from "../../platform/event-store/event-types/banking-book-equity-holdings";
import { makeBankingBookEquityHoldingOpened } from "../../platform/event-store/event-types/banking-book-equity-holdings";
import { simulatedTag } from "../../platform/event-store/provenance";
import { DEFAULT_SIM_BANKING_BOOK_DESK_ID } from "../../v2-core/desk/roster";

// ---------------------------------------------------------------------------
// Fixed simulation parameters — no wall-clock; idempotent ids.
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-26T00:00:00.000Z";
const OPENED_DATE = "2026-06-26";
const FUNCTIONAL = "ZAR";

// Banking-book (treasury) desk — NEVER a trading-book desk (the FRTB boundary).
const BANKING_DESK = DEFAULT_SIM_BANKING_BOOK_DESK_ID;

const ACTOR = { type: "service" as const, id: "agent:bea:seed-banking-book-equity-sim-v1" };

const CITATIONS = [
  "D-BA-RETURN-SIMULATOR-FIRST",
  "urn:reg:za:regs-relating-to-banks:reg31",
  "urn:reg:za:regs-relating-to-banks:reg38",
  "P1-EVENTS-AS-TRUTH",
];

const SIM_PROVENANCE = simulatedTag({
  scenario: "banking-book-equity-sim-v1",
  sourceLineage: "scripts/sim/seed-banking-book-equity-sim-v1.ts",
  tags: [
    "manual-simulation",
    "banking-book",
    "equity-risk",
    "ba340",
    "d-ba-return-simulator-first",
  ],
});

// ---------------------------------------------------------------------------
// The simulated banking-book equity book. Values are clean round numbers so the
// BA 340 engine lands on the hand-computed golden-case figures asserted by
// `platform/recon/ba340-equity-risk-sim-drive.ts` + the golden-case test.
//
// GOLDEN CASE (Reg 31(6)(b)(i) Table 1; Reg 38 8% min ratio):
//   Listed   (300%): long R20m + short R5m → exposure R25m (abs values, Reg 31
//                    footnote 1); RWE = R25m × 300% = R75m; capital = R6m.
//   Unlisted (400%): long R10m         → exposure R10m; RWE = R40m; capital = R3.2m.
//   Speculative-unlisted: long R3m      → exposure R3m; NOT Table-1-charged
//                                         (RWE 0, capital 0).
//   Total exposure R38m (all holdings incl. speculative); RWE R115m + capital
//   R9.2m are the Table-1-charged classes only (listed + unlisted).
// ---------------------------------------------------------------------------

interface HoldingSpec {
  holdingId: string;
  instrumentId: string;
  instrumentName: string;
  holdingClass: BankingBookEquityHoldingClass;
  side: "long" | "short";
  exposureValueMajor: string;
}

const BANKING_BOOK_EQUITY: readonly HoldingSpec[] = [
  // Listed (300%) — long + short single-names; both feed exposure on |value|.
  {
    holdingId: "BBSIM-EQ-LISTED-NPN-LONG",
    instrumentId: "ZAE000015889",
    instrumentName: "Naspers N — strategic banking-book holding (sim)",
    holdingClass: "listed",
    side: "long",
    exposureValueMajor: "20000000", // R20,000,000
  },
  {
    holdingId: "BBSIM-EQ-LISTED-SOL-SHORT",
    instrumentId: "ZAE000006896",
    instrumentName: "Sasol — banking-book hedge short (sim)",
    holdingClass: "listed",
    side: "short",
    exposureValueMajor: "5000000", // R5,000,000 (net short |value| risk-weighted)
  },
  // Unlisted (400%) — a single strategic stake in an unlisted entity.
  {
    holdingId: "BBSIM-EQ-UNLISTED-FINTECH-LONG",
    instrumentId: "ZA-UNLISTED-FINTECH-001",
    instrumentName: "Unlisted fintech associate — strategic stake (sim)",
    holdingClass: "unlisted",
    side: "long",
    exposureValueMajor: "10000000", // R10,000,000
  },
  // Speculative-unlisted — carried for the R0020 exposure line, NOT Table-1-charged.
  {
    holdingId: "BBSIM-EQ-SPECULATIVE-VC-LONG",
    instrumentId: "ZA-UNLISTED-VC-002",
    instrumentName: "Early-stage venture holding — speculative (sim)",
    holdingClass: "speculative-unlisted",
    side: "long",
    exposureValueMajor: "3000000", // R3,000,000
  },
];

// ---------------------------------------------------------------------------
// Idempotency helper.
// ---------------------------------------------------------------------------

/** Collect every existing event_id once (single replay) for O(1) idempotency. */
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

function emitHoldings(): number {
  let n = 0;
  for (const h of BANKING_BOOK_EQUITY) {
    const eventId = `EV-${h.holdingId}`;
    if (alreadyEmitted(eventId)) continue;
    const ev = makeBankingBookEquityHoldingOpened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId,
      provenance: SIM_PROVENANCE,
      payload: {
        holdingId: h.holdingId,
        instrumentId: h.instrumentId,
        instrumentName: h.instrumentName,
        holdingClass: h.holdingClass,
        side: h.side,
        exposureValue: encodeMoney(money(h.exposureValueMajor, FUNCTIONAL)),
        deskId: BANKING_DESK,
        bookType: "banking-treasury",
        openedDate: OPENED_DATE,
      },
    });
    eventStore.append(ev);
    n += 1;
  }
  return n;
}

function main(): number {
  const holdings = emitHoldings();
  console.log(
    `[seed-banking-book-equity-sim-v1] emitted banking-book-equity holdings=${holdings} ` +
      `(scenario=banking-book-equity-sim-v1, provenance=simulated, entity=${ENTITY}, desk=${BANKING_DESK}). ` +
      "Listed R25m exp → R75m RWE → R6m cap; unlisted R10m exp → R40m RWE → R3.2m cap; " +
      "speculative R3m exp (not Table-1-charged). Production BA 340 read stays 0; simulated read drives the engine.",
  );
  return 0;
}

process.exit(main());
