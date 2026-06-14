// scripts/record-d-decimal-native-money-arithmetic.ts
//
// Records D-DECIMAL-NATIVE-MONEY-ARITHMETIC — Marc's in-session direction
// (2026-06-14) after asking "why is mtm still using integer cents internally".
//
// FINDING. The WS-MONEY-DECIMAL work to date (slices 1-2, Wave-2 emitter flip)
// is a BOUNDARY migration: decimal.js / Money<C> / MoneyWire live only at the
// codec and event-payload layer. Every reval / P&L / accounting engine still
// computes in integer minor units with FLOAT intermediates and Math.round
// (e.g. platform/markets/eod/bond-revaluation.ts:246 —
// `Math.round((nominalMinor * pricePercent) / 100 + accruedInterestMinor)`).
// ~40 engine files carry this pattern. The result encoded as MoneyWire is exact;
// the arithmetic that produced it is not. Float intermediates are non-associative
// and platform/order-dependent, which violates Principle 1's deterministic-replay
// guarantee for the bank's most-audited code (GL, trial balance, BA returns).
//
// WHY THE EARLIER "ENCODING-ONLY" OPTION WAS FALSE FOR THE CORE. Bea's Wave-2
// investigation (PR #1329) showed `SubLedgerLeg.amountMinor` threads through
// ~1,900 occurrences across ~268 files (SLA interpreter, every posting rule,
// trial-balance, GL projection, BA-300/400/700 renderers), and the PnL /
// ValuationAdjustment chains carry Zod `.refine` additive invariants that are
// themselves money arithmetic. You cannot re-encode `amountMinor` -> MoneyWire
// on that surface without rewriting the arithmetic that sums / reconciles the
// legs. For the load-bearing accounting surface, "encoding-only" and
// "decimal-native arithmetic" are the SAME change — so it must be done once,
// decimal-native, not as a cosmetic flip followed by an arithmetic pass.
//
// SUBSTRATE IS READY. platform/core/decimal-engine.ts exposes exact
// addD/subD/mulD/divD/roundDecimal with explicit HALF_UP|HALF_EVEN|DOWN|UP modes
// and fromMinorUnits/toMinorUnits; decimal-money.ts gives Money<C> with
// add/sub/sum/eq. This is an adoption problem, not a build problem — and it makes
// every quantisation an explicit, auditable rounding decision instead of an
// implicit Math.round on a float.
//
// MARC'S DECISION (2026-06-14): proceed decimal-native. Course of action:
//   1. Merge #1329 (MtmRunCompleted decimal-encoded; clean, zero-consumer).
//   2. gl-posting / SubLedgerLeg -> decimal-native, additive/strangler (add a
//      Money field alongside amountMinor; producers compute decimal-native and
//      a parity gate proves the decimal field reconciles with legacy amountMinor
//      during transition; migrate consumers in subsequent slices; then drop the
//      legacy field). This is the binding dependency for Wave 3 — until it lands,
//      the re-purge is undone on the next gl-posting tick.
//   3. Remaining emitters decimal-native: PnL chain, ValuationAdjustment / AVA,
//      CcrEadComputed (+ its own emits-MoneyWire assertion, since the *Minor gate
//      cannot see rc/pfe/ead), ManualJournalEntry.
//   4. New gate recon:no-float-money-arithmetic — forbids * / / / Math.round on
//      minor/Money values outside the decimal layer; introduced advisory with the
//      current surface allowlisted, ratcheting to enforce as engines migrate.
//   5. Wave 3 re-purge runs LAST, on the now-clean decimal-native store (still
//      gated on a final CEO go).
//
// This decision supersedes the boundary-only posture implicit in
// D-MONEY-DECIMAL-REDENOMINATION for the engine/arithmetic layer; the encoding
// and purge-remediation tracks (D-MONEY-DECIMAL-REDENOMINATION,
// D-MONEY-DECIMAL-PURGE-REMEDIATION) remain in force and are sequenced under it.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-MONEY-DECIMAL-REDENOMINATION;
// D-MONEY-DECIMAL-PURGE-REMEDIATION; Principle 1 (deterministic replay).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-14T06:05:00.000Z";
const APP = "2026-06-14T06:07:00.000Z";

const base = {
  decisionId: "D-DECIMAL-NATIVE-MONEY-ARITHMETIC",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Complete the decimal-money migration as decimal-native ENGINE ARITHMETIC, not a boundary flip: the reval/P&L/accounting engines compute in exact decimal (no float intermediates, no Math.round-to-cent), gate-enforced and staged, starting with the gl-posting SubLedgerLeg surface",
  category: "governance" as const,
  recommendation:
    "Proceed decimal-native. (1) Merge #1329 (MtmRunCompleted decimal-encoded). (2) Migrate the gl-posting SubLedgerLeg surface (~268 files) to decimal-native arithmetic using an additive/strangler approach: add a Money field alongside amountMinor, make the SLA interpreter and posting rules compute decimal-native via platform/core/decimal-engine with explicit rounding at each posting boundary, write MoneyWire at emit, and stand up a parity recon proving the decimal field reconciles with the legacy amountMinor through the transition; migrate consumers (trial-balance, GL projection, BA-300/400/700 renderers) in subsequent slices, then drop the legacy field. This is the binding dependency for the Wave-3 re-purge. (3) Migrate the remaining emitters decimal-native: the product-control PnL chain, ValuationAdjustment/PrudentValuationAva, CcrEadComputed (with its own emits-MoneyWire assertion since the residual-*Minor gate cannot see rc/pfe/ead), and ManualJournalEntry. (4) Introduce recon:no-float-money-arithmetic — an AST/lint gate forbidding multiply/divide/Math.round on minor or Money values outside the decimal layer — advisory with the current surface allowlisted, ratcheting to enforce as each engine migrates. (5) Run the Wave-3 re-purge LAST, on the clean decimal-native store, still gated on a final CEO go.",
  rationale:
    "decimal.js was adopted only at the codec/wire boundary; the engines still do integer-minor arithmetic with float intermediates and Math.round, so the exactness the decimal type promises is unrealised in the computation. For a regulated bank built on events-as-truth, float intermediates are a real correctness and auditability defect — non-associative, order- and platform-dependent — and they sit in the GL, trial balance, and regulatory returns. Bea's Wave-2 investigation showed the core accounting surface cannot be re-encoded without rewriting its arithmetic (SubLedgerLeg.amountMinor spans ~268 files; PnL/VA chains carry additive .refine invariants), so encoding-only is not actually available there: the choice is decimal-native or nothing. The decimal substrate already exists, the change is cheapest pre-licence (no live balances, no customer impact), and gating it makes the fix both safe and permanent. Leaving it as integer-cents-with-float would compound architectural debt on the most-audited code in the bank.",
  sourceDocHashes: [],
  citations: [
    "D-MONEY-DECIMAL-REDENOMINATION",
    "D-MONEY-DECIMAL-PURGE-REMEDIATION",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
