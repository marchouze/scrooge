---
title: D-DATA-PROVENANCE-SUBSTRATE Slices 6+1 (combined) — backfill + ProvenanceTag envelope + flag-gated append-rejection
author: Atlas (Core banking platform architect, engineering — substrate)
date: 2026-05-10
summary: Substrate-level provenance dimension lands in two slices shipped atomically per the spec's §7 ordering note. Slice 6 — soft-tagger that runs at every store-open + one-shot `bun run provenance:backfill` script that tags every untagged event in the local store. Slice 1 — typed `ProvenanceTag` (kind/scenario/variant/sourceLineage/tags), Zod schema with cross-axis enforcement, append-time hard-rejection of untagged events when the `provenance-substrate-active` flag is true, source-lineage registry with static + parameterised allow-list, and two new recon pipelines (`recon:provenance-tag-coverage` + `recon:provenance-lineage-registered`). Carve-outs adopted as Marc instructed — `CeoDecision` and `AgentBriefIssued` events tag `kind: 'production'`. Flag default `false` initially per the dispatch brief; flips when downstream emitters are migrated.
decision-required: false
decision-id: D-DATA-PROVENANCE-SUBSTRATE-SLICE-6-1
decision-category: substrate
decision-owner: Atlas (Core banking platform architect, engineering — substrate)
---

# D-DATA-PROVENANCE-SUBSTRATE — Slices 6 + 1 (combined)

**Author:** Atlas (Core banking platform architect, engineering — substrate)
**Date:** 2026-05-10
**For:** Marc (CEO).
**Authority:**
- `D-DATA-PROVENANCE-SUBSTRATE` (CEO-approved 2026-05-10)
- Build spec: [`Owner Inbox/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md`](2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md) §3, §4, §7, §15
- CLAUDE.md Principles 1, 2, 5 (provenance is a typed envelope dimension)
- CLAUDE.md "Dispatch discipline" (no-pause rule — standing CEO decisions authorise downstream dispatch)

**Status:** Substrate change. No new CEO decision required.

---

## 1. What landed

Two slices shipped in one PR per the spec's §7 ordering note — Slice 6's soft-tagger must heal the store before Slice 1's hard-rejection lights up; combining them into one atomic change makes the activation safe.

### Slice 6 — backfill + soft-tagger

- New script `prototype/scripts/provenance-backfill.ts` wired as `bun run provenance:backfill`. Idempotent: no-ops when every event is already tagged. Reports per-kind counts before and after.
- New method `EventStore.softTagUntaggedEvents()` and a constructor-level invocation. Every `EventStore` boot auto-heals untagged rows so the local store is never in a half-tagged state.
- New method `EventStore.countByProvenanceKind()` reports the per-kind totals (production / simulated / untagged) for diagnostic + recon use.
- Database migration (additive): `ALTER TABLE events ADD COLUMN provenance TEXT`. Wrapped in try/catch so the column is added on legacy DBs and skipped on fresh ones. The `CREATE TABLE IF NOT EXISTS` for new DBs already includes the column.

### Slice 1 — ProvenanceTag envelope + flag-gated append-rejection

- `prototype/platform/event-store/provenance.ts` — typed `ProvenanceTag` (`kind` / `scenario` / `variant` / `sourceLineage` / `tags`), branded primitives (`ScenarioId`, `VariantId`, `SourceLineageRef`), Zod schema with cross-axis `superRefine` rules, helper constructors (`productionTag`, `simulatedTag`), the carve-out registry (`PRODUCTION_CARVE_OUTS`), the build-phase default (`PRE_SUBSTRATE_BACKFILL_TAG`), the substrate-active flag accessor (`isProvenanceSubstrateActive` / `setProvenanceSubstrateActive`), and the substrate-level cross-reference checker (`checkCrossReference`).
- `prototype/platform/event-store/provenance-lineage.registry.ts` — typed allow-list of valid `sourceLineage` values: 8 static entries + 6 parameterised regex patterns covering agent-runtime, bun-test-runner, scenario-runner, synthetic-bank-seed, script, and backfill namespaces.
- `prototype/platform/event-store/types.ts` — `Event['provenance']` field (optional at the schema level; mandatory at append when the substrate-active flag is true).
- `prototype/platform/event-store/store.ts` — `append()` enforces presence per the flag, auto-applies carve-outs (CeoDecision / AgentBriefIssued), and re-validates explicit tags through the Zod schema. `replay()` surfaces the tag.
- `prototype/runtime/decisions/record.ts` — `recordCeoDecision` and `recordDecisionComment` set the production carve-out provenance explicitly so the audit trail is self-describing (the store would auto-inject too, but explicit > implicit on the canonical authoring path).
- `prototype/platform/recon/provenance-tag-coverage.ts` — fail-severity recon: every event in the store carries a `ProvenanceTag`.
- `prototype/platform/recon/provenance-lineage-registered.ts` — warn-severity recon (per pack §4.1 rule 5 soft-fail): every `sourceLineage` value matches a registered static entry or parameterised pattern.
- `prototype/package.json` — wires `provenance:backfill`, `recon:provenance-tag-coverage`, `recon:provenance-lineage-registered`, and adds the two recons to the `ci` chain.

---

## 2. Backfill outcome (post-merge expectation)

The local event store in this worktree was empty (clean checkout, no `.local/event.db`). Per-kind counts on a fresh store after the constructor's soft-tagger pass:

| Kind | Count |
|---|---|
| `production` | 0 |
| `simulated` | 0 |
| `untagged` | 0 |

When this lands on `main` and the GitHub-Actions CI run executes against a fresh `.local/event.db`, the same shape holds. Local developer machines that already have a `.local/event.db` populated will, on first store-open after pulling this branch, see the soft-tagger heal every untagged row — `CeoDecision` and `AgentBriefIssued` rows tagged `production`, everything else tagged `simulated/pre-substrate-build-phase`. The `bun run provenance:backfill` script reports the actual numbers; running it after the substrate-active flag is flipped is the recommended pre-flight check.

---

## 3. API surface for ProvenanceTag

```ts
// Construct
import { productionTag, simulatedTag } from "../platform/event-store/provenance";

const ceoTag = productionTag({ sourceLineage: "ceo-decision-record" });
const scenarioTag = simulatedTag({
  scenario: "stress-adverse",
  sourceLineage: "scenario-runner:stress-adverse",
  variant: "what-if-rate-cut-50bp",
  tags: ["regression"],
});

// Append with explicit provenance
eventStore.append({ ...event, provenance: scenarioTag });

// Validate
import { provenanceTagSchema } from "../platform/event-store/provenance";
const parsed = provenanceTagSchema.parse(rawTag); // throws on cross-axis violation

// Read
for (const event of eventStore.replay()) {
  console.log(event.provenance?.kind); // 'production' | 'simulated' | undefined (pre-Slice-6 row)
}

// Cross-reference check (substrate-level surface; full graph walk is Slice 5)
import { checkCrossReference } from "../platform/event-store/provenance";
const r = checkCrossReference({ source: ceoTag, target: scenarioTag });
// r.ok === false; r.reason === "Cross-reference rule violation: production event cannot reference a simulated event (audit integrity)"
```

---

## 4. Flag-activation semantics

The `provenance-substrate-active` flag governs append-time hard-rejection (Slice 1's load-bearing assertion). Read order:

1. `process.env.BANK_PROVENANCE_SUBSTRATE_ACTIVE` — `"true"` / `"1"` enables, `"false"` / `"0"` disables.
2. `setProvenanceSubstrateActive(boolean | undefined)` — process-local pin (tests).
3. Process default — **`false`** per the dispatch brief.

When the flag is `false` (default):
- Untagged appends succeed (provenance column written as `NULL`).
- The store-open soft-tagger heals these rows on the next boot.
- Every existing emitter call site keeps working unchanged.

When the flag is `true`:
- Carve-out types (`CeoDecision`, `AgentBriefIssued`) auto-inject their production tag.
- Every other type without an explicit `provenance` is hard-rejected with a typed error.
- Explicit tags are re-validated through the Zod schema (cross-axis rules cannot be bypassed).

The flag flips to `true` once the downstream emitter migration (Slices 2–8) reaches the point where every persistent-store emitter sets provenance explicitly. Per pack §11 substrate gaps, that migration is owned across Atlas + Anya + Vera in subsequent slices.

---

## 5. Soft-tagger semantics

The soft-tagger (`EventStore.softTagUntaggedEvents`) runs:

- Inside the `EventStore` constructor on every boot (auto-heal). Idempotent: zero-untagged rows ⇒ no SQL writes.
- On demand via `bun run provenance:backfill` for operators who want an explicit pass + report.

Tag-resolution rules (per pack §3, §7 #6, §9 Q-PROV-NEW-2 + Marc's adopted carve-outs):

| Event type | Tag |
|---|---|
| `CeoDecision` | `kind: 'production', sourceLineage: 'ceo-decision-record'` |
| `AgentBriefIssued` | `kind: 'production', sourceLineage: 'agent-brief'` |
| Everything else | `kind: 'simulated', scenario: 'pre-substrate-build-phase', sourceLineage: 'pre-substrate-backfill'` |

The soft-tagger is independent of the substrate-active flag. A store opened under either flag state heals on boot; the flag governs only the append-time gate.

---

## 6. Tests

29 new tests (`prototype/tests/provenance.test.ts`) covering:

- ProvenanceTag Zod parse + boundary (cross-axis rules — production-with-scenario rejected, simulated-without-scenario rejected, empty `sourceLineage` rejected).
- Carve-out coverage (CeoDecision, AgentBriefIssued, and the "everything else" default).
- Cross-reference rule (production → simulated rejected; the three other directions allowed).
- Source-lineage registry (static + parameterised pattern recognition; unknown values rejected).
- Append-rejection on/off behaviour with the substrate-active flag (carve-out auto-injection on; legacy null-provenance pass-through off; explicit tag always wins; invalid cross-axis tag rejected at append).
- Soft-tagger / backfill round-trip (auto-heals untagged events; idempotent on second pass; per-kind counts).
- Test-fixture convention (`scenario: 'unit-test'`, `sourceLineage: 'bun-test-runner:<file>'`).

All 678 pre-existing tests still green. CI green: typecheck + lint + tests + citation-gate + every recon (15 total).

---

## 7. Substrate gaps remaining (Slices 2-8)

Per pack §7, this combined dispatch lands Slices 1 and 6. Slices 2-8 sequence into their natural windows:

| # | Name | Owner | Status |
|---|---|---|---|
| 2 | Projection-runtime mode selection + filtering | Anya | not started |
| 3 | Output watermarking + recon | Anya + dashboard layer | not started |
| 4 | Combined-mode aggregation primitives | Atlas + Anya | not started |
| 5 | Cross-reference rules + graph-walk enforcement | Atlas | not started |
| 7 | User-level mode toggle UX | Anya + dashboard layer | not started |
| 8 | Recon hardening + first dry-run | Vera + Anya | not started |

Per pack §11, five additional substrate gaps surfaced by the design that don't yet exist (scenario-base registry, source-lineage registry expansion, per-provenance retention join, POPIA personal-data marker, cross-reference back-fill audit trail) — each is a follow-on; none block Slices 1 and 6.

The per-emitter migration that lets us flip `BANK_PROVENANCE_SUBSTRATE_ACTIVE=true` is in scope for the Slice-2 dispatch (Anya owns the projection-runtime adoption + the explicit-tag wiring on the persistent-store emitters).

---

## 8. Decision recorded

`CeoDecision` event ID `D-DATA-PROVENANCE-SUBSTRATE-SLICE-6-1` emitted via `prototype/scripts/record-d-data-provenance-substrate-slice-6-1.ts`. Idempotent (skips if already recorded). Standing authority cited; no new CEO approval required.

---

— Atlas (Core banking platform architect, engineering — substrate)
