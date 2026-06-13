// scripts/file-rohan-v2-saccr-vmtm-collateral-feed-design-note.ts
//
// RMS Phase 3 filing — Rohan's design note: SA-CCR vMtm + collateral now sourced
// from FIL-mediated feeds (the Valuable event-of-record + the collateral
// register), recorded-RC pin retired. Idempotent — skips if already filed.
//
// Authority: D-MODEL-BINDING-CONTRACT-V1; D-W4-MODEL-LIBRARY-PILOT;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Rohan (Risk Engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:rohan:v2-saccr-vmtm-collateral-feed-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-rohan-v2-saccr-vmtm-collateral] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 SA-CCR — vMtm + collateral from FIL feeds: fully FIL-mediated, recorded-RC pin retired

**Author:** Rohan (Risk Engineer, engineering)
**Date:** 2026-06-13
**Authority:** D-MODEL-BINDING-CONTRACT-V1; D-W4-MODEL-LIBRARY-PILOT; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Audience:** Marc (CEO); Atlas (Core banking platform architect, engineering); Nadia (Model validation engineer, engineering); Helena (Chief Risk Officer, governance)
**Brief:** brief:rohan:v2-sa-ccr-valuable-facet-mtm-collateral-feed-ret:2026-06-13
**Status:** Implemented — PR feat(v2): SA-CCR vMtm + collateral from FIL feeds — fully FIL-mediated, recorded-RC pin retired (WS-V2-BBAAS)

---

## 1. What this slice did

After #1295 (SA-CCR as the first FIL-Model) and #1296 (FIL-instance
materialisation of the trade/netting STRUCTURE), two RC inputs remained
externally pinned from the recorded v1 RC event-of-record: **vMtm** and
**collateral**. This slice sources BOTH from their own canonical
events-of-record, FIL-mediated, and RETIRES the pin. SA-CCR is now sourced
**end-to-end** from FIL-mediated reads — "FIL facets are the sole data-access
path" (D-MODEL-BINDING-CONTRACT-V1) holds for ALL of SA-CCR's inputs.

- **vMtm** ← \`sourceVMtmFromValuableFeed\` reads the LATEST \`*Revalued\`
  EVENT-OF-RECORD per trade, as-of the RC date, through the \`Valuable\`
  facet's \`RevaluationRecord\` shape (W9 §3.4: a position's mark-to-market IS
  the output of the \`Valuable\` facet, emitted as a \`*Revalued\` event). This
  is the Principle-1 reading — the canonical revaluation event — NOT the
  drift-prone cumulative-delta walk in v1 \`resolveMtm\`.
- **collateral** ← \`sourceCollateralFromRegister\` reads the
  collateral-inventory register (\`getCollateralInventory\` over
  \`CollateralInventorySnapshotted\` + \`CollateralUpdated\`), as-of the RC
  date. The build-phase v1 limitation is retained: the inventory is a
  bank-level ZAR pool, not yet per-netting-set allocated
  (D-CSA-COLLATERAL-ALLOCATION, future).

New module: \`platform/risk/sa-ccr/fil-valuable-collateral-feed.ts\` (v1-side —
may import v2-core; the boundary forbids only v2→v1). It does NOT author MtM
(out of scope) — it READS the existing \`*Revalued\` event-of-record.

## 2. How vMtm-as-of resolves against the *Revalued event-of-record

Both revaluation families carry the open position's CURRENT mark on the LATEST
event: FX \`FxPositionRevalued.unrealisedPnlZarMinor\` is the open position's
unrealised P&L at the reval rate; IRS \`IrdSwapPositionRevalued.npvClosingMinor\`
is the closing NPV. The event-of-record answer is therefore
**last-write-wins per trade**, as-of-bounded — never a sum of successive
revals (which double-counts the cumulative mark). FX contributes only to ZAR
netting sets; IRS only when its \`currency\` matches the netting-set currency
(single-currency netting set, Credit Risk Policy §3 line 132).

## 3. Parity result — REAL DIVERGENCE SURFACED (not forced)

\`recon:v2-saccr-parity\` now sources vMtm + collateral from the new feeds and
treats the recorded v1 RC event as **oracle-only**. Two assertion tiers:

- **HARD GATE (fail) — v1-recompute == v2-recompute over IDENTICAL FIL-mediated
  inputs.** Both engines consume the same feed-sourced vMtm + collateral +
  FIL-instance trades. **Result: 0 byte-diffs** over the 2 netting sets
  (Investec + 0eaca28d). The methodology port is byte-clean.
- **ORACLE DIAGNOSTIC (warn) — feed-sourced RC vs the recorded v1 RC.** Here a
  **genuine divergence is surfaced**:

| Netting set | recorded vMtm (basis: v1 \`resolveMtm\` cumulative-delta walk) | feed vMtm (basis: latest \`*Revalued\` event-of-record) |
|---|---|---|
| Investec (ZAR) | 55,517,791 | -63,331,817 |
| 0eaca28d (ZAR) | -26,409,293 | 983,554 |

(Collateral byte-matches: 0 / 0 in both, register == recorded.)

### Root cause — confirmed, two-part

1. **Different MtM basis.** The recorded v1 RC used \`resolveMtm\`, which SUMS
   \`FxPositionRevalued.unrealisedPnlZarMinor\` as if each were an incremental
   delta. But that field is the open position's FULL unrealised mark on each
   reval. Summing double-counts. Reconstructing from the store state AS IT
   EXISTED WHEN THE RC WAS APPENDED (sequence < RC sequence), the cumulative
   walk reproduces the recorded vMtm EXACTLY (Investec 55,517,791;
   0eaca28d -26,409,293) — confirming the recorded RC was produced by the
   cumulative walk, the very approach this cutover retires.
2. **Store drift.** The recorded RC (as-of 2026-06-11T17:00Z) was appended at
   sequence 461864, but the daily wall-clock fx-sim-generator subsequently
   appended further revaluations OUT OF SEQUENCE ORDER (earlier as-of, later
   sequence — e.g. a 06-10 reval at seq 462459, after the RC). So neither the
   cumulative walk nor the event-of-record walk over the CURRENT store
   reproduces the recorded value; the underlying history changed after the RC
   was emitted.

**Engineering position (brief §4 "surface, don't force"):** the
\`Valuable\` event-of-record feed is the correct Principle-1 source. The
recorded RC is a stale, wrong-basis oracle over a since-mutated store. The gate
SURFACES the divergence (both vMtm values + as-of) as a \`warn\` finding and
does NOT bend the feed to match. The hard methodology-parity gate stays clean.

## 4. ESCALATION — to Helena (CRO) + Nadia (model validation)

The live v1 SA-CCR RC engine's \`resolveMtm\` MtM basis is **wrong for FX**: it
sums per-reval \`unrealisedPnlZarMinor\` cumulatively, but that field is a FULL
position mark, so the netting-set vMtm is over-counted by every prior reval.
For Investec the recorded vMtm (55.5m) vs the correct event-of-record mark
(-63.3m) is not just a different number — it flips the SIGN, which flips the
RC (max(V,0)) from 55.5m to 0 and materially changes EAD. **This is a real v1
RC defect, not a porting artefact.** Recommended: (a) Nadia validates the
event-of-record MtM basis; (b) a follow-on slice fixes v1 \`resolveMtm\` (FX
arm: latest-per-trade, not cumulative sum) OR repoints the live RC producer to
the \`Valuable\` feed; (c) re-emit affected RC/EAD events. Fixing v1 \`resolveMtm\`
or the alias-flip is OUT OF SCOPE for this slice (gated follow-on, post-Nadia).

## 5. Why CI stays green

The \`recon:v2-saccr-parity\` gate runs against the composition store, which in
CI carries 0 SA-CCR netting sets → vacuous green ("nothing to reconcile"). The
2-netting-set divergence above is visible only against the live home store. The
durable proof of the feed semantics is the unit test
(\`fil-valuable-collateral-feed.test.ts\`, 8 cases): latest-event-of-record (not
cumulative), as-of bounding, multi-trade summation, ZAR-only FX contribution,
register collateral.

## 6. Substrate gaps

- **v1 \`resolveMtm\` FX cumulative-sum defect** (§4) — escalated to Helena +
  Nadia; fix is a gated follow-on.
- **Non-deterministic home anchor store** — the wall-clock fx-sim-generator
  regenerates the FX book daily and appends out-of-sequence, so the recorded-RC
  oracle is not a stable parity fixture. A deterministic SA-CCR parity scenario
  (seeded book + RC) would let the full feed-to-recorded byte-clean proof run
  in CI rather than only against the drifting home store.
- **Per-netting-set collateral allocation** (D-CSA-COLLATERAL-ALLOCATION) — the
  feed mirrors v1's bank-level ZAR pool; a future slice keys collateral by
  netting set.
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
    citations: [
      "D-MODEL-BINDING-CONTRACT-V1",
      "D-W4-MODEL-LIBRARY-PILOT",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-RMS-PHASE-3",
      "BCBS-SA-CCR-CRE52",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    actor: {
      type: "service",
      id: "agent:rohan:risk-engineer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 SA-CCR — vMtm + collateral from FIL feeds: fully FIL-mediated, recorded-RC pin retired",
      path: "2026-06-13_rohan_v2-saccr-vmtm-collateral-feed-design-note.md",
      category: "design-note",
      author: "Rohan (Risk Engineer, engineering)",
      date: "2026-06-13",
    },
  },
  "2026-06-13T10:30:00.000Z",
);

console.log(JSON.stringify({ ok: true, recordId: RECORD_ID, eventId: result.eventId }, null, 2));
