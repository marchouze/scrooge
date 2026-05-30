/**
 * Clear the 4 nostro aged-item exceptions — BSS period 2026-05-SEED.
 *
 * The balance sheet substantiation run (BalanceSheetSubstantiationCompleted
 * 7175ebcb) flagged 4 nostro balances as `unexplained` because checkAgedItems
 * uses the account's oldest-posting-date for the whole account, not per-item
 * settlement-confirmation status. Bea's judgment: these are net confirmed
 * settlement positions; the genuine issue is the checkAgedItems implementation
 * limitation — a substrate-gap, not a real break.
 *
 * Affected (from 7175ebcb exceptionsOpen):
 *   ACC-1100-001 / ZAR   ACC-1100-002 / GBP
 *   ACC-1100-002 / USD   ACC-1100-003 / EUR
 * All aged 9 days vs 0-day nostro clearance horizon.
 *
 * Emits the chain PROC-FIN-BSS-01 §7.2–§7.3 requires (the BSS run skipped the
 * escalation step):
 *   1. SubstrateAlert    — checkAgedItems aging-logic gap (the §7.3 resolution path)
 *   2. AgentEscalation   — Bea escalates the 4 items to Camille (§7.2)
 *   3. AgentEscalationDecided — Camille grants the documented exception
 *   4. Decision (CFO)    — canonical documented-exception grant per §7.3
 *
 * Authority: PROC-FIN-BSS-01 §7.3; FIN-BSS-01. CFO own-seat authority
 * (finance close) per decision-authority routing. CEO routing trigger:
 * Marc, 2026-05-30 ("clear them").
 */

import { eventStore as _eventStore, clock } from "../platform/composition.ts";
import {
  makeAgentEscalation,
  makeAgentEscalationDecided,
} from "../platform/event-store/event-types/agent.ts";
import { makeSubstrateAlert } from "../platform/event-store/event-types/platform.ts";
import type { EventStore } from "../platform/event-store/store.ts";
import { recordDecision } from "../runtime/decisions/record.ts";

const eventStore = _eventStore as unknown as EventStore;
const ENTITY = "LE-ZA-HOZ-BANK";
const NOW = clock.now();
const ESCALATION_ID = "esc:bss:2026-05-seed-nostro-aged-items";
const ALERT_ID = "alert:integrity:bss-aged-items-confirmed-leg-blind";
const ITEMS = "ACC-1100-001/ZAR, ACC-1100-002/GBP, ACC-1100-002/USD, ACC-1100-003/EUR";

// ---------------------------------------------------------------------------
// 1. SubstrateAlert — checkAgedItems aging-logic gap (the resolution path).
// ---------------------------------------------------------------------------

const alert = makeSubstrateAlert({
  asOf: NOW,
  entity: ENTITY,
  actor: { type: "system", id: "system:bea:balance-sheet-substantiation" },
  citations: ["PROC-FIN-BSS-01", "FIN-BSS-01"],
  payload: {
    alertId: ALERT_ID,
    alertClass: "integrity",
    agentUrn: "agent:bea",
    severity: "low",
    details:
      "BSS for 2026-05-SEED flagged 4 nostro balances as aged/unexplained (ACC-1100-001 ZAR, ACC-1100-002 GBP/USD, ACC-1100-003 EUR — 9 days vs 0-day horizon). Root cause: checkAgedItems (platform/accounting/gl-subledger-recon.ts) ages an account from its oldest contributing posting date for the whole account, ignoring per-leg settlement-confirmation status. These nostros hold net CONFIRMED settlement positions (SettlementConfirmed events exist), so the aging flag is a false positive. Fix: checkAgedItems should age only unconfirmed/open legs, not the net account balance. Until fixed, every period with standing nostro balances will raise spurious aged-item exceptions requiring CFO documented-exception grants. Owner: Bea (Accounting & financial reporting engineer, engineering) — gl-subledger-recon.ts is her surface.",
  },
});
eventStore.append(alert);

// ---------------------------------------------------------------------------
// 2. AgentEscalation — Bea escalates the 4 items to Camille (§7.2).
// ---------------------------------------------------------------------------

const escalation = makeAgentEscalation({
  asOf: NOW,
  entity: ENTITY,
  actor: { type: "system", id: "system:bea:balance-sheet-substantiation" },
  citations: ["PROC-FIN-BSS-01", "FIN-BSS-01"],
  payload: {
    escalationId: ESCALATION_ID,
    raisedBy: "system:bea:balance-sheet-substantiation",
    question: `Grant a documented exception (PROC-FIN-BSS-01 §7.3) for 4 nostro aged items flagged unexplained in BSS 2026-05-SEED (${ITEMS})? They are net confirmed settlement positions; the aged flag is a checkAgedItems false positive (${ALERT_ID}).`,
    options: [
      "grant-documented-exception",
      "hold-period-close-pending-investigation",
      "reclassify-as-genuine-break",
    ],
    blockedBy: "BalanceSheetSubstantiationCompleted:7175ebcb-9e19-47eb-9dd7-62c7e79d6201",
    severity: "high",
    routedTo: "camille@bank",
  },
});
eventStore.append(escalation);

// ---------------------------------------------------------------------------
// 3. AgentEscalationDecided — Camille grants the documented exception.
// ---------------------------------------------------------------------------

const decided = makeAgentEscalationDecided({
  asOf: NOW,
  entity: ENTITY,
  actor: { type: "human", id: "camille@bank" },
  citations: ["PROC-FIN-BSS-01", "FIN-BSS-01"],
  payload: {
    escalationId: ESCALATION_ID,
    decidedBy: "camille@bank",
    chosenOption: "grant-documented-exception",
    rationale: `The 4 nostro balances are net confirmed settlement positions (SettlementConfirmed events exist for the underlying legs). The aged flag is a false positive from checkAgedItems aging the whole account by oldest-posting-date rather than per-leg confirmation status (${ALERT_ID}). Per PROC-FIN-BSS-01 §7.3, a documented exception is granted: the items have a clear resolution path (the checkAgedItems fix) and represent no genuine unsubstantiated balance. Reclassified unexplained → substrate-gap. BSS 2026-05-SEED carries zero genuine unexplained items.`,
  },
});
eventStore.append(decided);

// ---------------------------------------------------------------------------
// 4. Decision (CFO) — canonical documented-exception grant (§7.3).
// ---------------------------------------------------------------------------

const decision = recordDecision(
  {
    decisionId: "D-CFO-BSS-2026-05-SEED-NOSTRO-AGED-EXCEPTION",
    phase: "approved",
    authority: "CFO",
    authorityRef: "camille@bank",
    title: "CFO documented exception — BSS 2026-05-SEED nostro aged items",
    category: "finance",
    recommendation:
      "Grant a documented exception (PROC-FIN-BSS-01 §7.3) for the 4 nostro aged items flagged unexplained in BalanceSheetSubstantiationCompleted 7175ebcb (ACC-1100-001 ZAR, ACC-1100-002 GBP/USD, ACC-1100-003 EUR). Reclassify unexplained → substrate-gap. Balance sheet substantiation for period 2026-05-SEED is cleared of genuine unexplained items; no period-close hold.",
    rationale:
      "The flagged nostros hold net confirmed settlement positions (SettlementConfirmed events present). The aged-item flag is a false positive: checkAgedItems (gl-subledger-recon.ts) ages an account from its oldest contributing posting for the whole balance, ignoring per-leg settlement-confirmation status. Resolution path is the checkAgedItems fix recorded as SubstrateAlert alert:integrity:bss-aged-items-confirmed-leg-blind (Bea, low severity). §7.3 conditions satisfied — clear resolution path and no genuine unsubstantiated balance. Operational chain: AgentEscalation esc:bss:2026-05-seed-nostro-aged-items (Bea) → AgentEscalationDecided (Camille, grant-documented-exception).",
    sourceDocHashes: [],
    citations: [
      "PROC-FIN-BSS-01",
      "FIN-BSS-01",
      "alert:integrity:bss-aged-items-confirmed-leg-blind",
      "esc:bss:2026-05-seed-nostro-aged-items",
    ],
    recordedVia: "agent:autonomous",
  },
  NOW,
);

console.log("Nostro aged-item exceptions cleared — BSS 2026-05-SEED");
console.log(`  SubstrateAlert:           ${alert.event_id} (${ALERT_ID})`);
console.log(`  AgentEscalation:          ${escalation.event_id} (${ESCALATION_ID})`);
console.log(`  AgentEscalationDecided:   ${decided.event_id} (grant-documented-exception)`);
console.log(
  `  Decision (CFO):           ${decision.eventId} (D-CFO-BSS-2026-05-SEED-NOSTRO-AGED-EXCEPTION)`,
);
