// prototype/scripts/record-fx-held-dims-seat-sweep.ts
//
// One-shot: record CEO session-delegated approval (plan approval, 2026-06-11)
// of the next OTC Vanilla FX arc — the held-dimension seat sweep + quick-win
// deferred-gap closures. Plan: ~/.claude/plans/plan-next-soft-pony.md.
//
// Six dispatches under WS-FX-OTC-NPA:
//   Batch A (parallel): infosec→Rashida (CISO) threat-model ratification;
//     privacy→Iris (IO) DSAR substrate; quick-win fx-sa-ccr-daily-cadence→
//     Rohan; quick-win fx-best-execution-policy-schedule→Zara (CCO).
//   Batch B (sequential — both touch dashboard/markets-fx-gateway.ts):
//     legal→Imani (Legal-as-code engineer, Devon/COO interim governance) ISDA
//     pre-trade gate; then op-risk→Tomas (Operations & payments engineer,
//     Devon/COO governance) loss-event capture + identity-check enforcement.
//
// Parked, named: tax dim (revenue-start precedent bank-wide, Yael paused);
// Option/M5 (separate workstream, ~10 dims reopen); licence-day gaps.
//
// Target: 12/14 implementation-attested or honest holds; residuals as tracked
// ProductDeferredGap entries; promote only on code evidence.
//
// Authority: CEO (Marc), in-session plan approval 2026-06-11.
// Author: Scrooge (Chief of Staff)

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-11T12:00:00.000Z";

const result = recordDecision(
  {
    decisionId: "D-FX-HELD-DIMS-SEAT-SWEEP",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "OTC Vanilla FX — held-dimension seat sweep (infosec/privacy/legal/op-risk to owning seats) + quick-win deferred-gap closures (SA-CCR cadence, best-execution policy schedule)",
    category: "product",
    recommendation:
      "Dispatch six runs under WS-FX-OTC-NPA: Rashida (CISO) threat-model ratification + infosec attestation; Iris (IO) DSAR substrate + privacy attestation; Rohan closes fx-sa-ccr-daily-cadence (scheduled-handler registration); Zara (CCO) closes fx-best-execution-policy-schedule (event type + conduct-committee publish); Imani (Legal-as-code engineer) wires the LegalDocumentationSigned pre-trade gate + opinion-refresh watchdog + legal attestation; Tomas (Operations & payments engineer) builds OperationalLossEvent capture + enforces the gateway identity check + op-risk attestation. Legal and op-risk runs serialized (shared gateway file). Tax and Option/M5 stay parked.",
    rationale:
      "9/14 dimensions implementation-attested after this session's arc. Exploration grounded each held dimension: infosec substrate is complete and awaits the CISO's seat ratification; privacy lacks only the DSAR workflow; legal has events + projection but no order-path gate; op-risk's loss-event capture is buildable while op-RWA stays honestly gross-income-blocked; tax is blocked bank-wide by the revenue-start precedent. Two deferred gaps have build-phase triggers satisfiable now. Promote only on code evidence; honest holds acceptable.",
    sourceDocHashes: [],
    citations: [
      "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
      "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
    ],
    recordedVia: "scrooge:session-delegation",
    actor: { type: "human", id: "marc@tgv.co.za" },
  },
  AS_OF,
);

console.log(`✓ D-FX-HELD-DIMS-SEAT-SWEEP → approved (eventId: ${result.eventId})`);
