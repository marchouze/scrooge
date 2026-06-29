// scripts/file-nadia-fx-settlement-lane4b-validation-report.ts
//
// One-shot RMS Phase 3 filing for Nadia's Lane-4b independent second-line
// validation of the FX SETTLEMENT lifecycle (book → settle → derecognition) on the
// manual born-V2 path (Kai, PR #1614). Emits:
//   1. RecordFiled(documents) — the canonical validation report (per-claim PASS/
//      FAIL + the clearing-account domain-truth ruling + updated end-to-end verdict).
//   2. ValidationFindingRaised(medium) — the clearing-account treatment finding
//      (the standing in-flight balance is a design smell, NOT the domain-correct
//      PvP-deliverable-spot treatment). Second-line raises it; does NOT fix Kai's
//      code (independence).
// Idempotent — skips whichever is already present.
//
// Authority: D-FX-SETTLEMENT-REALISATION-V1; D-FX-E2E-CORRECTNESS-V1; D-RMS-PHASE-3.
// Author: Nadia (Independent-validation engineer, second line — validation, risk).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { makeValidationFindingRaised } from "../platform/event-store/event-types/model-risk";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:fx-settlement-lane4b-validation-report:2026-06-29";
const FINDING_ID = "finding:nadia:fx-settlement-clearing-account-standing-balance:2026-06-29";

const body = `# FX settlement-lifecycle independent validation report (Lane 4b) — book → settle → derecognition, with an adversarial ruling on the clearing-account treatment

**Author:** Nadia (Independent-validation engineer, second line — validation, risk, market-risk, credit-risk)
**Date:** 2026-06-29
**Authority:** D-FX-SETTLEMENT-REALISATION-V1 (CEO-approved)
**Brief:** brief:nadia:lane-4b-independent-proof-of-fx-settlement-lifec:2026-06-29
**Run:** run:nadia:2026-06-29T07-52-19-201Z
**Subject of validation:** Kai's Lane 4a — \`settleManualFxTrade()\` + \`POST /api/trades/settle\` (PR #1614, merged)
**Deliverable:** \`prototype/tests/fx-e2e-settlement-derecognition.test.ts\` (golden settlement proof, 11 tests, green)

## Mandate

Independent, ADVERSARIAL second-line proof that the FX lifecycle is correct THROUGH
SETTLEMENT (not merely through booking/reval, which Lane 3 proved). Do NOT confirm
Kai's claims — try to BREAK them, and in particular adversarially test the
clearing-account treatment against the domain-truth oracle (IAS 21 / IFRS 9 /
standard bank FX settlement accounting), not internal consistency.

## Specimen

| Field | Value |
|---|---|
| Trade | BUY USD 1,000,000 / SELL ZAR @ 18.50 (= ZAR 18,500,000) |
| Counterparty | onboarded ZA-resident bank → authorised-dealer |
| Trade / value date | 2026-06-15 / 2026-06-17 (BACKDATED ⇒ settles immediately) |
| Settle as-of | 2026-06-20 (value date passed) |
| Provenance | \`simulated\` / \`operator:manual-desk-booking\` (booking == settlement partition) |

## Per-claim verdict (Kai's three claims)

| Claim | Oracle | Verdict | Evidence |
|---|---|---|---|
| **C1 — settlement is P&L-neutral; realised P&L = 0 at settlement** | IAS 21 §23; D-FX-PNL-FCY-EXPOSURE-REVALUATION | **PASS** | The two \`TradeSettlementExecuted\` movements carry settled == booked per currency (USD +1,000,000 == booked 1,000,000; ZAR −18,500,000 == booked 18,500,000), so PR-FX-SETTLE-V2 strikes ZERO to the realised-P&L account (ACC-2100-006). A deliverable spot settles at the contracted rate — conversion P&L is a LATER event, not struck here. \`recon:fx-settlement-fvtpl-integrity\` independently asserts no settlement rule posts realised P&L. Test S2 green. |
| **C2 — the clearing account does NOT square at settlement; carries the negated settled-cash position per currency; nets to zero with the cash legs per currency; no silent residual** | (see ruling below) | **PASS as a description of the as-built behaviour; FINDING on the doctrine** | The behaviour is EXACTLY as Kai states — clearing carries USD −1,000,000 (credit) / ZAR +18,500,000 (debit); cash + clearing net to zero per currency; no silent residual (tests ★-1, ★-2). BUT the DOCTRINE that this standing balance is correct (squaring "only on the FCY→ZAR conversion") does NOT hold against the domain oracle — see "Clearing-account ruling". |
| **C3 — derecognition closes the position (FilInstrumentTerminated{settled}, OBS release); GL trial balance balances per currency; settled legs fold operating-book, excluded production-only** | IFRS 9 §3.2.3 | **PASS** | \`FilInstrumentTerminated{terminalStage:"settled"}\` emitted; OBS commitment (ACC-9100-*) nets to zero per currency (released); BA-320 open-FX-instance count drops post-settlement (the FX-contract NOP closes); trial balance debit==credit per currency across the whole cycle; clearing/cash legs present under operating-book, ABSENT under production-only. Tests S4/S5/S6 green. |

## Settlement-of-record + provenance (verified)

- **Settlement-of-record** is TWO \`TradeSettlementExecuted\` (received USD + paid ZAR), each booked-vs-settled per movement. **ZERO \`FilFxSettlementConfirmed\`** (retired/oracle) on the manual production path — confirmed (test S1).
- **Provenance** of every settlement / cash / termination event is **byte-identical** to the booking event's provenance (same \`simulated\` / \`operator:manual-desk-booking\` partition) — the cancel/settlement-within-same-partition lesson holds (test S1).

## ★ Clearing-account ruling (the adversarial question Marc most needed answered)

**Question.** Is it domain-correct for the FX settlement clearing account (ACC-2100-027)
to carry an OPEN FX position INDEFINITELY after settlement (Kai's "carries-until-
conversion"), or should the clearing account EMPTY at settlement, with the residual
FX position living purely as the nostro cash balances ("empties-at-settlement")?

**Ruling: EMPTIES-AT-SETTLEMENT is the domain-truth-correct treatment. Kai's
"carries-until-conversion" is a DESIGN SMELL — FINDING (medium).**

**Citation / reasoning.**

1. **A deliverable FX spot settles PvP — both legs on the SAME value date.** The
   \`settleManualFxTrade\` path confirms BOTH legs in one call (there is no inter-leg
   timing gap). A settlement clearing/suspense account exists precisely to BRIDGE the
   window between one leg settling and the contra leg settling. With simultaneous
   (payment-versus-payment) settlement there is no window to bridge — so the clearing
   account has nothing legitimate to hold once BOTH legs confirm. The universal
   control principle for clearing/suspense accounts (a clearing account must clear —
   reconcile to zero — once the bridged transaction completes; a standing non-zero
   clearing balance is an audit red flag) is therefore breached.

2. **The standing clearing balance is the EXACT NEGATION of the genuine cash
   position** (proven, test ★-2): clearing[USD] = −nostro[USD], clearing[ZAR] =
   −nostro[ZAR]. After settlement the bank's complete, correct economic position is
   the two NOSTRO balances — long USD 1,000,000, short ZAR 18,500,000 — the FCY
   exposure as IAS 21 §23 monetary items, retranslated daily. The clearing balance
   adds a sign-flipped DUPLICATE of that position and nothing else. It is economically
   redundant.

3. **It would ACCUMULATE WITHOUT BOUND.** Because it never empties at settlement, the
   clearing account grows by the negated cash legs of EVERY settled trade, forever.
   That is the opposite of a clearing account's defining behaviour.

4. **The claimed squaring event cannot, as implemented, ever empty it** (proven, test
   ★-3). The doctrine says the balance "squares ONLY on the FCY→ZAR conversion
   (PR-FX-CONVERT-V2)". Exercising \`postFxConversionLegs\` directly shows its legs touch
   the ZAR nostro, the FCY nostro, and the realised/unrealised P&L accounts — and
   **NEVER ACC-2100-027**. A grep of the whole tree confirms the clearing-account
   constant is referenced ONLY by the settlement rule (where it is posted to) and by
   leg-structure metadata — by NO rule that relieves it. So even once the conversion
   is wired, the clearing balance struck at settlement has no path back to zero. The
   "carries-until-conversion" justification is not just questionable doctrine; it is
   unsupported by the very rule it names.

**Domain-correct entry (empties-at-settlement).** Settlement of a deliverable spot
should post the cash exchange directly between the two nostros — \`Dr USD nostro
1,000,000 / Cr ZAR nostro 18,500,000\` — which already balances per currency against
the released OBS memorandum and strikes no P&L. No clearing leg is needed for a
PvP-simultaneous settlement. (A clearing account is appropriate ONLY for genuinely
sequential/async leg settlement, where it holds the first-settled leg until the
contra confirms, then clears.) NOTE: this is the SECOND-LINE ruling; per independence
I do NOT modify Kai's rule — the finding routes to the coordinator for first-line
remediation under D-FX-SETTLEMENT-REALISATION-V1.

## Adversarial attacks that HELD (fail-closed)

| Attack | Verdict | Evidence |
|---|---|---|
| FUTURE-dated trade settled before value date | **PASS (refused)** | \`settleManualFxTrade\` returns \`ok:false\` "value date not yet reached"; ZERO \`TradeSettlementExecuted\` emitted (test "FAIL-CLOSED"). |
| Unknown / unbooked trade | **PASS (refused)** | "no booked FX instrument" — settles nothing (Kai's test, re-confirmed). |
| Same-currency booked ≠ settled (would silently net to zero) | **PASS (fails closed by construction)** | \`postSettlementMovementLegs\` throws on a same-ccy booked≠settled residual rather than absorb an unrepresented IAS 21 §28/§29 exchange difference. |
| Backdated trade settling immediately | **PASS** | Settles at value date; postings fold into the value-date period. |

## Findings

- **MEDIUM — FX settlement clearing account carries a standing, unbounded-accumulating
  in-flight position (PR-FX-SETTLE-V2 / ACC-2100-027).** \`ValidationFindingRaised\`
  \`${FINDING_ID}\`. The clearing account does not empty at settlement of a deliverable
  (PvP) spot; the standing balance is the exact negation of the nostro position
  (redundant) and has no wired relief path (PR-FX-CONVERT-V2 never touches it). Routed
  to the coordinator; NOT fixed in-line (second-line independence). Recommended
  remediation: post the deliverable-spot cash exchange nostro-to-nostro (no clearing
  leg), reserving the clearing account for genuinely sequential leg settlement.

No HIGH or BLOCKING findings: the settlement is P&L-neutral and balanced, the
derecognition is clean, and the fail-closed seams hold. The clearing-account finding
is MEDIUM because it does not misstate net assets or P&L today (clearing + nostro net
correctly per currency in the trial balance) — but it is a genuine balance-sheet
GROSS-UP and an unbounded suspense growth that will fail the standard clearing-account
control and inflate the balance sheet over time.

## Residuals (named — they bound the verdict)

- **FCY→ZAR conversion / \`FxConversionExecuted\` is not wired** (the known residual,
  confirmed). \`postFxConversionLegs\` exists and is exercised only by recon harnesses
  + the leg-structure registry — there is NO \`FxConversionExecuted\` event type and no
  fold/emission path. So realisation P&L is never struck end-to-end today. This bounds
  the claim: the lifecycle is proven correct through SETTLEMENT + DERECOGNITION, but
  NOT through realisation. (And, per the ruling above, even when wired the conversion
  rule does not relieve the clearing account — a second reason the clearing-account
  finding must be addressed alongside the conversion build.)
- **FCY cash position not yet in BA-320 NOP.** Post-settlement the FX-CONTRACT NOP
  correctly closes, but BA-320 v2 folds only \`assetClass === "fx"\` instances, so the
  materialised FCY cash (USD nostro +1m) is NOT yet reflected in the reg-28(5)
  net-open-position. The currency exposure is real and persists; its BA-320 capture is
  a separate, tracked wiring gap (not a Lane-4b defect).

## Overall verdict

**The manual born-V2 FX path is independently validated as correct THROUGH
SETTLEMENT and DERECOGNITION** — settlement-of-record (2× \`TradeSettlementExecuted\`,
correct provenance), P&L-neutrality, cash materialisation, OBS release, derecognition,
per-currency trial-balance integrity, and the provenance partition all hold against
the IAS 21 / IFRS 9 oracles, with every fail-closed seam intact. **ONE MEDIUM finding
stands: the clearing-account treatment is a design smell (carries-until-conversion is
domain-wrong for a PvP deliverable spot; empties-at-settlement is correct).** The
verdict is bounded by two named residuals: realisation (FCY→ZAR conversion) is unwired,
and the post-settlement FCY cash is not yet in BA-320 NOP. Within "booking → reval →
settlement → derecognition" the path is correct; "correct end-to-end through
REALISATION" is NOT yet claimable. The golden test
\`tests/fx-e2e-settlement-derecognition.test.ts\` (11 tests) is the durable regression
proof, including the three adversarial clearing-account assertions.
`;

const findingAlready = [...eventStore.replay({ type: "ValidationFindingRaised" })].some(
  (e) => (e.payload as { findingId?: string }).findingId === FINDING_ID,
);
if (!findingAlready) {
  eventStore.append(
    makeValidationFindingRaised({
      asOf: clock.now(),
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:nadia:validation" },
      citations: ["D-FX-SETTLEMENT-REALISATION-V1", "D-FX-PNL-FCY-EXPOSURE-REVALUATION"],
      eventId: FINDING_ID,
      payload: {
        findingId: FINDING_ID,
        // The subject under validation is the settlement posting rule, not a pricing
        // model; the rule id is the honest subject identifier for this finding.
        modelId: "PR-FX-SETTLE-V2",
        raisedBy: "Nadia (Independent-validation engineer, second line)",
        severity: "medium",
        description:
          "FX settlement clearing account (ACC-2100-027) carries a standing, unbounded-accumulating in-flight position after settlement of a deliverable (PvP) spot. The standing balance is the EXACT NEGATION of the nostro cash position (economically redundant) and has NO wired relief path (PR-FX-CONVERT-V2 never references the clearing account). Domain-truth (IAS 21 §23; standard bank FX settlement / clearing-account control): a PvP deliverable-spot clearing account must EMPTY at settlement (both legs confirm simultaneously — no inter-leg window to bridge); the residual FX exposure lives purely as the nostro cash. Recommended remediation: post the deliverable-spot cash exchange nostro-to-nostro (no clearing leg). Routed to the coordinator; second-line did NOT modify the rule.",
      },
    }),
  );
  console.log(`[file-nadia-fx-settlement-lane4b] raised finding ${FINDING_ID}`);
} else {
  console.log(`[file-nadia-fx-settlement-lane4b] finding ${FINDING_ID} already raised — skipping.`);
}

const recordAlready = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (recordAlready) {
  console.log(`[file-nadia-fx-settlement-lane4b] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-FX-SETTLEMENT-REALISATION-V1"],
    actor: {
      type: "service",
      id: "agent:nadia:validation",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "FX settlement-lifecycle independent validation report (Lane 4b) — book → settle → derecognition + clearing-account ruling",
      path: "2026-06-29_nadia_fx-settlement-lane4b-validation-report.md",
      category: "validation-finding",
      author: "Nadia (Independent-validation engineer, second line — validation, risk)",
      date: "2026-06-29",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
