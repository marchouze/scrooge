// v2-core/fil-models/cash/types/cash-lifecycles.ts
//
// Cash FIL lifecycle declaration (D-CASH-ASSET-CLASS-V1).
//
// `cash` is a first-class FIL asset class, SEPARATE from `fx`. A cash balance
// is born `active` (it is a live, HELD balance on the book) and terminates to
// `settled` when it is drawn-down, swept, or closed (the cash leaves the book
// via a payment / sweep / account closure). The kernel stage VOCABULARY is
// fixed (`proposed | active | settled | matured | cancelled | terminated`), so
// the conceptual cash sub-states map onto it as:
//
//   held       → kernel `active`     (a live monetary balance on the book)
//   drawn-down |
//   swept      | → kernel `settled`  (the balance leaves the book; terminal)
//   closed     |
//
// The discriminator between drawn-down / swept / closed is the REALISING event
// (`via`), not a distinct kernel stage — exactly as the FX lifecycles encode
// "settled vs cash-settled" through the event ref. A cash balance recognised at
// settlement of an FX trade is created `active` directly (it never sits in
// `proposed`); the `proposed → active` transition is admitted for cash created
// through a proposal flow (e.g. an instructed-but-unfunded balance).
//
// Authority: D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ENGINEERING-INTEGRITY-CHARTER.
// brief: brief:atlas:cash-as-a-first-class-fil-asset-class-fx-maturit:2026-06-17
// Author: Atlas (Core banking platform architect, engineering).

import type { FilEventRef, FilLifecycleDeclaration } from "../../../fil-core/lifecycle.ts";

function ref(s: string): FilEventRef {
  return s as FilEventRef;
}

// `CashBalanceRecognised` realises the held balance (active). For an FX-settled
// cash leg the originating event is the FX `SettlementConfirmed`; the FIL
// instance is created `active` directly. `CashBalanceDrawnDown` / `…Swept` /
// `…Closed` are the three terminal realisations (all → `settled`).
export const CASH_BALANCE_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "active",
  transitions: [
    // Admitted for cash created through a proposal/instruction flow (rare).
    { from: "proposed", to: "active", via: ref("CashBalanceRecognised") },
    // The three terminal realisations of a held balance.
    { from: "active", to: "settled", via: ref("CashBalanceDrawnDown") },
    { from: "active", to: "settled", via: ref("CashBalanceSwept") },
    { from: "active", to: "settled", via: ref("CashBalanceClosed") },
  ],
};
