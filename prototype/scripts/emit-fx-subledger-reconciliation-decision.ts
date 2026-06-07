// prototype/scripts/emit-fx-subledger-reconciliation-decision.ts
//
// Records the CEO decision authorising the FX sub-ledger legacy-account
// reconciliation & residual write-off programme. Marc approved in-session
// (2026-06-07); under the session-delegation protocol that approval is the CEO
// authorisation, recorded here as the canonical Decision event (Principle 1).
//
// Context: the GL FX Trading Receivable/Payable accounts (ACC-2100-*) carry
// gross postings from the full simulated FX trade history (35 FxTradeExecuted:
// 1 live, 21 cancelled, 13 settled) rather than the live book. AUD/EUR net to
// zero (booked-and-reversed, shown gross because reversals were posted to the
// rebuilt account pairs ACC-2100-010..023 instead of contra-ing the legacy
// lines ACC-2100-001..004). CHF/GBP/JPY/USD/ZAR carry genuine non-zero residual
// stranded in the legacy accounts that the D-FX-SUBLEDGER-REBUILD created
// replacements for but never retired or zeroed.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-fx-subledger-reconciliation-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FX-SUBLEDGER-LEGACY-RECONCILIATION";

const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

if (reg.byId.has(DECISION_ID)) {
  console.log(`${DECISION_ID} already recorded — skipping.`);
} else {
  const { eventId } = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Reconcile and retire the legacy FX sub-ledger accounts (ACC-2100-001..004); substantiate or write off the per-currency residual",
      category: "finance",
      recommendation:
        "Run a sub-ledger reconciliation that (a) retires/zeroes the orphaned legacy FX Trading Receivable/Payable accounts (ACC-2100-001..004) against their rebuilt canonical pairs (ACC-2100-010..023) via closing entries, so the trial balance presents the live book rather than the full simulated history; and (b) for the currencies whose receivable+payable do NOT net to zero (CHF, GBP, JPY, USD, ZAR), substantiate each residual to its originating trade lifecycle and either clear it to the correct rebuilt account or book a CFO-approved write-off. Add a recon gate asserting per-currency net-zero for fully-reversed trades and a substantiated trail for any remaining residual.",
      rationale:
        "The FX receivable/payable balances overstate the live book by the entire booked-and-reversed history because reversals (cancellation, settlement, and the sub-ledger rebuild) were posted to new account IDs rather than contra-ing the legacy lines. AUD/EUR already net to zero — pure display gross-up — while CHF/GBP/JPY/USD/ZAR carry stranded residual in the legacy ACC-2100-001..004 accounts that the rebuild never retired. Cleaning this makes the GL trial balance faithfully represent the live position (Principle 1), removes recurring confusion between gross history and live exposure, and gives the CFO a substantiated basis for any write-off. The residual write-off amounts are a CFO sub-decision surfaced by the reconciliation; the engineering substrate (closing entries + recon gate) is build-phase work.",
      sourceDocHashes: [],
      citations: ["D-FX-SUBLEDGER-REBUILD", "P1-EVENTS-ARE-TRUTH"],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
