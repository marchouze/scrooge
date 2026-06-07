// scripts/record-d-alm-settlement-instruction-correspondent.ts
//
// Record D-ALM-SETTLEMENT-INSTRUCTION-CORRESPONDENT (CEO session-delegation,
// 2026-06-02): wire the correspondent-nostro connector to emit a paired
// SettlementInstructionIssued (repayment leg) for each intraday FundingDrawnDown,
// closing the "SettlementInstructionIssued: 0 settlement instructions within
// 30-day horizon" ALM substrate gap.
//
// Authority: CLAUDE.md decision-authority routing — engineering build decisions
// (substrate) → CEO (build phase). Idempotent.

import { resolve } from "node:path";
import { EventStore } from "../platform/event-store/store";
import { recordDecision } from "../runtime/decisions/record";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");
process.env.BANK_EVENT_DB = DB_PATH;

const DECISION_ID = "D-ALM-SETTLEMENT-INSTRUCTION-CORRESPONDENT";

const store = new EventStore(DB_PATH);
const existing = Array.from(store.replay()).find(
  (ev) =>
    ev.type === "Decision" && (ev.payload as Record<string, unknown>).decisionId === DECISION_ID,
);
if (existing) {
  console.log(`${DECISION_ID} already in store — skipped.`);
  process.exit(0);
}

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Source non-trade contractual LCR outflows from correspondent-funding repayments (SettlementInstructionIssued)",
    category: "engineering",
    recommendation:
      "Wire the CorrespondentNostroSimulator to emit a paired SettlementInstructionIssued " +
      "(repayment leg) for each intraday FundingDrawnDown, so correspondent funding lands in the " +
      "LCR 30-day contractual-outflow denominator (BA 110 §23) via buildSettlementOutflows.",
    rationale:
      "The SettlementInstructionIssued event class was defined and consumed by the LCR fold " +
      "(buildSettlementOutflows) but had no emitter — the 30-day liquidity horizon omitted all " +
      "non-trade contractual outflows (ALM substrate gap on the treasury dashboard). The obvious " +
      "source (maturing deposits / funding-lines) was rejected because buildFundingPositions already " +
      "folds DepositTaken / FundingLineDrawn / InterbankLoanPlaced into the LCR denominator at " +
      "BA 110 runoff rates — deriving instructions from those would double-count. The event's own " +
      "docstring scopes it to outflows outside the MMD/IBL/funding-line/trade stream. Correspondent " +
      "intraday-line drawdowns (FundingDrawnDown) are NOT folded by buildFundingPositions, so wiring " +
      "their repayment leg both closes the gap and fixes a genuine LCR coverage hole — with no " +
      "double-count. The connector is the production seam (Tomas's SWIFT connector emits the same " +
      "events in production). A one-time idempotent seed (alm:correspondent-drawdown-seed) populates " +
      "the build-phase baseline. Out of scope: maturing own-issued debt as a second source.",
    sourceDocHashes: [],
    citations: ["D-FX-CLS-MEMBERSHIP", "BCBS-248", "BANKS-REG-26"],
    recordedVia: "scrooge:session-delegation",
  },
  "2026-06-02T12:00:00.000Z",
);

console.log(`Emitted ${DECISION_ID} — eventId: ${result.eventId}`);
