// scripts/record-d-acct-modular-product-composed-fold.ts
//
// Records the CEO decision (Marc, session-delegation 2026-06-17) that
// supersedes/expands the deferred D-ACCT-POSTING-PROJECTION-MIGRATION for the
// V2 side: accounting becomes a PRODUCT-COMPOSED, MODULAR FOLD.
//
// Decided this session, across a chain of Scrooge-asked questions Marc
// answered explicitly:
//   1. Accounting determination (IFRS / prudential / tax) is canonical at the
//      approved Product (NPA) — but expressed as a MODULAR COMPOSITION: a
//      product "picks from a menu" of (a) FIL instruments (`filTypeScopes`,
//      already present) and (b) reporting-treatment modules
//      (`reportingTreatmentModuleIds`, new) — reusable, versioned, cited units
//      covering IFRS classification, prudential book, tax, and disclosure.
//   2. The FIL native stays product-agnostic (economic terms only). FIL-native
//      <-> product is many-to-many, so the native cannot carry a product ref.
//   3. The product binding lives on the ORIGINATING TRADE, NPA-gated. The FIL
//      instance resolves treatment via originatingEvent -> trade.productId ->
//      product -> picked treatment modules @ version.
//   4. Accounting is a PURE FOLD over (FIL economic terms x product-composed
//      treatment modules@version x per-instance elections x posting rules@
//      version) — NO stored posting event. `GlPostingEmitted` is eliminated
//      (per asset class), the per-trade `IfrsClassificationApplied`
//      re-derivation is retired; both close the irreducibility gap.
//   5. The V2-side build is AUTHORISED NOW; the V1 side
//      (`SubLedgerPostingEmitted`, V1 engines) remains deferred and tracked
//      under D-ACCT-POSTING-PROJECTION-MIGRATION (NOT superseded here).
//   6. Inter-dependencies are minimised: a small shared substrate lands once,
//      then each asset class is an independent vertical. FX is developed
//      "in test" under a `simulated` provenance scenario — isolated from
//      bond/capital, excluded from production folds, and cleanly cancellable/
//      reversible (reclassifyProvenance / :memory: scratch store).
//
// Authority: CEO (Marc, session-delegation 2026-06-17), via approval of the
// plan at ~/.claude/plans/reactive-watching-pike.md.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/record-d-acct-modular-product-composed-fold.ts
//
// Author: Scrooge (Chief of Staff) — recording instrument for the CEO decision.

import { recordDecision } from "../runtime/decisions/record.ts";

const ts = new Date().toISOString();

const result = recordDecision(
  {
    decisionId: "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Accounting as a product-composed, modular fold — V2 (un-defers the V2 side of D-ACCT-POSTING-PROJECTION-MIGRATION)",
    category: "engineering",
    recommendation:
      "Adopt accounting as a product-composed, modular fold for V2, and authorise the V2-side build now. (1) The accounting determination (IFRS classification, prudential book, tax treatment, disclosure lenses) is canonical at the approved Product (NPA), expressed as a MODULAR COMPOSITION: a product picks from a menu of FIL instruments (filTypeScopes, already present) and a new menu of reporting-treatment modules (reportingTreatmentModuleIds) — reusable, versioned, cited units modelled on the FIL-models declaration/registry pattern. (2) The FIL native stays product-agnostic (economic terms only); FIL-native<->product is many-to-many, so the native carries no product reference. (3) The product binding lives on the originating trade, NPA-gated (a required approved productId on the trade; booking under an unapproved product is refused); the FIL instance resolves its treatment via originatingEvent -> trade.productId -> product -> picked treatment modules@version. (4) Accounting is a pure fold over (FIL economic terms x product-composed treatment modules@version x per-instance elections x posting rules@version) with NO stored posting event: GlPostingEmitted is eliminated per asset class and the per-trade IfrsClassificationApplied re-derivation is retired, closing the irreducibility gap at both the posting and classification layers. (5) Inter-dependencies are minimised — a small shared substrate (treatment registry + product pick-field + resolver + booking binding) lands once, then each asset class is an independent vertical; FX goes first and is developed in test under a simulated provenance scenario, isolated from bond/capital, excluded from production folds, and cleanly cancellable/reversible via reclassifyProvenance or a :memory: scratch store. The shared GlPostingEmitted event type is retired only as a final, gated step once recon confirms zero producers across all families (append-only: existing rows retained cold). The single legitimate materialisation point remains the close-time TrialBalanceSnapshotted. The V1 side (SubLedgerPostingEmitted, V1 engines) remains DEFERRED and tracked under D-ACCT-POSTING-PROJECTION-MIGRATION; this decision does NOT supersede it.",
    rationale:
      "Marc challenged, across this session, the premise that accounting is a function of the FIL instance/trade and drove it to a precise model. Investigation confirmed: (a) Phase 3A (PR #1376) minted GlPostingEmitted as a NEW stored derived event one day before D-DERIVED-EVENT-IRREDUCIBILITY-TEST was approved — reproducing exactly the fold-wearing-an-event's-clothes anti-pattern that decision condemns; (b) the binding IFRS determination is today re-derived per-trade by Bea's rule engine (runtime/agents/bea-m1-ifrs-classification-rules.ts) from trade-event fields, so IfrsClassificationApplied is itself a fold masquerading as a decision, while the approved product carries only a static ifrs9Family label (v2-core/banking/events.ts); (c) FIL-native<->product is many-to-many (five seed products already claim fil:type:funding:deposit.money-market:*) with no uniqueness constraint, so the native type alone cannot resolve treatment and the binding must be captured at the commercial act (the NPA-gated trade), not on the product-agnostic native; (d) the FIL-models declaration/registry (v2-core/fil-models/) is a proven, reusable pattern for a treatment menu, and the four V2 GL engines are cleanly separable per asset class, so FX can be migrated independently of bond/capital; (e) the provenance substrate (production|simulated|build-phase-fixture with the operating-book default filter, plus reclassifyProvenance and :memory: scratch stores) already supports isolated, reversible in-test development. The model makes the genuine accounting decisions first-class (treatment-module declarations; the product's NPA pick of FIL menu + treatment menu; the trade's product binding; per-instance elections) and lets everything downstream fold, satisfying Principle 1 (events-as-truth) and Principle 2 (single-graph: outcome -> posting fold -> product accounting policy -> regulation).",
    sourceDocHashes: [],
    citations: [
      "D-DERIVED-EVENT-IRREDUCIBILITY-TEST",
      "D-ACCT-POSTING-PROJECTION-MIGRATION",
      "D-ENGINEERING-INTEGRITY-CHARTER",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ts,
);

console.log(JSON.stringify({ decision: result.eventId }, null, 2));
