---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T00:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-EVENT-STORE-SCALING, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-EVENT-STORE-SCALING`
- **Title:** Event-store scaling design — adopt framing, Azure target, first three slices under Targeted budget
- **Action:** approve
- **Source proposal:** [Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md](Owner%20Inbox/2026-05-10_atlas_event-store-scaling-design.md)
- **Outcome:** Atlas (Core banking platform architect)'s scaling-design framing is adopted: the five-concern decomposition (as-of replay, recon scans, projection-rebuild SLA, compaction, partitioning), the Azure target architecture (Event Hubs ingest + Cosmos DB Core hot-tier + Table Storage cold-tier + Blob Cool/Archive), the snapshot + partition + tier strategy, and the eight-slice substrate sequencing. Slices 1–3 (retention metadata in `registry.ts`; local snapshot substrate; consumer adoption) authorised pre-M2 under the Targeted budget. Slices 4–8 sequence in their named M-phases. The five open questions are resolved as Atlas recommends.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve all 3" — chat-intake 2026-05-10.
- **Authority chain:** Substrate / standard layer of Principle 6's downward chain. Implements Principle 1 (events as source of truth — scaling preserves replay-from-zero correctness via additive snapshot caches), Principle 3 (cloud-native + local-build-first sequencing — local substrate behind clean interfaces, Azure swap at M8), Principle 5 (multi-X — partitioning by `streamKey` = entity + aggregate), Principle 6 (single-graph discipline — every event-type carries retention metadata that resolves into the obligations register).

## Open questions resolved

| # | Question | Resolution |
|---|---|---|
| **Q1** | Snapshot cadence — every K events, every T time, or hybrid? | **Hybrid: every 1,000 events OR every 1 hour, whichever first; tunable per stream in `registry.ts`.** Per-stream tuning so low-velocity streams (rare-trading counterparty) still get fresh snapshots and high-velocity streams don't generate wasteful snapshots. |
| **Q2** | Cold archival horizon — 90/90/archive or longer hot window? | **90 days hot / 90 days cool / archive thereafter.** Cool-tier returns sub-second to match regulator-request typical 5-business-day window; Archive returns ≤1h on regulator-priority queue, 24h legal-discovery default. |
| **Q3** | Hot-tier persisted log — Cosmos DB Core, Table Storage, or SQL Hyperscale? | **Cosmos DB Core for ingest path** (rich queries, change feed, native partitioning); **Table Storage for the cold tier** (cheaper, simpler queries — sufficient for forensic / regulator-restore). SQL Hyperscale rejected (cost/benefit doesn't fit append-and-replay workload). |
| **Q4** | Stream partitioning key — entity-only or entity+aggregate? | **Entity + aggregate** (e.g. `LE-BANK-SA, counterparty/CP-XYZ`). Per-counterparty / per-instrument granularity gives best per-stream replay locality; entity-only collapses everything under `LE-BANK-SA` into one mega-stream pre-second-entity. |
| **Q5** | Snapshot adoption — hard-cut or per-consumer? | **Per-consumer migration**, ordered: Rohan (highest read amplification per backtest harness); then Vera (recon volume on every fleet-cycle); then Anya (projection rebuild); then dashboard. Each adoption feature-flagged behind a recon pipeline (Slice 3) that asserts byte-identical results between paths during transition. |

## Authorised work — Targeted budget, pre-M2

- **Slice 1 — Retention metadata in `registry.ts`** (Atlas + Mira (Compliance / RegTech engineer)). ~0.5 session. Exit: every `EVENT_TYPE_REGISTRY` row carries `retention: { minimumYears, archivalTier, citationRef }`; a Vera (Internal audit engineer) recon (planned #14) asserts every `citationRef` resolves in the obligations register; citation-coverage reaches 100% on dashboard.
- **Slice 2 — Local snapshot substrate** (Atlas). ~1.5 sessions. Exit: `eventStore.snapshot({ streamKey, asOf })` and `eventStore.replayFromSnapshot(streamKey, asOf)` APIs implemented behind the existing `EventStore` interface so M8 cloud lift swaps the implementation; snapshots persisted in a local `snapshots` table; cadence rules read K (events) and T (time) from registry per-event-type per Q1 resolution.
- **Slice 3 — Consumer adoption** (Rohan (Risk engineer) first; then Vera; then Anya (Data / analytics engineer); then dashboard). ~2 sessions distributed across consumers. Exit per Q5: each named consumer migrates its replay calls to `replayFromSnapshot` behind a feature flag; a recon pipeline (planned Vera #15) asserts byte-identical results between snapshot-path and naive-path during a transition window.

Slices 4–8 sequence in their named phases (Slice 4 compaction pre-M3; Slice 5 partitioning pre-M3; Slice 6 benchmarking rig pre-licence-day; Slice 7 Azure design doc M7; Slice 8 cloud lift M8). They are not authorised by this decision; each requires a fresh authorisation card at its M-phase entry.

## Follow-on routes recorded

- `agent:Atlas (Core banking platform architect)` — execute Slice 1 (retention metadata) and Slice 2 (local snapshot substrate) in sequence; surface progress on `prototype/seeds/dashboard-state.json` substrate-state row.
- `agent:Mira (Compliance / RegTech engineer)` — populate the four `[register: route to Mira]` retention citations called out in §5 of the brief: JSE Equities Rules retention specifics; Companies Act 71/2008 director-decision retention; BCBS 239 audit-trail expectations; operational-substrate retention via Records Management Policy. These resolve the `citationRef` field for Slice 1 exit.
- `agent:Rohan (Risk engineer)` — first consumer migration (Slice 3): backtest harness moves to `replayFromSnapshot` behind feature flag; produce the synthetic 100K-event fixture for byte-identical recon; later own the synthetic 10M-event fixture per §6 Slice 6.
- `agent:Vera (Internal audit engineer)` — register Wave-4 #14 (retention-citation-coverage recon) and #15 (snapshot/naive byte-identical recon) in the audit plan.
- `agent:Anya (Data / analytics engineer)` — author per-stream typed projection schemas needed by Slice 2; sequence semantic-layer entries for `streamKey`, `partitionKey`, `snapshotState`.
- `agent:Owen (Company Secretary, governance)` — author the three planned procedures the scaling work binds to: `Procedures/by-policy/event-store-management.md`, `regulatory-record-retention.md` (with Mira), `data-residency-cloud.md` (with Devon (COO, governance) + Senna (Security engineer)). Each cites this decision and the Azure target.
- `agent:Camille (CFO)` — Slice 7 (M7) cost-model preparation: track Azure event-store cost projections in `Owner Inbox/<date>_camille_api-cloud-cost-budget.md` follow-ons; Year-1 / Year-3 figures land at M7 design-doc time.

## Substrate gaps surfaced (not solved by this decision)

1. **Bus-scaling.** Event-trigger-bus's own scaling at 10M events/year — handler fan-out, dedup, ordering guarantees at high throughput. Lives in `prototype/platform/event-trigger-bus/bus.ts`; addressed M3–M4 alongside Slices 4–5.
2. **Cross-region replication.** Out of scope until M8+ regulatory expansion (second jurisdiction); Azure geo-replication patterns mapped at M7 design-doc but not prototyped pre-licence-day.
3. **Event-schema evolution at scale.** Migration path for typed payload schemas as types evolve. Registry's `…Corrected` pattern handles correctness; historical-event migration where required is a separate substrate item (Atlas + Anya, pre-M3).
4. **Per-handler subscription state.** Today every recon pipeline scans from sequence-1; Azure substrate provides per-subscriber checkpoint state (Event Hubs consumer-group offsets), local substrate does not. Slice between 3 and 4 (Atlas).
5. **Backup / disaster recovery substrate.** Implicit in Azure design (Event Hubs Capture + Cosmos DB continuous backup); explicit DR plan with RPO/RTO targets is a separate Senna + Rashida (CISO) brief.
6. **Encryption-at-rest key rotation.** Key Vault Managed HSM integration is in Slice 7; the rotation procedure (`Procedures/by-policy/encryption-key-rotation.md` planned) is a separate Senna brief.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; this markdown mirrors. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
