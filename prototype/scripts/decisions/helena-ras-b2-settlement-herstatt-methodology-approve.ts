// prototype/scripts/decisions/helena-ras-b2-settlement-herstatt-methodology-approve.ts
//
// Author: Helena (Chief Risk Officer, governance).
//
// CRO-seat ratification of the RAS RiskCluster-B2 settlement-window (Herstatt)
// exposure MEASUREMENT METHODOLOGY (FX gap #5 from the 2026-06-08 cross-domain
// FX review). Risk-appetite calibration is CRO authority per the decision-
// authority routing table — NOT CEO — and this ratification introduces NO new
// appetite threshold and NO change to the B2 limit (R100m absolute), so it does
// not cross the escalation guard into Board / RAS-Tier-1 territory. The CRO
// seat self-ratifies.
//
// What this script does (events-first; Principle 1 — the Decision event is
// canonical, the markdown is a render):
//   1. Files the methodology artefact via `recordFiled` → obtains its BLAKE3
//      document hash (RMS Phase 3 RecordFiled into the Documents register).
//   2. Records `Decision{phase:"approved", authority:"CRO"}` for
//      `D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY`, citing that document hash in
//      `sourceDocHashes` so the approved methodology is hash-pinned.
//
// Background: the prior `requested` card (recorded 2026-06-07 by the Rohan
// instrument) documented the gross window methodology but did NOT make the
// CLS-vs-non-CLS PvP determination, and the only `approved` phase present in the
// local home store was an ad-hoc `authoring-ui` "Approve" with rationale
// "Approve" and authority CEO — neither a proper CRO ratification nor backed by
// the methodology artefact. This script supersedes that with a CRO-authority
// approval hash-pinned to the full methodology (which adds the PvP treatment).
//
// Idempotent: skips the approval if an `approved` phase already exists that is
// hash-pinned to this artefact (sourceDocHashes contains the current hash). It
// will still (re)file the document — recordFiled is content-addressed and a
// repeat is a no-op put.
//
// Run once from prototype/, against the shared home store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/decisions/helena-ras-b2-settlement-herstatt-methodology-approve.ts
//
// Stays in the repo as an audit record.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../../platform/composition";
import { recordFiled } from "../../platform/records";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
import { recordDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../../");
const DOC_FILENAME = "docs/2026-06-08_helena_ras-b2-settlement-herstatt-exposure-methodology.md";
const DOC_PATH = resolve(WORKTREE_ROOT, DOC_FILENAME);

const body = readFileSync(DOC_PATH, "utf8");

// ── Step 1: file the methodology artefact (RMS Phase 3) → document hash ──────
const filed = recordFiled(
  {
    recordId: "record:documents:helena:ras-b2-settlement-herstatt-methodology:2026-06-08",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "COMPANIES-ACT-71-2008-S24",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      DECISION_ID,
      "D-RAS-B2-SETTLEMENT-EXPOSURE-FIX",
      "D-RAS-STRUCTURED-REGISTER",
      "urn:reg:bcbs:d226",
      "brief:helena:close-fx-gap-ratify-ras-b2-settlement-herstatt-m:2026-06-08",
    ],
    actor: { type: "service", id: "agent:helena:governance" },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "RAS B2 settlement-window (Herstatt) exposure — measurement methodology",
      path: DOC_FILENAME,
      category: "cro-ras-b2-settlement-methodology",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-06-08",
    },
  },
  clock.now(),
);

const methodologyHash = filed.documentHash;

// ── Step 2: record the CRO approval, hash-pinned to the artefact ─────────────
const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const existing = reg.byId.get(DECISION_ID);
const alreadyApprovedAtHash =
  existing?.events?.some(
    (e) =>
      e.phase === "approved" &&
      e.authority === "CRO" &&
      (e.sourceDocHashes ?? []).includes(methodologyHash),
  ) ?? false;

if (alreadyApprovedAtHash) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: "already-approved-at-hash",
        decisionId: DECISION_ID,
        methodologyHash,
        documentEventId: filed.eventId,
      },
      null,
      2,
    ),
  );
} else {
  const { eventId } = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CRO",
      authorityRef: "helena@bank-za.internal",
      title: "RAS B2 settlement-window (Herstatt) exposure — measurement methodology",
      category: "risk",
      recommendation:
        "RATIFY the RAS RiskCluster-B2 (credit risk — settlement exposure) measurement methodology hash-pinned in sourceDocHashes. DEFINITION: B2 measures principal settlement (Herstatt) risk — exposure from pay-leg irrevocability to receive-leg finality, when the bank has delivered one leg of an FX trade and not yet received the counter-leg. OPEN: PrincipalPayment{deliver} on a trade not yet SettlementConfirmed, OR FxSettlementFailed{one-leg-delivered, payLegDelivered}. AMOUNT: delivered-leg principal (gross). CLOSE: SettlementConfirmed. MEASUREMENT: per delivered-currency, ZAR-converted at <CCY>/ZAR vs the ZAR B2 limit; per-counterparty aggregation is the target breakdown (FO-1). CLS/PvP: settlement risk is ELIMINATED where both legs settle PvP via CLS (USD/EUR/GBP/JPY are clsEligible per correspondent-routing; ZAR is RTGS/SAMOS with no FX Herstatt window); non-CLS or CLS-eligible-but-bilateral windows are GROSS at-risk. B1 (pre-settlement 10% credit add-on) and B2 (post-delivery principal) cover disjoint windows — no double-count. LIMIT: R100m absolute, amber 0.70 / red 0.90 — UNCHANGED by this ratification.",
      rationale:
        "Closes FX review gap #5 (docs/2026-06-08_fx-functionality-domain-review.md). The B2 feeder was wired under D-RAS-B2-SETTLEMENT-EXPOSURE-FIX (CEO 2026-06-07) but the risk MEASUREMENT methodology was unratified, and the prior requested card omitted the CLS-vs-non-CLS PvP determination. This CRO ratification (a) adopts the gross window basis the feeder computes, (b) makes the CLS PvP treatment explicit (PvP-eligible windows offset to zero in target state; gross is the conservative interim basis because no full CLS PvP model exists in the build phase — it is NOT pretended to exist), and (c) records two non-blocking code follow-ons to Rohan (Risk engineer): FO-1 per-counterparty B2 breakdown; FO-2 CLS/PvP offset. Reconciliation against the wired feeder: all window/amount/close/per-currency/no-double-count elements MATCH; the only deltas are PvP-offset (FO-2) and per-cpty breakdown (FO-1), which are refinements over a conservative (over-stating) basis, not correctness defects. Risk-appetite calibration is CRO authority per the decision-authority routing table; the ratification introduces no new appetite threshold and no change to the B2 limit, so it does not cross the escalation guard into Board / RAS-Tier-1 territory — the CRO seat self-ratifies (no CEO escalation). The methodology artefact is hash-pinned via sourceDocHashes (Principle 1: the Decision event is canonical; the markdown is a render).",
      sourceDocHashes: [methodologyHash],
      citations: [
        "D-RAS-B2-SETTLEMENT-EXPOSURE-FIX",
        "D-RAS-STRUCTURED-REGISTER",
        "urn:reg:bcbs:d226",
        "P1-EVENTS-ARE-TRUTH",
        "P2-SINGLE-GRAPH-DISCIPLINE",
        "brief:helena:close-fx-gap-ratify-ras-b2-settlement-herstatt-m:2026-06-08",
      ],
      recordedVia: "scrooge:session-delegation",
      actor: { type: "service", id: "agent:helena:governance" },
    },
    clock.now(),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        decisionId: DECISION_ID,
        phase: "approved",
        authority: "CRO",
        decisionEventId: eventId,
        methodologyHash,
        documentEventId: filed.eventId,
        isNewDocument: filed.isNewDocument,
      },
      null,
      2,
    ),
  );
}
