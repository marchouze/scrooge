// scripts/run-fx-otc-vanilla-npa-cycle.ts
//
// THE single driver for the clean FX OTC vanilla NPA cycle. Replaces the prior
// accreted authoring (run-npa-gate-fx-otc-vanilla.ts, run-fx-npa-dim-
// verification-pass-2.ts, enrich-fx-npa-treatment-modules-and-file-doc.ts,
// run-fx-legal-conditions-post-withdrawal.ts, withdraw-fx-otc-npa-approval.ts).
//
// It:
//   1. Runs the clean cycle (runFxOtcVanillaNpaCycle) — fresh proposal →
//      conceptualised → honest attestations → due-diligence-completed →
//      gate-determined ProductApproved (INTERNAL-TEST) or ProductWithheld.
//   2. Renders + files the consolidated FX NPA document events-first
//      (RecordFiled, RMS-7).
//
// It does NOT record the CEO restart decision D-FX-NPA-RESTART. That decision is
// recorded canonically by Scrooge (the recording instrument) in the shared home
// store via session-delegation. Re-emitting it here / on the ci:migrate clean
// store would create an `approved` decision with no prior `requested` phase
// (tripping recon:decision-symmetry) and a decision with no impact-sweep
// coverage (tripping recon:v2-decision-impact-sweep-coverage). The cycle events
// may still CITE D-FX-NPA-RESTART as authority; a citation string does not
// require the decision to live in the clean store.
//
// Wired into `ci:migrate` so the cycle reproduces on CI's clean store; also run
// against the shared canonical home store for the canonical record:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/run-fx-otc-vanilla-npa-cycle.ts
//
// Authority: D-FX-NPA-RESTART (CEO-approved 2026-06-17); D-NEW-PRODUCT-APPROVAL-
//   POLICY-V2; D-NPA-GATE-POLICY-REDESIGN; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
// Author: Saskia (Head of Global Markets, governance).

import { clock, eventStore } from "../platform/composition";
import { renderFxNpaConsolidatedDoc } from "../platform/markets/products/fx-npa-consolidated-doc";
import {
  FX_NPA_CYCLE_AS_OF,
  FX_NPA_PRODUCT_ID,
  runFxOtcVanillaNpaCycle,
} from "../platform/markets/products/fx-otc-vanilla-npa-cycle";
import { validateNpaGate } from "../platform/markets/products/npa-gate";
import { logger } from "../platform/observability/logger";
import { buildProductRegisterView } from "../platform/projections/products/product-register";
import { recordFiled } from "../platform/records/helpers";

// ---------------------------------------------------------------------------
// 1. Run the clean cycle (idempotent, append-only, gate-determined).
// ---------------------------------------------------------------------------

const result = runFxOtcVanillaNpaCycle(eventStore);
logger.info(
  {
    productId: FX_NPA_PRODUCT_ID,
    outcome: result.outcome,
    gateReady: result.gateReady,
    blockingDimensions: result.blockingDimensions,
    openConditions: result.openConditions,
    eventsEmitted: result.eventsEmitted.length,
  },
  `Clean FX OTC vanilla NPA cycle: ${result.outcome}`,
);

// ---------------------------------------------------------------------------
// 2. Render + file the consolidated NPA document events-first (RecordFiled).
// ---------------------------------------------------------------------------

const events = Array.from(eventStore.replay());
const register = buildProductRegisterView(events);
const row = register.get(FX_NPA_PRODUCT_ID);
if (!row) {
  throw new Error(
    `No register row for ${FX_NPA_PRODUCT_ID} — cannot file the consolidated NPA doc.`,
  );
}
const gate = validateNpaGate(row);

// The umbrella's NPA status for the doc: approved (internal-test) when the gate
// is ready, else withheld. The cycle drives the register stage to
// approved-conditional on the internal-test ProductApproved.
const npaStatus: "approved" | "withheld" | "pending" =
  result.outcome === "approved-internal-test"
    ? "approved"
    : result.outcome === "withheld"
      ? "withheld"
      : "pending";

const body = renderFxNpaConsolidatedDoc({ row, gate, npaStatus, asOf: FX_NPA_CYCLE_AS_OF });

const recordId = `npa-doc:${FX_NPA_PRODUCT_ID}:clean-cycle:${FX_NPA_CYCLE_AS_OF.slice(0, 10)}`;
const filed = recordFiled(
  {
    recordId,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      // Companies Act §24 — board/management decisions & records (7 years).
      citationRef: "COMPANIES-ACT-71-2008-S24",
      minimumYears: 7,
      archivalTier: "cool",
    },
    metadata: {
      title: "FX OTC Vanilla — consolidated NPA (clean cycle)",
      path: `records/npa/${FX_NPA_PRODUCT_ID}/clean-cycle.md`,
      category: "product-npa",
      author: "agent:saskia:fx-otc-vanilla-npa-cycle",
      date: FX_NPA_CYCLE_AS_OF,
    },
    citations: [
      "D-FX-NPA-RESTART",
      "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
      "D-NPA-GATE-POLICY-REDESIGN",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
    ],
    actor: { type: "service", id: "agent:saskia:fx-otc-vanilla-npa-cycle" },
  },
  FX_NPA_CYCLE_AS_OF,
);

logger.info(
  {
    recordId,
    documentHash: filed.documentHash,
    eventId: filed.eventId,
    isNewDocument: filed.isNewDocument,
    npaStatus,
    gateReady: gate.ready,
    openConditions: gate.openConditions,
    at: clock.now(),
  },
  "Consolidated FX NPA document filed via RecordFiled (events-first).",
);

process.exit(0);
