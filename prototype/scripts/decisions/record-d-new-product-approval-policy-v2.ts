// scripts/decisions/record-d-new-product-approval-policy-v2.ts
//
// Records D-NEW-PRODUCT-APPROVAL-POLICY-V2 — Marc's in-session approval
// (2026-06-08, "proceed") to amend the New Product Approval Policy to v2.
//
// WHY (the diagnosis this amendment fixes). The FX-spot NPA gate
// (`scripts/run-npa-gate-fx-spot.ts`, product `prd:bank:fx:fx-spot-usdzar`,
// internal-test scope) DID fire and was honest: it recorded several material
// dimensions as `design-attested` (not `implementation-attested`) with
// "deferred to commencement-of-trading / re-activation trigger" narratives.
// Yet the FX functionality domain review
// (`docs/2026-06-08_fx-functionality-domain-review.md`) found real gaps WITHIN
// the approved FX product that the v1 policy + the
// `platform/recon/product-approval-attestation-integrity.ts` recon allow to
// pass silently:
//
//   1. Design-attested-and-deferred is never forward-tracked or re-gated.
//      The attestation-integrity recon only blocks on `result:"failed"`;
//      `design-attested` passes. A product is `ProductApproved` with material
//      dimensions merely *designed*, the deferral promises live only in
//      narrative, and nothing carries them into the gap register or blocks a
//      future PRODUCTION fire until they are live. (→ VaR-cadence, FinSurv
//      stayed open — review §8 G5.1 / G5.2 / G8.x.)
//   2. Checklist coverage holes. v1 Item 7 says "captured in ALL relevant
//      BA-series returns" but the gate operationalised only the LCR subscriber
//      — NO dimension for the BA-310 FX-NOP market-risk return. Not failed;
//      never a check. (And v1 cites stale "BA-325 LCR" — superseded by
//      D-BA-RETURN-FORM-NUMBERING-RECON: FX NOP rides BA-310 / BA-110, there is
//      no BA-320/325.)
//   3. Out-of-approved-scope, silently absorbed by a fallback. The NPA
//      approved fx-spot USD/ZAR ONLY; EUR/GBP/JPY/CHF/AUD were never in scope,
//      yet the sim booked them and suspense `ACC-2100-007` silently absorbed
//      them instead of the pre-trade gate rejecting out-of-scope trades
//      (review §2 / §8 unresolved-currency suspense).
//
// WHAT v2 CHANGES (four amendments):
//   A. `implementation-attested` must cite liveness EVIDENCE, not assertion: a
//      production-required dimension may be attested live ONLY if it cites a
//      GREEN completeness recon proving the capability is wired / exercised /
//      complete across the product's full declared scope (e.g. Item 3 GL CoA →
//      `recon:fx-supported-currency-no-suspense`, PR #1101; Item 7 reg
//      reporting → a BA-310 submission-completeness check, Mira wiring; Item 8
//      valuation → the VaR freshness watchdog `expected-event-watchdog`,
//      Rohan, PR #1102). The NPA gate is the POINT-IN-TIME consumer of the
//      `recon:completeness:*` substrate Vera is spec'ing under
//      WS-COMPLETENESS-AUDIT / D-COMPLETENESS-AUDIT-WORKSTREAM (Vera's standing
//      audit is the CONTINUOUS consumer); v2 references it, does not duplicate.
//   B. Forward-track every deferral + production re-gate: each `design-attested`
//      dimension MUST auto-create a tracked gap-register obligation
//      (`SubstrateGap` / `platform/substrate/gap-register.ts`) carrying its
//      re-activation trigger; and the PRODUCTION NPA fire MUST be blocked until
//      every production-required dimension is `implementation-attested`.
//      `design-attested` is acceptable ONLY for internal-test scope; fatal for
//      a production `ProductApproved`.
//   C. Close the coverage holes: Item 7 ENUMERATES the specific returns each
//      product class touches (FX → BA-310 NOP + BA-110 daily-return NOP
//      attestation + LCR); all stale BA-325 citations refreshed to
//      BA-310 / BA-110 per D-BA-RETURN-FORM-NUMBERING-RECON.
//   D. No silent out-of-scope absorption: a trade outside the approved product
//      scope (currency / tenor / leg-type) MUST be rejected at the pre-trade
//      gate (Item 9), never absorbed by a GL suspense / default; Item 3 gains a
//      full-scope completeness requirement (every currency / leg in declared
//      scope provisioned to dedicated accounts, none in a catch-all).
//
// Saskia (Head of Global Markets, governance) is the policy owner; Owen
// (Company Secretary, governance) co-authors the governance-event-authoring +
// register perspective. Engineering follow-ons are NAMED (not built) here:
// the attestation-integrity recon upgrade → Vera; the per-item
// completeness-gate bindings → Vera's WS-COMPLETENESS-AUDIT backlog.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-08; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Governance
// category (CORPORATE-BIND policy amendment; governance / procedure register
// per the decision-authority-routing table — CoSec/CEO).
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill)
// dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Saskia (Head of Global Markets, governance) + Owen (Company
// Secretary, governance).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-08T11:14:00.000Z";
const ASOF = "2026-06-08T11:15:00.000Z";

const TITLE = "New Product Approval Policy v2 — bind attestation to liveness, forward-track deferrals, close coverage holes";

const CITATIONS = [
  // The diagnosis source.
  "docs/2026-06-08_fx-functionality-domain-review.md",
  // The policy being amended.
  "Policies/new-product-approval-policy-v1.md",
  // BA-form numbering authority that supersedes the stale BA-325 citations.
  "D-BA-RETURN-FORM-NUMBERING-RECON",
  // Single-graph discipline — every checklist item traces to a citable recon.
  "Principles/2-single-graph-discipline.md",
];

const RECOMMENDATION =
  "Amend the New Product Approval Policy v1 to v2 with four binding changes: " +
  "(A) a production-required checklist dimension may be `implementation-attested` " +
  "ONLY if it cites a GREEN completeness recon proving the capability is wired, " +
  "exercised, and complete across the product's full declared scope (Item 3 GL " +
  "CoA -> recon:fx-supported-currency-no-suspense; Item 7 reg reporting -> a " +
  "BA-310 submission-completeness check; Item 8 valuation -> the VaR freshness " +
  "watchdog expected-event-watchdog) — the NPA gate is the point-in-time " +
  "consumer of the recon:completeness:* substrate Vera is spec'ing under " +
  "WS-COMPLETENESS-AUDIT; (B) every `design-attested` dimension MUST auto-create " +
  "a tracked gap-register obligation carrying its re-activation trigger, and a " +
  "PRODUCTION ProductApproved MUST be blocked until every production-required " +
  "dimension is `implementation-attested` (`design-attested` acceptable only for " +
  "internal-test scope; fatal for production); (C) Item 7 enumerates the specific " +
  "BA-series returns each product class touches (FX -> BA-310 NOP + BA-110 " +
  "daily-return NOP attestation + LCR) and all stale BA-325 citations refresh to " +
  "BA-310 / BA-110 per D-BA-RETURN-FORM-NUMBERING-RECON; (D) a trade outside the " +
  "approved product scope (currency / tenor / leg-type) MUST be rejected at the " +
  "Item-9 pre-trade gate, never absorbed by a GL suspense / default, and Item 3 " +
  "gains a full-scope completeness requirement (every currency / leg in the " +
  "declared scope provisioned to dedicated accounts, none in a catch-all). " +
  "Update Procedures/by-policy/npa-gate.md consistently. Engineering follow-ons " +
  "are NAMED (Scrooge routes): the product-approval-attestation-integrity recon " +
  "upgrade -> Vera; per-item completeness-gate bindings -> Vera's " +
  "WS-COMPLETENESS-AUDIT backlog.";

const RATIONALE =
  "The FX-spot NPA gate fired honestly and recorded several material dimensions " +
  "as `design-attested` with deferral narratives, yet the FX functionality " +
  "domain review found real gaps WITHIN the approved product because the v1 " +
  "policy and the product-approval-attestation-integrity recon let three " +
  "weaknesses pass silently: (1) design-attested-and-deferred is never " +
  "forward-tracked or re-gated — the recon only blocks on result:failed, so " +
  "deferral promises live only in narrative and nothing blocks a future " +
  "PRODUCTION fire until they are live (VaR-cadence, FinSurv stayed open); " +
  "(2) checklist coverage holes — v1 Item 7 asserts 'all relevant BA-series " +
  "returns' but no dimension exists for the BA-310 FX-NOP return (not failed, " +
  "never a check) and v1 cites a stale 'BA-325 LCR' superseded by " +
  "D-BA-RETURN-FORM-NUMBERING-RECON; (3) out-of-approved-scope trades " +
  "(EUR/GBP/JPY/CHF/AUD, never in the USD/ZAR-only approved scope) were " +
  "silently absorbed by suspense ACC-2100-007 instead of being rejected at the " +
  "pre-trade gate. v2 binds attestation to liveness evidence, forward-tracks " +
  "every deferral into the gap register with a production re-gate, enumerates + " +
  "refreshes the reporting citations, and forbids silent out-of-scope " +
  "absorption — restoring single-graph discipline (Principle 2: every checklist " +
  "item traces to a citable, green completeness recon). Approved in-session " +
  "2026-06-08.";

const FOLLOW_ON = [
  {
    route: "Upgrade recon:product-approval-attestation-integrity (Vera)",
    note:
      "platform/recon/product-approval-attestation-integrity.ts currently blocks " +
      "only on result:'failed'. Upgrade so a PRODUCTION ProductApproved requires " +
      "ALL production-required dimensions `implementation-attested` " +
      "(design-attested -> fatal for production scope; acceptable only for " +
      "internal-test scope), and so each design-attested dimension has a backing " +
      "tracked gap-register obligation (platform/substrate/gap-register.ts) " +
      "carrying its re-activation trigger. Route to Vera (Internal audit / " +
      "continuous-assurance engineer) — keep aligned with WS-COMPLETENESS-AUDIT.",
  },
  {
    route: "Per-item completeness-gate bindings (Vera, WS-COMPLETENESS-AUDIT)",
    note:
      "Bind each production-required checklist item to the specific " +
      "recon:completeness:* gate that evidences it: Item 3 (GL CoA) -> " +
      "recon:fx-supported-currency-no-suspense (PR #1101); Item 7 (reg reporting) " +
      "-> a BA-310 submission-completeness check (Mira, Compliance/RegTech " +
      "engineer); Item 8 (valuation) -> the VaR freshness watchdog " +
      "expected-event-watchdog (Rohan, Risk engineer, PR #1102). Coordinate with " +
      "Vera's WS-COMPLETENESS-AUDIT / D-COMPLETENESS-AUDIT-WORKSTREAM backlog so " +
      "the NPA gate (point-in-time consumer) and Vera's standing audit " +
      "(continuous consumer) read the same completeness substrate.",
  },
];

// Open the decision lifecycle with a `requested` phase so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
requestDecision(
  {
    decisionId: "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: "Plan approved in-session 2026-06-08; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    citations: CITATIONS,
    followOnDispatch: FOLLOW_ON,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify(
    { ok: true, eventId: result.eventId, decisionId: "D-NEW-PRODUCT-APPROVAL-POLICY-V2" },
    null,
    2,
  ),
);
