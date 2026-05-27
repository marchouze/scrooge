// scripts/record-d-ifrs-thresholds-v13.ts
//
// One-shot: emit Decision(approved) for D-IFRS-THRESHOLDS-V13 — CEO
// session-delegation approving Bea's peer-review amendments to
// accounting-policies-ifrs v1.3 (SICR AND-rule + three-leg materiality).
//
// The amendments were already applied in v1.3 (merged with the peer-review
// PR). This script closes the open `decision-required: true` marker in
// archive/owner-inbox/2026-05-21_bea_ifrs-thresholds-peer-review.md and
// surfaces the approval in the RMS decisions register.
//
// Authority: CEO session-delegation (marc@tgv.co.za) 2026-05-27.
// Routing: finance/IFRS accounting policy → normally CFO (Camille);
//          CFO not yet operational → CEO session-delegation per CLAUDE.md
//          routing table; routed back to Camille for ratification at first
//          ICAAP review cycle.

import { recordDecision } from "../runtime/decisions/record";
import { EventStore } from "../platform/event-store/store";
import { resolve } from "node:path";

const DB_PATH =
  process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

// Inject shared store so recordDecision writes to the correct path.
process.env.BANK_EVENT_DB = DB_PATH;

const DECISION_ID = "D-IFRS-THRESHOLDS-V13";

// Idempotency check: skip if already recorded.
const store = new EventStore(DB_PATH);
const existing = Array.from(store.replay()).find(
  (ev) =>
    ev.type === "Decision" &&
    (ev.payload as Record<string, unknown>).decisionId === DECISION_ID,
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
      "Approve IFRS quantitative threshold amendments — accounting-policies-ifrs v1.3",
    category: "finance",
    recommendation:
      "Amend both §3.2.2 SICR trigger and §3.5.2 materiality threshold per Bea's peer review of Owen v1.2.",
    rationale:
      "Two construction defects identified in v1.2: (1) SICR §3.2.2 — 'whichever first' OR-rule " +
      "contradicted its own rationale (absolute leg stated as a filter, not an OR trigger); " +
      "replaced with AND-rule (both relative ≥100% AND absolute ≥50bp must trigger) aligning with " +
      "the conservative end of SA Big-5 peer practice and resolving the worked-example contradiction. " +
      "(2) Materiality §3.5.2 — two-leg '5% PBT or 0.5% TA, whichever lower' collapsed to near-zero " +
      "in build phase (≈R0 PBT → ≈R0 threshold) and was mathematically undefined in loss-making years; " +
      "replaced with three-leg construct: 0.5% total assets (primary, always defined) / 5% normalised " +
      "PBT (3-year trailing average of profit-making years, inactive until window exists) / 1% CET1 " +
      "(floor, always defined). Amendments already applied in v1.3 (merged 2026-05-21). " +
      "CFO (Camille, governance) ratification at first ICAAP review cycle; CEO session-delegation " +
      "per CLAUDE.md routing table (CFO seat not yet operational).",
    citations: [
      "D-TRADE-LIFECYCLE-IFRS-CHAIN",
      "D-DECISIONS-FRAMEWORK-REDESIGN",
      "IFRS-9-S5-5-9",
      "IAS-1-S29",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  "2026-05-27T00:00:00.000Z",
);

console.log(`Emitted ${DECISION_ID} — eventId: ${result.eventId}`);
