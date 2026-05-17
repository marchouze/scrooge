---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T08:15:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-DATA-PROVENANCE-SUBSTRATE, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-DATA-PROVENANCE-SUBSTRATE`
- **Title:** Data-provenance substrate v1 — typed multi-axis ProvenanceTag + 3-mode projection filtering + watermarked outputs (8 slices)
- **Action:** approve
- **Source proposal:** [Owner Inbox/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md](2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md) (PR [#158](https://github.com/marchouze/scrooge/pull/158))
- **Outcome:** Atlas (Core banking platform architect, engineering) + Anya (Data / analytics engineer, engineering)'s 8-slice data-provenance substrate build spec **approved as drafted**. Slices 1-3 (~5 sessions) authorised for immediate build under the Targeted budget. Per the spec's ordering note, **Slice 6 (backfill, idempotent soft-tagger) ships first, then Slice 1 (hard-rejection gated on `provenance-substrate-active` flag)** — combined as one initial dispatch. Atlas's test-fixtures recommendation adopted (test fixtures stay separate from provenance dimension; use `kind: 'simulated', scenario: 'unit-test'`). Two backfill carve-outs adopted: CeoDecision events tagged `production` (binding architectural commitments) + AgentBriefIssued events tagged `production` (real instructions); rest of historical events tagged `simulated`.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve" — chat-intake 2026-05-10.
- **Authority chain:** New foundational substrate authorisation under Principle 1 (events are truth) + Principle 5 (typed dimensions at envelope level — multi-currency / multi-entity / multi-country precedent) + the standing test-with-simulated-data strategy (`Owner Inbox/actioned/2026-05-09_scrooge_strategy_testing-through-licence-day-with-simulated-data.md`). Substrate landing pre-licence so the production-data transition at licence-day is a default-mode flip, not a code change.

## Follow-on routes recorded

- `agent:Atlas (Core banking platform architect)` — Slice 6 + Slice 1 combined (backfill soft-tagger + ProvenanceTag type + envelope extension + flag-gated append-rejection). ~2 sessions. First dispatch.
- `agent:Anya (Data / analytics engineer)` — Slice 2 (projection-runtime mode selection + filtering). Sequence after Slices 6+1 land.
- `agent:Anya (Data / analytics engineer)` + dashboard layer — Slice 3 (output watermarking + recon). Sequence after Slice 2.
- Slices 4-8 fire on named M-phase triggers per pack §7 without further pause.
- Pack §9 surfaced ~3 new open questions for CEO with default-approve recommendations — adopted in one go per no-pause rule.

## Substrate gaps surfaced

Per pack §11 — likely include: pre-trade attestation gate (Saskia consumer), regulator-output gating (Mira consumer enforcement), POPIA cross-border review on simulated personal data (Iris). Each routed inline.

## Change log

- 2026-05-10 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
