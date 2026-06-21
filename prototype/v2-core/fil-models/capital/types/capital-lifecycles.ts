// v2-core/fil-models/capital/types/capital-lifecycles.ts
//
// Capital FIL lifecycle declaration (D-CAPITAL-ASSET-CLASS-V1).
//
// `capital` is a first-class FIL asset class for the bank's OWN qualifying
// regulatory capital (CET1 / AT1 / Tier 2). A capital instrument is born `active`
// — the moment qualifying own-funds are issued / subscribed / recognised the
// instrument is live on the book and counts toward the BA-700 / BA-100 numerator.
// It terminates when the capital is redeemed / called / derecognised (the
// own-funds leave the book). The kernel stage VOCABULARY is fixed
// (`proposed | active | settled | matured | cancelled | terminated`), so the
// conceptual capital sub-states map onto it as:
//
//   subscribed / issued / recognised → kernel `active`   (live qualifying capital)
//   redeemed (AT1/T2 call)           |
//   matured (Tier 2 maturity)        | → kernel terminal (own-funds derecognised)
//   bought-back / cancelled (shares) |
//
// The discriminator between redeemed / matured / cancelled is the REALISING
// event (`via`), not a distinct kernel stage — exactly as the cash + FX
// lifecycles encode their terminal variants through the event ref. Capital
// recognised at a subscription / issuance is created `active` directly (it never
// sits in `proposed`); the `proposed → active` transition is admitted for capital
// created through an approval / instruction flow (e.g. a board-approved-but-
// unfunded share issue that funds later).
//
// Capital reuses the GENERIC FIL lifecycle event family
// (`FilInstrumentCreated` / `FilInstrumentAmended` / `FilInstrumentTerminated`,
// `v2-core/fil-instances/events.ts`) rather than minting parallel capital-only
// events (Engineering Charter cmd 4 — source, don't duplicate). The capital
// SPECIFICITY lives entirely in the typed `economicTerms.qualifyingCapital`
// dimension carried on those generic events.
//
// Authority: D-CAPITAL-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ENGINEERING-INTEGRITY-CHARTER; Reg 38; Banks Act §70; BCBS CAP.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { FilEventRef, FilLifecycleDeclaration } from "../../../fil-core/lifecycle.ts";

function ref(s: string): FilEventRef {
  return s as FilEventRef;
}

// `FilInstrumentCreated` realises the live qualifying-capital instrument
// (active). For a share subscription / AT1 / Tier 2 issuance the originating
// event is the capital-raise event of record; the FIL instance is created
// `active` directly. `FilInstrumentTerminated` (terminal stage `terminated` for a
// call / buy-back / cancellation, or `matured` for a Tier 2 maturity) derecognises
// the own-funds. `FilInstrumentAmended` re-stamps the carrying amount on a
// partial redemption or a Tier 2 amortisation step (the last 5 years before
// maturity, where qualifying Tier 2 amortises straight-line — the carrying amount
// the composition fold counts changes without the instrument terminating).
export const CAPITAL_INSTRUMENT_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "active",
  transitions: [
    // Admitted for capital created through an approval / instruction flow (rare).
    { from: "proposed", to: "active", via: ref("FilInstrumentCreated") },
    // In-life economic change — partial redemption / Tier 2 amortisation step.
    { from: "active", to: "active", via: ref("FilInstrumentAmended") },
    // Terminal derecognitions of live qualifying capital.
    { from: "active", to: "terminated", via: ref("FilInstrumentTerminated") },
    { from: "active", to: "matured", via: ref("FilInstrumentTerminated") },
    { from: "active", to: "cancelled", via: ref("FilInstrumentTerminated") },
  ],
};
