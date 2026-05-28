// scripts/record-d-ifrs9-staging-v1.ts
//
// One-shot: emit Decision(approved) for D-IFRS9-STAGING-V1 — CEO approval
// of the IFRS 9 staging engine v1 (build-phase simplified rules).
//
// Gate G4 requires demonstrable IFRS 9 staging automation. This decision
// approves the build-phase simplified rules (5/100/5000 bps ECL rates;
// 3-stage classification per IFRS 9 §5.5); the full PD/LGD/EAD model is
// a licence-day deliverable under the credit-risk framework (Reg 23).
//
// Authority: CEO session-delegation (marc@tgv.co.za) via atlas:ifrs9-staging-build.
// Routing: Engineering build decisions (substrate, platform, schema) — CEO.
//
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { EventStore } from "../platform/event-store/store";
import { recordDecision } from "../runtime/decisions/record";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

// Inject shared store so recordDecision writes to the correct path.
process.env.BANK_EVENT_DB = DB_PATH;

const DECISION_ID = "D-IFRS9-STAGING-V1";

// Idempotency check: skip if already recorded.
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
    title: "IFRS 9 staging engine v1 — build-phase simplified rules",
    category: "engineering",
    recommendation:
      "Implement simplified 3-stage IFRS 9 classification with build-phase ECL rates; real ECL model plugs in at licence-day",
    rationale:
      "Gate G4 requires demonstrable IFRS 9 staging automation. Build-phase rates are conservative (5/100/5000 bps) and consistent with the bank's pre-licence position. Full PD/LGD/EAD model is a licence-day deliverable under the credit-risk framework (Reg 23). Stage rules follow IFRS 9 §5.5: Stage 3 at ≥90 DPD / default / restructured; Stage 2 at ≥30 DPD / SICR; Stage 1 (performing) otherwise.",
    sourceDocHashes: [],
    citations: ["D-IFRS-THRESHOLDS-V13"],
    recordedVia: "agent:autonomous",
    actor: { type: "human", id: "marc@tgv.co.za" },
  },
  new Date().toISOString(),
);

console.log(`${DECISION_ID} recorded — event_id: ${result.eventId}`);
