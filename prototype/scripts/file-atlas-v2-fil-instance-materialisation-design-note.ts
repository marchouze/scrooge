// scripts/file-atlas-v2-fil-instance-materialisation-design-note.ts
//
// RMS Phase 3 filing — Atlas's design note: materialise the anchor bank's IR +
// FX book as native FIL instances + re-prove SA-CCR parity sourcing from those
// instances. Idempotent — skips if already filed.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Atlas (Substrate Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-fil-instance-materialisation-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-atlas-v2-fil-instance-materialisation] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 FIL-instance materialisation (IR + FX) — native fil:inst feed + SA-CCR parity from instances

**Author:** Atlas (Substrate Architect, engineering)
**Date:** 2026-06-13
**Authority:** D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Audience:** Marc (CEO); Rohan (Risk Engineer, engineering); Nadia (Model validation engineer, engineering); Vera (Internal audit engineer, third line)
**Status:** Implemented — PR feat(v2): FIL-instance materialisation (IR+FX) — native fil:inst feed + SA-CCR parity from instances (WS-V2-BBAAS)
**Brief:** brief:atlas:v2-fil-instance-materialisation-ir-fx-native-fil:2026-06-13

---

## 1. Why this slice

S7-FIL (PR #1295) proved SA-CCR methodology parity but surfaced one real gap:
there was **no native \`fil:inst:\` per-trade feed**, so the parity harness
adapted v1 positions into the v2 model at the v1-side boundary. That adapter was
interim scaffolding. This slice closes the gap for the first domain: it
materialises the anchor bank's IR + FX book as **native FIL instances**, wires
the SA-CCR v2 model to source its netting-set TRADE STRUCTURE from them, and
re-proves SA-CCR parity sourcing from those instances. This is what makes "FIL
facets are the sole data-access path" (D-MODEL-BINDING-CONTRACT-V1) true
end-to-end for the SA-CCR trade/netting structure.

## 2. The registered FIL instance event family (three-site registration)

\`FilInstrumentCreated\` / \`FilInstrumentAmended\` / \`FilInstrumentTerminated\`
are promoted from S0 kernel SHAPES (\`v2-core/fil-core/lifecycle.ts\`) into a
real, registered v2 event family. The v2-core payload grammar
(\`v2-core/fil-instances/events.ts\`) composes the kernel base (instance URN +
\`fil:type:\` ref + asOf) with the materialisation axes:

- **instance** — \`fil:inst:<tenant>:<instance-id>\`,
- **type** — \`fil:type:<asset-class>:<family>:<slug>@maj.min\`,
- **tenant** — the S2 tenant axis (\`LE-ZA-HOZ-BANK\` for the anchor book),
- **originatingEvent** — \`{ eventType, eventId }\` pointing at the canonical v1
  trade event (Principle 1 lineage),
- **economicTerms** — the SA-CCR-relevant terms a \`RiskMeasurable\` consumer
  reads off the instance: assetClass, notional (v2 \`Money\`), direction,
  counterpartyId, nettingSetId, currency, **settlementDate** (the static
  maturity anchor), hedgingSetTag.

Registered at **all three sites** (the recurring 2/3 gotcha):
1. **event-types** — \`platform/event-store/event-types/fil-instances.ts\`
   (schemas + \`make*\` + kind list, importing the v2-core grammar);
2. **registry** — \`platform/event-store/registry/fil-instances.ts\` (three
   \`EventTypeMetadata\` rows, class \`governance\`, wired into the registry index);
3. **provenance** — \`platform/event-store/provenance-category.ts\` (all three
   kinds → category \`governance\` → **production**, not simulated; these are
   real anchor-book records). Verified end-to-end: registry class = governance
   AND provenance category = governance for all three types.

## 3. FIL instance projection (Principle 1: register is a query)

\`v2-core/fil-instances/projection.ts\` folds the lifecycle family into a
register keyed by instance URN, exposing taxonomy type, current lifecycle stage,
tenant, the economic terms, and the originating-event ref. \`foldFilInstances\`
takes an optional \`asOf\`: it bounds the fold to events with \`event.asOf <=
asOf\` — the proper Principle-1 as-of query. An instance created before but
terminated after \`asOf\` reads back as \`active\` AS OF that instant.
\`remainingYears(settlement, asOf)\` is **derived** from the static settlement
date — never stored — so it tracks the query as_of exactly as the v1 adapter's
\`remainingYears\` does (identical arithmetic).

## 4. Materialisation backfill — the v1-trade → FIL-instance mapping

\`scripts/seed-v2-fil-instances-ir-fx.ts\` reads the anchor bank's v1 IR-swap +
FX-trade events (READ-ONLY) and emits the FIL instance family into the **v2
anchor store** (\`BANK_V2_ANCHOR_DB\` — NEVER the v1 canonical store). Idempotent
(a created/terminated event already present for an instance URN is skipped).

Mapping, one v1 trade → one \`fil:inst:<tenant>:<tradeId>\`:

| v1 source | FIL type URN | lifecycle |
|---|---|---|
| \`FxTradeExecuted\` (FX-spot, ZAR leg) | \`fil:type:fx:spot:otc-vanilla@1.0\` | executed → \`FilInstrumentCreated{active}\`; \`SettlementConfirmed\`/\`TradeMatured\`/\`FxTradeCancelled\` → \`FilInstrumentTerminated{settled\\|matured\\|cancelled}\` |
| \`FxTradeExecuted\` (forward) | \`fil:type:fx:forward:otc-vanilla@1.0\` | as above |
| \`IrdSwapTradeExecuted\` | \`fil:type:ir:swap.vanilla:vanilla-irs-zar@1.0\` | executed → \`FilInstrumentCreated{active}\`; \`IrdSwapTerminated\` → \`FilInstrumentTerminated{terminated}\` |

FX economic-terms extraction MIRRORS the v1 SA-CCR adapter
(\`positions-to-summaries.ts\`) exactly: ZAR notional = the leg side denominated
in ZAR; direction = side==="sell" ? short : long; hedgingSetTag =
\`base/quote\`; settlementDate = near-leg \`settlementDate.iso\`. The lifecycle
event \`asOf\` is the v1 opening / terminal event's \`as_of\` so the as-of fold
reconstructs historical live sets.

**Counts materialised (against the anchor store):**
- **FX: 35 instances** created + 35 terminated (9 cross-pair FX trades with no
  ZAR leg are skipped — they form no ZAR netting set in v1 either, so this
  preserves parity).
- **IR: 1 instance** created (the live 10-year ZAR IRS; not yet terminated).
- **Total: 36 FIL instances** in the v2 anchor store.

## 5. RiskMeasurable wiring — sourcing positions from instances

\`platform/risk/sa-ccr/fil-instance-positions.ts\` implements the
\`RiskMeasurable.positionContribution\` selection in concrete terms: it reads the
FIL instance lifecycle family from the v2 anchor store, folds it **as-of**,
selects the LIVE instances, and projects each instance's economic terms into the
v2 \`SaCcrTradeSummary\` the methodology consumes — with remaining-maturity
derived from the instance's settlement date at the query as_of. This is the
FIL-sourced analogue of the v1 \`buildFxSaCcrTradeSummaries\` adapter: the
data-access path now runs through the FIL instance register, not a v1-position
adapter. (This is v1-side infra, so it may import v2-core — the permitted v1→v2
direction; \`recon:v2-no-v1-import\` constrains only files under \`v2-core/\`.)

## 6. SA-CCR parity re-proof from native instances (the payoff)

\`recon:v2-saccr-parity\` now sources the v2 side's netting-set **trade/netting
structure** from the materialised FIL instances
(\`buildSaCcrTradeSummariesFromFilInstances\`), not the v1-position adapter. It
adds an explicit **structural-parity assertion** (the FIL-sourced v2 trades must
byte-match the v1-adapter-derived trades, field-for-field) and then re-runs both
engines and asserts byte-equivalence of both CCR event payloads.

**Result over the live anchor store:**
- **Netting sets checked: 2** (NS-investec-bank-za-ZAR; NS-…-0eaca28d-ZAR).
- **Byte-diff count: 0.** v2-from-FIL-instances == v1 recompute == the recorded
  v1 CCR events, for both \`CcrReplacementCostComputed\` and \`CcrEadComputed\`.
- On a clean checkout (no recorded CCR history / unseeded anchor store) the gate
  degrades to the green "nothing to reconcile" path; the FIL instance unit tests
  (\`v2-core/fil-instances/fil-instances.test.ts\`) carry the projection proof.

## 7. Inputs that remain EXTERNALLY sourced (documented, not faked)

The RC inputs **vMtm (mark-to-market) + collateral** are pinned from the
recorded v1 RC event, **NOT** from the FIL instances. This is legitimate and
deliberate:

- A position's **mark-to-market** is the output of the \`Valuable\` facet (a
  \`*Revalued\` event-of-record), not an economic TERM of the instrument.
- **Collateral** lives in the collateral-inventory register, not on the trade.

Neither belongs on the FIL instance lifecycle record, so neither is sourced from
the instances. The FIL instances source what they own — the trade/netting
STRUCTURE (notional, direction, counterparty, netting set, maturity, hedging
set). Wiring MtM + collateral through the \`Valuable\` facet + a collateral
register is a later slice; until then the recorded RC event-of-record is the
authoritative source and the gate pins it. This is honest scope: the structure
is FIL-mediated now; the valuation inputs follow.

## 8. Out of scope (gated follow-on)

Instrument types beyond IR + FX; alias-flip / v1 SA-CCR retirement / consumer
repoint; changes to v1 trade events / v1 SA-CCR / CCR schemas; Nadia
model-validation. The v1 engine + v1 adapter stay LIVE and unchanged (the v1
adapter is retained as the oracle side of the parity comparison).

## 9. Substrate gap

- **Valuable-facet MtM + collateral feed** — the one remaining externally
  sourced input pair (§7). A later slice wires the \`Valuable\` facet's
  \`*Revalued\` output + a collateral register so the gate sources ALL inputs
  from FIL-mediated reads and the recorded-RC pin is retired.
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
      "D-FIL-FRAMEWORK-UNIFICATION",
      "D-MODEL-BINDING-CONTRACT-V1",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-RMS-PHASE-3",
      "BCBS-SA-CCR-CRE52",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:substrate-architect",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 FIL-instance materialisation (IR + FX) — native fil:inst feed + SA-CCR parity from instances",
      path: "2026-06-13_atlas_v2-fil-instance-materialisation-design-note.md",
      category: "design-note",
      author: "Atlas (Substrate Architect, engineering)",
      date: "2026-06-13",
    },
  },
  "2026-06-13T10:00:00.000Z",
);

console.log(JSON.stringify({ ok: true, recordId: RECORD_ID, eventId: result.eventId }, null, 2));
