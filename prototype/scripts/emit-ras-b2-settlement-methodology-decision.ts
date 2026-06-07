// prototype/scripts/emit-ras-b2-settlement-methodology-decision.ts
//
// Author: Rohan (Risk engineer, engineering — under Helena (Chief Risk
//   Officer, governance)).
//
// Records the CRO methodology decision-card for the RAS B2 settlement-window
// (Herstatt) exposure measurement, OPEN for Helena (Chief Risk Officer,
// governance) to ratify. Risk-appetite calibration is CRO authority (decision-
// authority routing table), NOT CEO — so this is emitted with
// `phase: "requested"`, `authority: "CRO"`. Rohan is the recording instrument;
// Helena is the deciding authority. Do NOT self-ratify: the card stays
// `requested` until Helena approves.
//
// Background: the engineering change (D-RAS-B2-SETTLEMENT-EXPOSURE-FIX, CEO-
// approved 2026-06-07) wired the B2 feeder. This card documents the *risk*
// methodology that the wiring implements, so the measurement basis is on the
// Decisions register under the authority that owns it.
//
// Idempotent: skips if the requested card already exists at this id+phase.
// Run once from prototype/, against the shared home store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/emit-ras-b2-settlement-methodology-decision.ts
// Stays in the repo as an audit record.

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY";

const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const existing = reg.byId.get(DECISION_ID);
const alreadyRequested = existing?.events?.some((e) => e.phase === "requested") ?? false;

if (alreadyRequested) {
  console.log(`${DECISION_ID} already requested — skipping (open for Helena).`);
} else {
  const { eventId } = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "requested",
      authority: "CRO",
      authorityRef: "helena@bank-za.internal",
      title: "RAS B2 settlement-window (Herstatt) exposure — measurement methodology",
      category: "risk",
      recommendation:
        "Adopt the following measurement basis for RAS cluster B2 (credit risk — settlement exposure). DEFINITION: B2 measures principal settlement risk (Herstatt risk) — the exposure that exists once the bank has irrevocably delivered one leg of an FX trade but has not yet received the counter-leg. TRIGGER (open): a PrincipalPayment{legKind:'deliver'} for a trade whose SettlementConfirmed has not yet landed, OR an FxSettlementFailed{failureKind:'one-leg-delivered', legStatus.payLegDelivered:true}. AMOUNT: the delivered-leg notional (or, for the failure branch with no PrincipalPayment captured, the trade's pay-leg notional). CLEAR (close): SettlementConfirmed for the trade (both legs settled) extinguishes the window. BASIS: exposure is converted to ZAR-equivalent at the delivered currency's <CCY>/ZAR market rate and measured against the ZAR B2 limit (R1m), consistent with the B3 NOP conversion. DISTINCTION: B2 is the settlement-window exposure (post-delivery, pre-receipt); B1 is the pre-settlement counterparty credit add-on (10% of notional, held before any leg moves and cleared on confirmation). The two do not double-count: B1 covers the pre-delivery window, B2 the post-delivery window.",
      rationale:
        "B2 was declared-but-uncomputed: the limit-utilisation projection routed pre-settlement credit to B1 and net position to B3 but had no feeder for B2, so it read zero even mid-settlement — a blind spot precisely where Herstatt loss is largest (the bank's principal is out the door). BCBS d226 (settlement risk in FX) and Banks Act Reg 39 (settlement-failure BCP) require the settlement window to be measured and limited. Driving B2 from the settlement lifecycle (PrincipalPayment / SettlementConfirmed / FxSettlementFailed) keeps the measure event-sourced (Principle 1) and lets it appear and clear automatically as legs settle. ZAR conversion removes the unit mismatch where a foreign-currency notional was compared against a ZAR limit. This card places the methodology on the Decisions register under CRO authority, which owns risk-appetite calibration per the decision-authority routing table; the engineering wiring is already CEO-approved under D-RAS-B2-SETTLEMENT-EXPOSURE-FIX.",
      sourceDocHashes: [],
      citations: [
        "D-RAS-B2-SETTLEMENT-EXPOSURE-FIX",
        "urn:reg:bcbs:d226",
        "P1-EVENTS-ARE-TRUTH",
        "P2-SINGLE-GRAPH-DISCIPLINE",
      ],
      recordedVia: "agent:autonomous",
      actor: { type: "service", id: "agent:rohan:risk-engine" },
    },
    clock.now(),
  );
  console.log(
    `Recorded ${DECISION_ID} (event ${eventId}) — phase=requested, authority=CRO, OPEN for Helena to ratify.`,
  );
}
