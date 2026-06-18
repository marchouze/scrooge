// scripts/record-d-fx-npa-restart.ts
//
// Records the CEO decision (Marc, session-delegation 2026-06-17) to RESTART the
// FX NPA (`prd:bank:fx:otc-vanilla`) from scratch — the accumulated attestation
// data is low-quality and self-contradictory and must be replaced by one clean,
// fully policy-compliant cycle, with every build-phase shortfall flagged as a
// tracked gap for the build roadmap.
//
// Why (the rubbish):
//   - Contradictory passes: npa-fx-legal-attestation.ts attests legal
//     `implementation-attested` while npa-fx-legal-conditions-post-withdrawal.ts
//     re-attests the same dimension `design-attested`; a `verification-pass-2`
//     accretion layer sits on top.
//   - Stale sourcing: accounting/prudential/tax reference the superseded v1
//     accounting spec rather than the versioned treatment modules
//     (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD).
//   - Placeholder/thin dimensions; a tangled lifecycle (approved → withheld only
//     enacted 2026-06-17 in PR #1419).
//
// The compliant restart mechanism (Principle 1 — append-only): there is no NPA
// cycle-id; the product register is latest-wins per (productId, dimension). A
// "from scratch" restart is therefore a single fresh, coherent cycle that
// SUPERSEDES the cruft — fresh ProductProposalRegistered -> ProductConceptualised
// -> 14 substantive ProductDimensionAttested -> ProductDueDiligenceCompleted ->
// gate (ProductApproved/ProductWithheld) — authored per PROC-MK-NPA-DD-01 +
// PROC-NPA-GATE-01 + NPA Policy v2. Prior events remain in the log; the clean
// cycle wins the projection.
//
// Build-phase posture (policy-compliant): per NPA Policy v2 Amendment A a
// dimension is `implementation-attested` ONLY with a GREEN completeness recon;
// Amendment B makes `design-attested` require a well-formed ProductDeferredGap
// (owner + targetTrigger + citations) and FATAL for production scope. In the
// build phase (no real counterparties / live feeds / external counsel / real
// capital) most dimensions honestly attest `design-attested` with a build-flagged
// gap; production approval is therefore NOT available — the gate yields
// internal-test scope (or withheld), with every production gap tracked for build.
//
// Authority: CEO (Marc, session-delegation 2026-06-17) — "the data in the NPA for
// FX is rubbish; restart the NPA from scratch; flag any gaps for build; comply
// with all policies and procedures."
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/record-d-fx-npa-restart.ts
//
// Author: Scrooge (Chief of Staff) — recording instrument for the CEO decision.

import { recordDecision } from "../runtime/decisions/record.ts";

const ts = new Date().toISOString();

const result = recordDecision(
  {
    decisionId: "D-FX-NPA-RESTART",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Restart the FX OTC vanilla NPA from scratch — one clean policy-compliant cycle, build gaps flagged",
    category: "governance",
    recommendation:
      "Restart the New Product Approval for prd:bank:fx:otc-vanilla from scratch. The accumulated attestation data is low-quality and self-contradictory (contradictory legal passes, a verification-pass-2 accretion layer, stale v1-accounting-spec sourcing, placeholder dimensions, a tangled approve→withhold lifecycle) and must be replaced by ONE clean, coherent NPA cycle authored in full compliance with NPA Policy v2 (D-NEW-PRODUCT-APPROVAL-POLICY-V2), PROC-MK-NPA-DD-01 (due diligence, 14 dimensions, owners), and PROC-NPA-GATE-01 (gate; Helena CRO / Camille CFO / Zara CCO / Imani GC composition). Mechanism (Principle 1, append-only; latest-wins per (productId, dimension)): emit a fresh ProductProposalRegistered -> ProductConceptualised -> 14 substantive ProductDimensionAttested -> ProductDueDiligenceCompleted -> gate decision; prior events remain in the log and the clean cycle supersedes them via the projection. Each dimension is attested HONESTLY: implementation-attested only where a GREEN completeness recon exists (Policy v2 Amendment A); otherwise design-attested carrying a well-formed ProductDeferredGap (owner + targetTrigger + citations, Amendment B) flagged for the build roadmap. Accounting / prudential / tax dimensions source from the versioned treatment modules (ifrs-classification:fx-fvtpl, posting-rules:fx, prudential-treatment:fx-trading-book, tax-treatment:fx) per D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD, not the retired v1 spec. Because design-attested is fatal for production scope (Amendment B), the build-phase gate outcome is internal-test scope (with the full tracked build-gap register) or withheld — NOT production approval. The contradictory pass-modules are retired from the codebase; npa-gate-integrity + npa-deferred-gap-tracking recon stay green; citation-gate clean. The consolidated FX NPA document is regenerated to reflect the clean cycle. This decision does not pre-empt the gate outcome — the gate is run per procedure on the honest attestations.",
    rationale:
      "Marc directed in-session (2026-06-17): 'the data in the NPA for FX is rubbish; restart the NPA from scratch; flag any gaps for build; comply with all policies and procedures.' Diagnosis confirmed the data is structurally unsound: npa-fx-legal-attestation.ts (implementation-attested) directly contradicts npa-fx-legal-conditions-post-withdrawal.ts (design-attested) for the same dimension; multiple verification passes accreted; accounting/prudential/tax cite a v1 accounting spec superseded by the modular treatment menu; the withdrawal documented 2026-06-15 was only enacted 2026-06-17 (PR #1419). A clean restart that supersedes the cruft via a single coherent cycle is the only way to a trustworthy, policy-compliant NPA record. The append-only restart mechanism (fresh cycle, latest-wins projection) preserves the full audit trail (Principle 1) while making the current state honest and coherent. Flagging every build shortfall as a tracked ProductDeferredGap operationalises Engineering Charter command 5 (no silent deferral) and NPA Policy v2 Amendment B.",
    sourceDocHashes: [],
    citations: [
      "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
      "D-NPA-GATE-POLICY-REDESIGN",
      "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
      "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
      "D-ENGINEERING-INTEGRITY-CHARTER",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ts,
);

console.log(JSON.stringify({ decision: result.eventId }, null, 2));
