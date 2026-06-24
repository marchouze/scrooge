// scripts/record-d-fx-instrument-buysell-quad.ts
//
// Records D-FX-INSTRUMENT-BUYSELL-QUAD — Marc's in-session approval (2026-06-24)
// that an FX trade IS an agreement to buy one currency and sell another on a
// settlement date, so the DURABLE FX instrument must natively carry the
// symmetric quad {Buy Amount, Buy Currency, Sell Amount, Sell Currency,
// Settlement Date} — not only the single SA-CCR `notional` + `direction` it
// carries today (filEconomicTermsSchema). And that PROVENANCE must be part of
// every instrument/event, with the already-approved FIL fail-closed harden
// (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN) FINISHED FIRST.
//
// Scope approved:
//   (A) Enrich `filEconomicTermsSchema` with an OPTIONAL, born-V2, additive FX
//       agreement block (`fxAgreement: { buy: Money, sell: Money }`; currency
//       lives inside Money; `settlementDate` already present). A `.superRefine`
//       coherence check ties the quad to `notional`/`direction` (notional = the
//       bank's bought-leg magnitude; direction from the buy/sell side; both
//       currencies are the pair's two). Populate it at the booking site
//       (book-affirmed-fx-trade.ts), threading the currently-dropped counter
//       leg from the upstream FxTradeExecuted legs through AffirmedFxTrade.
//       Surface it on the FIL state read-model (FilInstanceRow) so consumers
//       read the quad from the state surface (D-FIL-CONSUMER-SURFACE-ARCHITECTURE),
//       never from raw FilInstrument* replay. `notional`/`direction` become
//       DERIVED from the quad. A fail-closed recon gate
//       (recon:fx-agreement-quad-integrity) asserts every `fx`-asset-class
//       instance carries `fxAgreement` at cutover — mirroring the `cash`
//       originating-instrument fail-closed pattern. Replay-safe (optional ⇒
//       existing events parse unchanged); born-V2 (no new v1-only types;
//       ratchet held).
//   (B) FIRST, finish the dropped FIL fail-closed tail of
//       D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN: FIL emit helpers thread an
//       EXPLICIT provenance tag (no reliance on defaultProvenanceFor's
//       governance→production soft-default), and a FIL-scoped fail-closed recon
//       gate bites now WITHOUT flipping the global BANK_PROVENANCE_SUBSTRATE_ACTIVE
//       gate (build-phase soft-tag default retained; global flip is a follow-on).
//
// Settlement TRIGGER is explicitly OUT of scope for now: the existing
// confirmation-gated, fail-closed settle-fx-leg seam (FxSimSettlementConfirmed)
// is the correct extension point for richer "pay-once-received"/PvP conditions
// later; keep it simple now.
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants so the
// ci:migrate replay is byte-stable. Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing principal.
// Engineering build decision in the build phase → CEO authority, `engineering`
// category (decision-authority-routing table).
//
// Authority: CLAUDE.md §"Session delegation"; D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL;
//   D-FIL-CONSUMER-SURFACE-ARCHITECTURE; D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN;
//   D-CASH-ASSET-CLASS-V1; D-V2-CORE-MONEY-DECIMAL-NATIVE; D-ENGINEERING-INTEGRITY-CHARTER.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

// Fixed instants so the ci:migrate replay is byte-stable. The decision-symmetry
// recon gate requires every closed decision to carry a `requested` phase before
// its terminal phase (D-DECISIONS-FRAMEWORK-REDESIGN) — emit both.
const REQUESTED = "2026-06-24T08:55:00.000Z";
const APPROVED = "2026-06-24T09:00:00.000Z";

const base = {
  decisionId: "D-FX-INSTRUMENT-BUYSELL-QUAD",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "FX instrument carries the symmetric buy/sell quad; finish the FIL provenance fail-closed harden first",
  category: "engineering" as const,
  recommendation:
    "Enrich filEconomicTermsSchema with an optional, born-V2, additive FX agreement block (fxAgreement: { buy: Money, sell: Money }; currency inside Money; settlementDate already present), with a .superRefine coherence check tying the quad to notional/direction (notional = bank's bought-leg magnitude; direction from buy/sell side; both currencies are the pair's two). Populate it at book-affirmed-fx-trade.ts by threading the currently-dropped counter leg from the upstream FxTradeExecuted legs through AffirmedFxTrade, surface it on FilInstanceRow (read from the FIL state surface, not raw replay — D-FIL-CONSUMER-SURFACE-ARCHITECTURE), make notional/direction derived from the quad, and add a fail-closed recon:fx-agreement-quad-integrity gate asserting every fx-asset-class instance carries fxAgreement at cutover (mirroring the cash originating-instrument pattern). Sequence the provenance work FIRST: complete the dropped FIL fail-closed tail of D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN so FIL emit helpers thread an explicit provenance tag (no governance→production soft-default reliance) and a FIL-scoped fail-closed recon gate bites now WITHOUT flipping the global BANK_PROVENANCE_SUBSTRATE_ACTIVE gate (build-phase soft-tag default retained). The settlement trigger stays the existing confirmation-gated fail-closed seam — keep it simple now. All work born-V2, additive, replay-safe; v1-removal ratchet held.",
  rationale:
    "An FX spot is fundamentally an agreement to buy one currency and sell another on a settlement date, yet the durable FIL instrument reduces this to a single positive notional + direction (the SA-CCR risk shape): the counter leg is dropped at the booking site (book-affirmed-fx-trade.ts computes notional from baseNotionalMajor and discards the counter amount). The two sides survive only on the capture event (FxTradeExecuted legs) and the settlement events (boughtSettled/soldSettled), so the instrument's own terms cannot answer 'what did we buy and sell' without joining other events — under-serving the model's own canonical statement of what an FX trade is. Carrying the quad natively (with notional/direction derived) makes the instrument self-describing and keeps the SA-CCR shape coherent. Separately, Marc reaffirmed that provenance must be part of every instrument/event; today provenance is a tagging layer with the hard-reject gate off, so FIL events fall open to a governance→production soft-default rather than carrying an explicit tag. The approved-but-incomplete D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN already scoped the FIL fail-closed tail (its run died before completing); finishing it first gives a clean explicit-provenance basis on which the new quad-carrying events are born.",
  sourceDocHashes: [],
  citations: [
    "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL",
    "D-FIL-CONSUMER-SURFACE-ARCHITECTURE",
    "D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN",
    "D-CASH-ASSET-CLASS-V1",
    "D-V2-CORE-MONEY-DECIMAL-NATIVE",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

// Symmetric phase chain: requested → approved (idempotent on the fixed instants).
requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-FX-INSTRUMENT-BUYSELL-QUAD" },
    null,
    2,
  ),
);
