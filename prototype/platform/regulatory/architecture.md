# Regulatory Architecture — Two Planes

**Authority:** `D-REGULATORY-ARCHITECTURE-TWO-PLANE` (CEO session-delegation, 2026-06-04)
**Status:** Phase 0 (model codified). Phases 1–4 migrate the substrate onto it.
**Owner:** Mira (Compliance / RegTech engineer, engineering)

## The organising principle

*Not every real-world datum is an event.* Regulations, their LLM/script/agent/human
interpretations, and the derived graph are **reference data** — like a market-data
tick. An **event** is the bank's **decision to accept an obligation or take an
action**, which drives work and has a **lifecycle to completion** — like the
*adoption of a closing rate*. This distinction (consistent with Principle 1's
"facts in the world" vs "recognition decisions") splits the architecture cleanly.

## Plane A — Regulatory Knowledge (reference data; NOT events)

What the world's regulations say. Re-derivable, versioned, never event-sourced.

```
Regulator → Framework → Document(regulation) → Provision → SourceObligation
                                             ↘ Term / Threshold / cross-refs
  jurisdiction applicability via ADOPTS / MODIFIES / GOLD_PLATES adoption edges
  (e.g. SARB adopts Basel — a fact about the world, reference data)
```

- **One regulation store.** Verbatim text is content-addressed in the *generic*
  blob store (`platform/document-store/`, cloud-liftable; **not** RMS) via
  `platform/regulatory/instrument-store.ts`. Structured JSON is a parse; the
  analysis `.md` is a render. Four representations → one text + derived views.
- **One ontology.** `platform/regulatory/graph/{types,ontology-schema}.ts`.
- **Pluggable extraction → one contract.** LLM, scripts, agents, and humans all
  emit the same `RegulatoryExtractionArtefact`
  (`platform/regulatory/extraction-contract.ts`), with provenance per
  node/edge. `concept-extractor.ts` and `build_obligation_graph.py` are two
  *producers* of one contract, not two pipelines.
- **One reference graph.** `graph.db`, loaded solely by `seed-projection.ts`.
  The 5,584 source obligations live here (`graph.html`).

The regulation catalogue is reference data. `instrument-store.ts`'s
`RegulatoryInstrumentRegistered` records "this regulation exists, here is its
text-hash" — a reference fact, not a bank decision. The only regulation-related
*event* is the bank's `ObligationAdopted` (Plane B).

## Plane B — Bank Obligations & Action (events; source of truth)

What the bank has decided to be bound by, and the work that flows from it.
Event-sourced (Principle 1), with lifecycle and as-of replay.

```
SourceObligation (Plane A)
   ↑ DERIVES_FROM
BankObligation (ORG-*) ── born from an  ObligationAdopted  event (the bridge)
   │   lifecycle (each transition an event):
   │   Adopted → PolicyAssigned → ProcedureLinked → ControlImplemented
   │           → Attested → (re-attested | Retired / Superseded)
   ↓ IMPLEMENTED_BY
Policy → GOVERNS → Procedure → REALISED_BY → Capability (engine / constant / code)
```

- The **adoption event** bridges the planes: deciding a source obligation binds
  the bank emits `ObligationAdopted`, creating a bank obligation (`ORG-*`)
  linked `DERIVES_FROM` its source obligation.
- The `ORG-*` register becomes a **projection** over the lifecycle events; the
  markdown is a render. The 417 bank obligations live here (`obligations.html`),
  drillable into the source obligations they derive from.

## The clear data source

| Question | Single source |
|---|---|
| What does the regulation say? / source obligations? | **Reference graph** (Plane A) |
| What has the bank accepted? / what must it do? / status? | **Event store** (Plane B); register is a projection |

Two databases only: the **reference graph** (knowledge) and the **event store**
(action), joined by `DERIVES_FROM`. Everything else is a render or a transient
artefact.

## New ontology edges (introduced when first seeded, Phases 2–3)

- `DERIVES_FROM` — BankObligation → SourceObligation (the bridge).
- `REALISES` / `REALISED_BY` — Capability ↔ Obligation (closes regulation → code).

These are documented here and in `graph/ontology.md`; they are added to the typed
ontology (`types.ts` / `ontology-schema.ts`) only in the phase that first emits
them, to keep `recon:graph-ontology` green.

## Phase map

- **0 (this):** model + docs + `extraction-contract.ts`; decision recorded.
- **1:** producers emit the contract w/ provenance; `seed-projection.ts` the sole
  loader; collapse regulation representations; drop `graphify-out/` from the path.
- **2:** obligation-lifecycle event family; project `ORG-*`; backfill 417 rows;
  `DERIVES_FROM` bridge; `obligations.html` source drill-through.
- **3:** single-home policies/procedures; capability layer (`urn:capability:*`);
  extend `query.ts:traceObligationChain`.
- **4:** unify dashboard views on the two planes; reconcile + add recon gates.
