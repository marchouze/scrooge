// scripts/file-nadia-mvcash001-closure.ts
//
// Independent RE-VALIDATION and CLOSURE of HIGH finding MV-CASH-001 — by Nadia
// (Independent-validation engineer, second line; reports to Helena, CRO). A
// DISTINCT plane from implementation (Atlas / Bea). This is the decider act that
// closes the finding; only the validator who raised it may close it.
//
// WHAT MV-CASH-001 REQUIRED (raised in scripts/file-nadia-cash-model-validation.ts)
// --------------------------------------------------------------------------------
// The on-anchor settlement-continuity HISTORY proof was (a) VACUOUS IN PRACTICE
// (the materialised FIL instances were written to the v1 canonical event.db, NOT
// the BANK_V2_ANCHOR_DB the recon reads; CI never pinned BANK_V2_ANCHOR_DB, so the
// HISTORY proof passed as a flat-bench `info` on every run), and (b) DEGENERATE in
// its by-currency pairing (the settled FX fixture is denominated in the reporting
// currency ZAR; the proof matched the opposite-direction ZAR PAID leg → a false
// breach, instead of pairing by the FOREIGN/received USD leg valued at the
// settlement rate).
//
// WHAT PR #1430 (merged 0bbf14f7) DELIVERED — re-validated against the merged code:
// ------------------------------------------------------------------------------
//  (1) ANCHOR-STORE ROUTING + NON-VACUITY GUARD. All three cash gates
//      (fx-settlement-continuity, cash-materialisation-integrity,
//      fx-cash-gl-recognition-integrity) now take a `requireNonVacuous*` opt; the
//      CLI / CI entrypoint passes TRUE, so an EMPTY anchor population FAILS
//      fail-closed (exit 1) — not infos/passes. Independently RE-RUN:
//        • empty anchor → all three FAIL (exit 1, "VACUOUS on-anchor proof");
//        • backfill mirrors the settled USD FX + its two cash legs into
//          BANK_V2_ANCHOR_DB (`anchor store : 2 cash leg(s) mirrored`), giving a
//          NON-ZERO compared population → all three PASS (exit 0, "1 settled FX
//          instance(s) checked (1 paired …)").
//      CI pins `BANK_V2_ANCHOR_DB=.local/v2-anchor.db` in BOTH recon jobs and
//      `ci:migrate` runs `backfill:fil-instances`, so the on-anchor HISTORY proof
//      is exercised on every CI run — the mis-routing root cause is closed.
//  (2) FOREIGN-CURRENCY PAIRING. fx-settlement-continuity now derives the FOREIGN
//      leg from the FX instrument's `hedgingSetTag` (`USD/ZAR` → USD), sources the
//      foreign notional from the materialised USD received cash leg, and values
//      USD → reporting (ZAR) at the settlement rate (18.75) on BOTH sides — the
//      economically-correct, NON-degenerate pairing. The degenerate ZAR→ZAR ≡ 1
//      funding-leg match is gone. Confirmed on the anchor fixture
//      (S1-FX-FIXTURE-USD-SETTLED-001, hedgingSetTag `USD/ZAR`, USD received +
//      ZAR paid legs).
//  (3) LIVE EMISSION. The production settlement handler
//      (`materialise-settled-cash.ts` → adapter `materialise-settled-cash-for-fx.ts`)
//      is wired into BOTH `settle-matured-trades.ts` (line 220) and
//      `post-trade-lifecycle.ts` (line 353). It emits BOTH cash legs (received `+`
//      / long, paid `−` / short), each in ITS OWN currency, each carrying an
//      `originatingInstrument` back-ref to the FX instance-of-record. It is
//      PRODUCT-DRIVEN (reads `resolveMaturityMaterialisation` off the governing
//      FX OTC NPA; the v2-core kernel stays asset-class-agnostic) and idempotent
//      on a deterministic cash-leg URN.
//
// VERDICT: MV-CASH-001 RESOLVED. Both root causes (mis-routed anchor data + the
// degenerate by-currency pairing) are fixed, the vacuity guard is genuinely
// stricter (empty population fails fail-closed), and the live settlement handler
// materialises the instrument-of-record. MV-CASH-002 and MV-CASH-003 remain
// SEPARATELY TRACKED OPEN — this closure does NOT touch them.
//
// Emits, Principle-1 events-first:
//   1. one ValidationFindingClosed (MV-CASH-001 — the decider closure);
//   2. one RecordFiled (the re-validation report in the Documents register).
// Idempotent — skips if MV-CASH-001 is already closed (re-validation report
// already filed).
//
// FIXED `asOf` (Engineering Charter cmd 9 — replay-safe & append-only): re-running
// against the shared store reproduces identical events.
//
// Authority: D-CASH-ASSET-CLASS-V1; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; D-ENGINEERING-INTEGRITY-CHARTER; IAS-21-§28;
//   IFRS-9-§3.2.3; SR-11-7; Principle 1; Principle 2.
// brief: brief:nadia:re-validate-closure-of-mv-cash-001-non-vacuous-o:2026-06-18
// Author: Nadia (Independent-validation engineer, second line).

// NB: this script deliberately imports NEITHER `resolve-event-db-boot` NOR
// `resolve-document-store-boot`. It is wired into `ci:migrate`, and a CI-chained
// emission script must keep its event AND its document blob in the SAME
// per-worktree store (composition posture, `excludeHomeDefault`) so the
// `RecordFiled.documentHash` is never dangling for `recon:rms-document-blob-
// integrity` on a clean CI machine. Importing the boot shims would push the blob
// to the shared HOME document store while the recon reads the per-worktree one —
// a dangling-record fail. (Same rule the `record-d-*` / `npa:*` ci:migrate
// scripts follow: NEITHER shim → event + blob both stay per-worktree, the pairing
// holds.) For the standalone shared-store emission that actually closes the
// finding in Scrooge's store, set BANK_EVENT_DB *and* BANK_DOCUMENT_STORE to the
// shared HOME paths explicitly on the command line — those env vars take
// precedence and keep the event+blob pair together in the shared store.
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC; brief:atlas:extend-cross-worktree-
// sync-to-document-store-blo:2026-06-10.
import { eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { makeValidationFindingClosed } from "../platform/event-store/event-types/model-risk";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:mvcash001-closure:2026-06-18";
const FINDING_ID = "MV-CASH-001";
const MODEL_ID = "cash";
const ENTITY = String(BANK_ZA_001);

// Fixed `asOf` so re-runs are byte-idempotent (Engineering Charter cmd 9). Set
// AFTER the original raise (2026-06-18T06:30:00.000Z) — the closure necessarily
// follows the finding in event time.
const ASOF = "2026-06-18T08:00:00.000Z";

const ACTOR = { type: "service" as const, id: "agent:nadia:model-validation" };
const CITATIONS = [
  "D-CASH-ASSET-CLASS-V1",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-ENGINEERING-INTEGRITY-CHARTER",
  "urn:reg:iasb:ias-21:§28",
  "urn:reg:iasb:ifrs-9:§3.2.3",
  "SR-11-7",
];

// Idempotency guard 1: closure already emitted?
const alreadyClosed = [...eventStore.replay({ type: "ValidationFindingClosed" })].some(
  (e) => (e.payload as { findingId?: string }).findingId === FINDING_ID,
);
// Idempotency guard 2: re-validation report already filed?
const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyClosed && alreadyFiled) {
  console.log(`[file-nadia-mvcash001-closure] ${FINDING_ID} already closed + filed — skipping.`);
  process.exit(0);
}

// Guard 3: the closure decider act presupposes the finding was raised. If it was
// never raised in this store, fail-closed rather than silently closing a finding
// that does not exist (Engineering Charter cmd 2 — fail-closed by default).
const wasRaised = [...eventStore.replay({ type: "ValidationFindingRaised" })].some(
  (e) => (e.payload as { findingId?: string }).findingId === FINDING_ID,
);
if (!wasRaised) {
  console.error(
    `[file-nadia-mvcash001-closure] FAIL-CLOSED: no ValidationFindingRaised for ${FINDING_ID} in this store — the finding must be raised (file:nadia-cash-model-validation) before it can be closed. Aborting.`,
  );
  process.exit(1);
}

const RESOLUTION =
  "RESOLVED by PR #1430 (merged, 0bbf14f7), independently re-validated against the merged code on `main` " +
  "(not the build narrative). Both root causes of MV-CASH-001 are closed. (1) ANCHOR-STORE ROUTING + " +
  "NON-VACUITY GUARD: all three cash gates (fx-settlement-continuity, cash-materialisation-integrity, " +
  "fx-cash-gl-recognition-integrity) now fail-closed on an EMPTY anchor population via `requireNonVacuous*` on " +
  "the CLI/CI path — re-run confirmed empty anchor → all three FAIL (exit 1), and the backfill mirroring the " +
  "settled USD FX + its two cash legs into BANK_V2_ANCHOR_DB gives a non-zero compared population → all three " +
  "PASS (1 settled FX paired). CI pins BANK_V2_ANCHOR_DB=.local/v2-anchor.db in both recon jobs and ci:migrate " +
  "runs backfill:fil-instances, so the on-anchor HISTORY proof is exercised every run (the mis-routing defect is " +
  "gone). (2) FOREIGN-CURRENCY PAIRING: fx-settlement-continuity derives the FOREIGN leg from the FX " +
  "hedgingSetTag (USD/ZAR → USD), sources the foreign notional from the materialised USD received leg, and values " +
  "USD → ZAR at the settlement rate on both sides — the economically-correct, non-degenerate pairing (the ZAR→ZAR " +
  "≡ 1 funding-leg match is gone). (3) LIVE EMISSION: the production settlement handler " +
  "(materialise-settled-cash.ts via materialise-settled-cash-for-fx.ts) is wired into settle-matured-trades.ts " +
  "and post-trade-lifecycle.ts, emits BOTH cash legs (received +/long, paid −/short) each in its own currency " +
  "with an originatingInstrument back-ref, product-driven via the FX OTC NPA (kernel asset-class-agnostic). " +
  "Closed by Nadia (the validator who raised it). MV-CASH-002 / MV-CASH-003 remain separately tracked open.";

const closure = makeValidationFindingClosed({
  asOf: ASOF,
  entity: ENTITY,
  actor: ACTOR,
  citations: CITATIONS,
  payload: {
    findingId: FINDING_ID,
    closedBy: "Nadia (Independent-validation engineer, second line)",
    resolution: RESOLUTION,
    closedAt: ASOF,
  },
});
eventStore.append(closure);
console.log(`[closure] ${FINDING_ID} ValidationFindingClosed ${closure.event_id}`);

// ---------------------------------------------------------------------------
// The re-validation report — RecordFiled, Documents register.
// ---------------------------------------------------------------------------

const body = `# Independent re-validation — closure of MV-CASH-001 (Cash \`Valuable\` FIL-Model)

**Validator:** Nadia (Independent-validation engineer, second line; reports to Helena, CRO) — independent of implementation (Atlas (Core banking platform architect, engineering) / Bea (Accounting & financial reporting engineer, engineering)).
**Date:** 2026-06-18
**Finding:** MV-CASH-001 (HIGH) — the on-anchor settlement-continuity HISTORY proof was vacuous in practice + the by-currency pairing was degenerate.
**Remediation under review:** PR #1430 (merged, \`0bbf14f7\`).
**Brief:** \`brief:nadia:re-validate-closure-of-mv-cash-001-non-vacuous-o:2026-06-18\` (WS-CASH-ASSET-CLASS).
**Authority:** D-CASH-ASSET-CLASS-V1; D-MODEL-BINDING-CONTRACT-V1; D-FIL-FRAMEWORK-UNIFICATION; D-ENGINEERING-INTEGRITY-CHARTER.
**Closure event:** \`ValidationFindingClosed\` — MV-CASH-001.

---

## VERDICT: MV-CASH-001 RESOLVED

Re-validated against the **merged code on \`main\`**, not the build narrative. Both root causes are closed; the fix is genuinely stricter (it cannot pass on an empty population), economically correct, and live. The two siblings MV-CASH-002 and MV-CASH-003 remain **separately tracked open** — this closure does not touch them.

---

## 1. Vacuity guard — genuinely STRICTER, fail-closed (RE-RUN)

All three cash gates now take a \`requireNonVacuous*\` option; the CLI / CI entrypoint (\`import.meta.main\`) passes **TRUE**, so an empty compared population **FAILS** the gate (it previously passed as a flat-bench \`info\`).

- **Empty anchor → all three FAIL (exit 1).** Independently re-run with \`BANK_V2_ANCHOR_DB\` pointed at a fresh empty store: \`recon:fx-settlement-continuity\`, \`recon:cash-materialisation-integrity\`, and \`recon:fx-cash-gl-recognition-integrity\` each printed \`VACUOUS on-anchor proof …\` and exited **1**.
- **Non-zero population → all three PASS (exit 0).** \`backfill:fil-instances\` mirrors the settled USD FX (\`S1-FX-FIXTURE-USD-SETTLED-001\`) + its two cash legs into \`BANK_V2_ANCHOR_DB\` (\`anchor store : 2 cash leg(s) mirrored\`). Re-run: \`fx-settlement-continuity\` reports \`5 structural cases + 1 settled FX instance(s) checked (1 paired …)\`; the two integrity gates report \`2 cash instance(s) … 1 settled FX … under a cash-materialising NPA\`. All exit **0**.
- **CI path exercises it.** \`.github/workflows/pr-ci.yml\` pins \`BANK_V2_ANCHOR_DB=.local/v2-anchor.db\` in BOTH recon jobs, and \`ci:migrate\` runs \`backfill:fil-instances\` — so the on-anchor HISTORY proof runs over a non-zero population on every CI run. The original mis-routing defect (materialised events landing in v1 \`event.db\`, never the anchor store; CI never pinning the anchor DB) is gone.

## 2. Economically-correct pairing — FOREIGN/received leg (not ZAR→ZAR ≡ 1)

\`fx-settlement-continuity\` now derives the **foreign** leg from the FX instrument's \`hedgingSetTag\` (\`foreignCurrencyOf\`: \`USD/ZAR\` → \`USD\`), finds the materialised cash leg in that foreign currency (the USD **received** leg), sources the foreign notional from it, and values **USD → reporting (ZAR) at the settlement rate (18.75)** on BOTH the FX-position Valuable and the cash Valuable. The degenerate match on the reporting-currency (ZAR) **paid** funding leg — which gave \`value_pre +1,852,000 != value_post −1,852,000\` — is gone. Confirmed against the anchor fixture: the settled FX carries \`hedgingSetTag: USD/ZAR\`; the proof pairs the USD received leg, not the ZAR paid leg.

## 3. Live emission — both legs, back-ref, product-driven (kernel agnostic)

The production settlement handler \`materialise-settled-cash.ts\` (via the adapter \`materialise-settled-cash-for-fx.ts\`) is wired into BOTH \`settle-matured-trades.ts\` (call-site line 220) and \`post-trade-lifecycle.ts\` (line 353). It:
- emits BOTH cash legs — **received** (\`+\`, \`direction: long\`) and **paid** (\`−\`, \`direction: short\`) — each denominated in **its own currency** (received foreign ccy, paid reporting ccy);
- stamps each cash instance with \`originatingInstrument\` = the FX instance-of-record URN (single-graph back-ref, Principle 2);
- is **product-driven**: it reads the maturity→cash rule via \`resolveMaturityMaterialisation\` off the governing FX OTC NPA (\`prd:bank:fx:otc-vanilla\`, \`maturityMaterialisation{bothLegs:true}\`) and emits ONLY when the product declares the rule — the \`v2-core\` kernel stays asset-class-agnostic;
- is idempotent on a deterministic cash-leg URN (\`<tradeId>-cash-<side>\`), \`INSERT OR IGNORE\` into the anchor store (replay-safe, Principle 1).

Verified on the anchor fixture: the materialised legs are \`…-cash-received\` (USD, long) and \`…-cash-paid\` (ZAR, short), both back-ref'd to \`fil:inst:LE-ZA-HOZ-BANK:S1-FX-FIXTURE-USD-SETTLED-001\`.

---

## Scope note

This closure resolves **MV-CASH-001 only**. **MV-CASH-002** (standing-NOP risk contribution is a forward declaration, not yet the live VaR/NOP source-of-record) and **MV-CASH-003** (fx-spot \`submitted\` code-literal housekeeping) remain **OPEN and separately tracked**, per their original raise.

**Re-validation cadence:** annual (SR-11-7) or on methodology-hash change (D-MODEL-BINDING-CONTRACT-V1 §3).

---

*Filed events-first (Principle 1): 1 × \`ValidationFindingClosed\` (MV-CASH-001) + this \`RecordFiled\`. The markdown is a render of the events, not the canonical artefact.*
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    supersedes: undefined,
    citations: CITATIONS,
    actor: ACTOR,
    entity: ENTITY,
    metadata: {
      title: "Independent re-validation — closure of MV-CASH-001 (cash model)",
      path: "2026-06-18_nadia_mvcash001-closure.md",
      category: "model-validation",
      author: "Nadia (Independent-validation engineer, second line)",
      date: "2026-06-18",
    },
  },
  ASOF,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      verdict: "MV-CASH-001 RESOLVED",
      model: MODEL_ID,
      closureEventId: closure.event_id,
      recordFiledEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
      stillOpen: ["MV-CASH-002", "MV-CASH-003"],
    },
    null,
    2,
  ),
);
