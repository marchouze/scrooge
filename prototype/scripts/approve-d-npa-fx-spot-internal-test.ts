// scripts/approve-d-npa-fx-spot-internal-test.ts
//
// Scrooge session-delegation — record CEO approval of D-NPA-FX-SPOT-INTERNAL-TEST.
//
// Triggered by Marc (CEO)'s explicit in-session approval of Saskia (Chief
// Markets Officer, governance)'s PROC-NPA-GATE-01 walk for FX-spot at
// 2026-05-21T09:28Z via Scrooge's AskUserQuestion presentation. Per CLAUDE.md
// "Session delegation": Marc's choice in-session constitutes CEO authorization;
// Scrooge emits both:
//   1. Decision{phase:"approved"} for D-NPA-FX-SPOT-INTERNAL-TEST
//   2. ProductApproved{productId, version, conditions, approvedBy}
//
// The ProductApproved event flips Devon's PROC-MK-PLG-01 condition
// NPA-fx-spot-schema-defined from Open → Satisfied on next rehearsal run.
//
// Scope: INTERNAL PRE-LICENCE TEST ONLY. Production trading remains gated on
// the actual pre-licence go-live readiness gate (PROC-MK-PLG-01) and wall-clock
// regulatory items (SARB banking licence, FSCA FSP, Authorised Dealer, etc.).
//
// Authority: CLAUDE.md "Decision authority routing" — NewProductApproved is
// a CEO-class decision under the build-phase substrate.
//
// Author: Scrooge (Chief of Staff, orchestrator) — recording instrument for the CEO.

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { clock, eventStore } from "../platform/composition";
import { makeProductApproved } from "../platform/event-store/event-types/product";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-NPA-FX-SPOT-INTERNAL-TEST";
const PRODUCT_ID = "prd:bank:fx:fx-spot-usdzar";
const PRODUCT_VERSION = "0.1.0-internal-pre-licence-test";

const asOf = clock.now();

// 1. Record CEO approval as a Decision event.
const decision = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Approve FX-spot product for internal pre-licence test scope (D-NPA-FX-SPOT-INTERNAL-TEST)",
    category: "product",
    recommendation:
      "Approve FX-spot product (productId: prd:bank:fx:fx-spot-usdzar, version: 0.1.0-internal-pre-licence-test) for INTERNAL PRE-LICENCE TEST scope only. CEO acknowledgment substitutes for board-notification (structurally absent in build phase). Production trading remains gated on PROC-MK-PLG-01 (pre-licence go-live readiness gate) and wall-clock regulatory items.",
    rationale:
      "Saskia's PROC-NPA-GATE-01 walk (PR #673) returned 8 Satisfied / 5 InProgress (with documented compensating controls) / 1 Open (board-notification). The Open dimension is structurally unavoidable until Board constitution at licence-day; CEO acknowledgment via this decision is the build-phase substitute. All implementation-required dimensions are Satisfied. Compensating controls are documented for the 5 InProgress dimensions. Approval flips Devon's PROC-MK-PLG-01 Condition 1 (NPA-fx-spot-schema-defined) from Open to Satisfied on next rehearsal.",
    sourceDocHashes: [
      "blake3:9077910195cfb6c1f595407a5fabca53907f2653d9e4b362e2906b8d42049ff7", // Saskia walk markdown
    ],
    citations: [
      "PR #673",
      "PR #667",
      "Procedures/by-policy/npa-gate.md",
      "Procedures/markets/pre-licence-go-live-gate.md",
      "CLAUDE.md#decision-authority-routing",
      "Policies/trading-mandate-v1.md",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  asOf,
);

console.log(JSON.stringify({ decisionEvent: decision }, null, 2));

// 2. Emit ProductApproved — the substrate event that downstream subscribers
// (and Devon's PROC-MK-PLG-01 rehearsal) read to confirm the FX-spot product
// is approved.
const productApprovedEvent = makeProductApproved({
  asOf,
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "human", id: "marc@tgv.co.za" },
  citations: ["decision:D-NPA-FX-SPOT-INTERNAL-TEST", "PR #673", "scrooge:session-delegation"],
  payload: {
    productId: PRODUCT_ID,
    version: PRODUCT_VERSION,
    conditions: [
      "scope: internal-pre-licence-test only",
      "compensating-control: regulatory-legal — Rashida ExCon ruling PR #644 (build-phase outside Reg 2/3)",
      "compensating-control: market-risk — Helena MR-1-FX proposed PR #634; BRC tabling required before live",
      "compensating-control: capital-impact — SA-CCR validated PR #635; FRTB SA validation deferred",
      "compensating-control: liquidity-impact — BA-325 wired; LCR shifts asserted in Kai PR #663+#645",
      "compensating-control: model-risk — Nadia tier classification deferred (reference-rate-driven)",
      "open: board-notification — structurally absent in build phase; CEO acknowledgment is substitute",
    ],
    approvedBy: "marc@tgv.co.za",
  },
});

eventStore.append(productApprovedEvent);

console.log(JSON.stringify({ productApprovedEvent }, null, 2));
