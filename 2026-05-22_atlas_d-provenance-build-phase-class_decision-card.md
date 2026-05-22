---
title: "D-PROVENANCE-BUILD-PHASE-CLASS — establish a third provenance class for real build-phase data that flows through production projections"
agent: Atlas (Core banking platform architect, engineering — substrate)
trigger: ceo-decision-proposal
decisionId: D-PROVENANCE-BUILD-PHASE-CLASS
decision-required: true
recommendation: Approve Option A — introduce a third `ProvenanceKind` value `build-phase-fixture`, distinct from `simulated`. Production projections (including the BA-325 generator, every M2 return, and dashboard reporting tiles) accept `production` AND `build-phase-fixture` events during the build phase; a one-shot operator command flips to `production`-only at commencement-of-trading and re-emits surviving rows under `production`. The currently-overloaded `simulated` class is preserved for scenario / rehearsal / counterfactual fixtures that must NEVER flow into production projections.
record-kind: ceo-decision-proposal
workstream: WS-REPORTING-CAPABILITY-M2
brief: brief:atlas:d-provenance-build-phase-class-decision-card-sco:2026-05-22
runId: run:atlas:2026-05-22T07-03-45-966Z
asOf: 2026-05-22T07:30:00Z
date: 2026-05-22
authority:
  - "D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10) — establishes the provenance envelope dimension"
  - "D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12, event 52c83d18-8bab-4d10-bd6c-f52cc2a23887) — pins `production-only` as the permanent default projection mode"
  - "Principles/1-events-are-truth.md — provenance is a typed envelope axis, never inferred"
  - "Principles/6-autonomous-by-default.md — build-phase substrate must remain production-grade; humans oversee only the residual"
  - "CLAUDE.md — operating model: 'the bank is real; build phase substitutes data until commencement-of-trading; substrate must be production-grade'"
citations:
  - "docs/2026-05-22_eitan_ba-325-first-end-to-end-validation.md (blake3:ea05a7cacda07b3f9432e0177cbb622160d4d3150ce5475068f0db10b61fcd1d) — gap G-1, originating finding"
  - "D-DATA-PROVENANCE-SUBSTRATE"
  - "D-PROVENANCE-FILTER-ENFORCEMENT"
  - "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
  - "prototype/platform/event-store/provenance.ts — canonical kind enum + Zod schema + carve-outs"
  - "prototype/platform/projections/filter.ts — `defaultProvenanceMode()` (production-only)"
  - "prototype/platform/rms-registers/filter.ts — register-level `kinds: ('production'|'simulated')[]` filter"
  - "prototype/platform/recon/provenance-tag-coverage.ts — Vera coverage recon"
  - "prototype/platform/recon/market-data-provenance-gate.ts — Vera market-data filter gate"
  - "Principles/1-events-are-truth.md"
  - "Principles/6-autonomous-by-default.md"
---

# D-PROVENANCE-BUILD-PHASE-CLASS — scoping card

## Problem statement

Eitan (Treasurer, governance) filed the first end-to-end BA-325 validation report on 2026-05-22 (`docs/2026-05-22_eitan_ba-325-first-end-to-end-validation.md`, blake3 `ea05a7cacda07b3f9432e0177cbb622160d4d3150ce5475068f0db10b61fcd1d`). The headline finding (gap **G-1**, marked CRITICAL — blocks M2): the BA-325 generator runs end-to-end without error but emits a structurally empty return (`totalStockHqlaMinor = 0`, `grossOutflows = 0`, `lcrRatio = "infinity"`).

Root cause: of the 19,992 events in `~/.local/share/bank/event.db`, the 386 events the LCR cares about (`SubLedgerPostingEmitted`, `FxSettlementInstructed`) are all tagged `provenance.kind = "simulated"` and excluded by `defaultProvenanceFilter()` (which pins `production-only` mode per `D-PROVENANCE-FILTER-ENFORCEMENT`, CEO-approved 2026-05-12).

The two existing classes were correctly drawn for the original Slice-1 use case:

- `production` — real bank state. Carved-out at append time for `CeoDecision`, `AgentBriefIssued`, and `Decision` events (which are real architectural commitments even during the build phase). Production projections fold these.
- `simulated` — scenario / rehearsal / counterfactual / fixture data that must NEVER pollute production reads. The default filter excludes these; the rule is correct and load-bearing.

Neither class fits the operating-model gap: **real build-phase data that must flow through production-grade pipelines during the build phase so we can validate every M2 return before commencement-of-trading**. The bank is real; the build phase substitutes data until licence-day; the substrate must be production-grade by then. We have no third class for that data, and so the BA-325 (and every other M2 return) returns empty under the production filter.

This is not a BA-325-only blocker. It blocks **every M2 return**: BA-350 (off-balance-sheet), BA-700 (capital adequacy), every IFRS-statement projection, every dashboard reporting tile that defaults to the production filter. Eitan correctly flags it as the broadest M2 unblocker.

## Options

### Option A (RECOMMENDED) — third provenance class `build-phase-fixture`

Extend the `ProvenanceKind` discriminator from `production | simulated` to `production | simulated | build-phase-fixture`. Production projections (everything that calls `defaultProvenanceFilter()`) accept `production` AND `build-phase-fixture` during the build phase. At commencement-of-trading, a one-shot operator command (`bun run provenance:commence-trading`) flips the default-filter behaviour to `production`-only and re-emits the surviving `build-phase-fixture`-tagged events under `production` (preserving event_id stability via a typed `ProvenanceReclassified` event so the audit chain is intact).

The `simulated` class is preserved and continues to exclude scenario / rehearsal / counterfactual fixtures — those are still load-bearing in test runs and must never reach production projections.

**Pros**

- Aligns with the operating-model semantics: `simulated` for scenarios; `build-phase-fixture` for real data substituted during the build phase; `production` for post-licence-day real data. Three classes, three meanings, no overload.
- Preserves the strong audit-integrity property: scenarios stay quarantined; the cross-reference rule (`production` cannot cite `simulated`) extends naturally — `build-phase-fixture` cannot cite `simulated`, and `production` cannot cite either (at commencement-of-trading).
- Filter discipline survives. The default remains `production-only`; the build-phase relaxation is opt-in by environment (`BANK_LIFECYCLE_PHASE=build`) or commencement gate, not by call-site flag — so individual report CLIs do not sprout `--include-simulated` knobs that drift.
- One-shot migration at commencement-of-trading is bounded and recon-asserted (Vera `provenance-tag-coverage` + a new `provenance-commencement-migration` recon).
- Naturally encodes Eitan's gap G-1 recommendation verbatim.

**Cons**

- Three-class discriminator is broader-surface than two; every recon / filter / projection that switches on `kind` must add the third case.
- One-shot commencement migration is a substantive operator action — must be rehearsed before licence-day (this is good discipline, not a defect).
- The Zod cross-axis rule (currently: `kind === "production"` ⇒ `scenario` forbidden; `kind === "simulated"` ⇒ `scenario` required) needs a third branch — most naturally: `kind === "build-phase-fixture"` ⇒ `scenario` forbidden (real data, no scenario), `sourceLineage` required (already required for all kinds).

**Integrity-rule impact**

- `D-PROVENANCE-FILTER-ENFORCEMENT` is **refined, not loosened**. Its canonical wording — "production-only is the permanent default; test/scenario data is tagged `simulated` and excluded" — remains true. The refinement: during the build phase, the production filter also accepts `build-phase-fixture` events because they are real-bank data, not test/scenario data. The CEO-approved framing of the rule (rejecting silent simulated pollution of production reads) is preserved.
- Cross-reference rule extends naturally: `production` → may not cite `simulated` OR `build-phase-fixture` (post-commencement); `build-phase-fixture` → may cite `production` or `build-phase-fixture` (but never `simulated`); `simulated` → may cite any.

**Implementation effort estimate**

- 8 substrate seams touched: `provenance.ts` (type + Zod + carve-outs), `projections/filter.ts` (mode predicate + default lookup + lifecycle-phase env read), `rms-registers/filter.ts` (kinds enum), `recon/provenance-tag-coverage.ts` (counts), `event-store/store.ts` (`countByProvenanceKind` 3-tuple), one new recon `provenance-commencement-readiness.ts`, one new CLI `scripts/provenance-commence-trading.ts`, one new event type `ProvenanceReclassified`.
- ~25–35 files touched (including tests + scenarios that assert kind shapes).
- Backfill: idempotent script re-tags the 386 build-phase-relevant rows under `build-phase-fixture` (leaves scenario / rehearsal rows under `simulated`). Identification rule: any event whose `sourceLineage` is `pre-substrate-backfill`, `synthetic-bank-seed:*`, `sarb-fixing-fixture:*`, or a known build-phase backfill lineage. Audited by Vera before merge.
- ~150 LoC core + ~200 LoC tests + ~100 LoC backfill + ~80 LoC commencement CLI.

### Option B — loosen production filter to also accept `simulated` during the build phase

Make `defaultProvenanceMode()` lifecycle-aware: return `combined` (accepts both `production` and `simulated`) when `BANK_LIFECYCLE_PHASE=build`; return `production-only` otherwise. Flip at commencement-of-trading by un-setting the env var.

**Pros**

- Smallest code footprint: one function, one branch, no new class, no backfill, no migration.
- No new event type or recon.

**Cons**

- **Violates the load-bearing semantics of `simulated`.** Today, `simulated` events include genuine scenario / rehearsal / counterfactual / test-fixture data that must NEVER appear in any regulator-bound projection. Loosening the production filter to accept all simulated events means scenario runs against the shared store will silently contaminate reporting figures during the build phase — exactly what `D-PROVENANCE-FILTER-ENFORCEMENT` was approved to prevent.
- The class boundary cannot be re-tightened without per-scenario surgery: at commencement-of-trading we'd have to manually identify and quarantine every legitimate scenario row that snuck into production reads during the build phase.
- Breaks tests: the existing `dashboard-page-provenance-endpoints.test.ts`, `recon-decision-required-event-pairing.test.ts`, and `scenarios-fx-end-to-end-phase-*.test.ts` all assert that production projections do NOT see simulated scenario rows during a build run.
- Optically: directly contradicts a CEO-approved decision that was made 10 days ago for sound reasons.

**Integrity-rule impact**

- Effectively repeals `D-PROVENANCE-FILTER-ENFORCEMENT` for the duration of the build phase. Even if formally "phased", the substrate would be running for months / years under the repealed rule and would re-impose it cold on licence-day, with no rehearsal of the production-grade filter behaviour.

**Effort estimate**

- ~10 LoC core; ~50 LoC test churn. But the test churn deletes assertions that protect the invariant — so the "small" change is small only because it deletes the safety property.

### Option C — tag all build-phase events `production` directly

Change every build-phase emitter (seeders, ingester fixtures, SubLedger backfills, FX settlement test path, etc.) to emit `kind: "production"`. Backfill the 386 already-emitted events under `kind: "production"` with `sourceLineage` indicating their build-phase origin (e.g. `synthetic-bank-seed:v3-build-phase`).

**Pros**

- Default filter unchanged: existing production projections immediately see the data with no filter logic change.
- No new class; the existing two-class discriminator is preserved.

**Cons**

- **Erases the boundary between real production data and build-phase substitute data.** At licence-day there is no in-substrate way to identify the 386 (and growing) build-phase rows that need to be either retired or carried forward into production — they are indistinguishable from genuine production data by `kind`, with only the `sourceLineage` string as a soft marker (which no recon currently asserts on).
- Cross-reference rule (`production` cannot cite `simulated`) is unhelpfully permissive: if a build-phase rehearsal scenario row is `simulated` and a build-phase real row is `production`, the rule blocks the real row from citing the scenario — but during the build phase, that's the natural data flow we want to validate (e.g. a scenario stress feeding a real LCR run).
- Effectively requires every projection to gain a *second* "is this row actually production-day data or build-phase substitute" check, by `sourceLineage` prefix, defeating the whole point of the typed `kind` axis.
- Violates Principle 1: provenance is a typed envelope dimension, not a soft string-prefix discriminator.
- Violates `D-PROVENANCE-FILTER-ENFORCEMENT` in spirit — the filter still says "production-only" but the meaning of "production" is now overloaded.

**Integrity-rule impact**

- Renders `D-PROVENANCE-FILTER-ENFORCEMENT` decorative: the rule is preserved verbatim but its semantic content is erased by widening what counts as `production`.

**Effort estimate**

- ~15–20 emitter files retagged; ~150 LoC backfill; ~30 LoC carve-out additions. But the technical-debt drag is permanent — every future recon / report must inspect `sourceLineage` to recover the lost distinction.

### Option D — CLI flag `--include-build-phase` per report

Leave the substrate unchanged. Add a per-CLI flag (`scripts/render-ba-325.ts --include-build-phase`, `scripts/render-ba-350.ts --include-build-phase`, …) that opts the run into `combined` mode and labels the output report metadata `inputCompleteness: "build-phase-fixture-included"`.

**Pros**

- Smallest invasive change to production filter behaviour: the filter default remains `production-only`; the flag is a per-run opt-in.
- Each report self-documents that it was rendered with build-phase data included.

**Cons**

- Every M2 return CLI must sprout the flag, and every consumer of those CLIs must remember to pass it during the build phase. The dashboard / reporting tiles don't have CLI flags — they read from projections directly and would still return empty.
- The flag is the wrong abstraction: it's a per-call-site workaround for a substrate-level operating-model gap. Drift is inevitable (one CLI gains the flag, the next forgets; dashboards diverge from reports).
- Doesn't address Eitan's broader observation: every M2 return faces the same blocker. The flag is a per-symptom patch, not a fix.
- Eitan considered and explicitly rejected this option in the report ("I recommend the first form. `simulated` is a strong word reserved for scenarios + fixture-only test data").

**Integrity-rule impact**

- `D-PROVENANCE-FILTER-ENFORCEMENT` preserved literally; the underlying gap remains and is papered over by per-CLI plumbing.

**Effort estimate**

- ~50 LoC per CLI × 6+ M2 return CLIs; ~50 LoC dashboard wiring per tile. Net effort is comparable to Option A but produces no durable substrate primitive — it's all glue code.

## Recommendation

**Option A.** Eitan's gap-G-1 recommendation in the BA-325 validation report names this option directly and reasons through it. The substrate-level argument is independent: provenance is a typed envelope dimension at the heart of audit integrity (Principle 1), and the build phase has a real operating-model distinction from both `production` (because the data is fixture-sourced, not regulator-bound yet) and `simulated` (because the data is real bank-state, not scenario / counterfactual). Three classes for three semantically distinct categories of event is the cleaner type system; the one-shot commencement-migration is a rehearsable substrate operation; and `D-PROVENANCE-FILTER-ENFORCEMENT` is refined cleanly rather than repealed (B) or hollowed-out (C, D).

## Implementation scope — recommended option (NOT in this PR; this card scopes only)

### Files touched (new)

- `prototype/platform/event-store/provenance.ts` — add `"build-phase-fixture"` to the `ProvenanceKind` union + Zod enum; add a third superRefine branch (scenario forbidden, sourceLineage required); add a `BUILD_PHASE_FIXTURE_TAG` default; consider a `buildPhaseFixtureTag()` constructor for emitters.
- `prototype/platform/event-store/event-types/provenance-reclassified.ts` (NEW) — typed `ProvenanceReclassified` event that records the commencement-of-trading reclassification of a row from `build-phase-fixture` to `production`. Carries the original event_id, the new provenance tag, and a citation to the commencement decision record.
- `prototype/platform/projections/filter.ts` — `eventMatchesProvenanceFilter` adds the third kind in the mode check; `defaultProvenanceMode()` becomes lifecycle-aware (reads a `BANK_LIFECYCLE_PHASE=build|commenced` env, with `setLifecyclePhaseOverride()` for tests) and returns a *new* mode `production-and-build-phase-fixture` during the build phase. Adds the new mode to `ProvenanceMode` type. `combined` mode behaviour unchanged.
- `prototype/platform/rms-registers/filter.ts` — `kinds` enum extended to `("production"|"simulated"|"build-phase-fixture")[]`.
- `prototype/platform/event-store/store.ts` — `countByProvenanceKind()` extended to a 4-tuple `{production, simulated, buildPhaseFixture, untagged}`.
- `prototype/platform/recon/provenance-tag-coverage.ts` — extends counts; adds an advisory finding when `build-phase-fixture` rows exist post-commencement.
- `prototype/platform/recon/provenance-commencement-readiness.ts` (NEW) — asserts that at commencement-of-trading every `build-phase-fixture` row has either been migrated to `production` (via `ProvenanceReclassified`) or retired (via a documented retire event). Severity: `fail`. Run as part of the commencement-readiness gate (Saskia's substrate).
- `prototype/scripts/provenance-commence-trading.ts` (NEW) — one-shot operator command. Idempotent. Re-emits each `build-phase-fixture` row as a `ProvenanceReclassified` event, then a re-tagged `production` companion event; preserves event_id chain via citation. Asserts the commencement-readiness recon green before running.
- `prototype/scripts/backfill/provenance-build-phase-class.ts` (NEW) — idempotent backfill that re-tags the 386 currently-`simulated` build-phase rows under `build-phase-fixture`. Identification rule: `sourceLineage` ∈ {`pre-substrate-backfill`, `synthetic-bank-seed:*`, `sarb-fixing-fixture:*`, named build-phase lineages from a maintained registry}. Vera audits the registry before merge.

### Files touched (existing emitters)

- `prototype/platform/market-data/sarb-fixing-ingester.ts` — `BUILD_PHASE_FIXTURE_PROVENANCE` constant re-tagged from `kind: "simulated"` to `kind: "build-phase-fixture"`. (The module is already self-aware of its build-phase variant; the marker constant `BUILD_PHASE_VARIANT_MARKER = "build-phase-fixture"` already exists — this is a labelling alignment, not a semantic shift.)
- All other build-phase emitters that currently tag `kind: "simulated"` for *real* bank-state data (not scenario data) get retagged. Sweep via grep + Vera audit; the canonical list is the same set the backfill targets.

### Recon-pipeline impacts

- `recon:provenance-tag-coverage` — extended (3 kinds + untagged).
- `recon:market-data-provenance-gate` (Vera) — extended to allow `build-phase-fixture` as a valid provenance argument to `.query(...)` / `.getLatest(...)`. Today it accepts only `"production"` or `"simulated"`.
- `recon:rms-registers-parity` — implicit: the register-filter `kinds` enum widens; no asserting code changes.
- `recon:provenance-commencement-readiness` (NEW) — green-required before `provenance-commence-trading.ts` is allowed to fire.
- `recon:decision-required-event-pairing` — no change (Decision events are `production` via carve-out, unaffected).
- `recon:wall-clock-callsite-coverage` — no change.

### Backfill needs

- Idempotent re-tag of 386 currently-`simulated` rows → `build-phase-fixture`. Identification by `sourceLineage` allowlist (Vera-audited registry).
- Audit log: `ProvenanceReclassified` event for each row, citing this decision (`D-PROVENANCE-BUILD-PHASE-CLASS`) and the backfill script's run hash.
- Soft-tagger update: future appends without explicit `provenance` from a known build-phase emitter default to `build-phase-fixture` rather than `simulated`. Carve-outs (Decision, AgentBriefIssued) unchanged.

### Gate sequencing

1. **Slice 1** — substrate types + Zod + filter (no behaviour change while substrate-active flag is honoured).
2. **Slice 2** — recon updates + `countByProvenanceKind` extension + tests.
3. **Slice 3** — emitter retag + backfill script + Vera audit of the source-lineage allowlist.
4. **Slice 4** — `defaultProvenanceMode()` lifecycle-awareness flips to `production-and-build-phase-fixture` (env-driven). M2 returns immediately populate.
5. **Slice 5** — `provenance-commence-trading.ts` CLI + `provenance-commencement-readiness` recon. Not invoked until commencement-of-trading.

### Rollback plan

- Slices 1–3 are additive; rollback by reverting the PR. The `build-phase-fixture` rows revert to `simulated` (the backfill script is idempotent and reversible: replay with the inverse `sourceLineage` rule).
- Slice 4 (the filter behaviour flip) is the only behaviour-changing slice. Rollback: revert the lifecycle-aware branch in `defaultProvenanceMode()`; M2 returns return to empty (the pre-fix state), but no data is corrupted.
- Slice 5 (the commencement command) is one-shot and gated by the readiness recon. Rollback before invocation: trivial revert. Rollback *after* invocation: complex (each `ProvenanceReclassified` event would need a counter-event); but the readiness recon green requirement is the gate against premature invocation.

### Dependencies on adjacent work

- None blocking. Eitan's gap G-2 (entity-id backfill `BANK-ZA-001` → `LE-ZA-HOZ-BANK`) is independent and proceeds in parallel.
- Saskia's commencement-of-trading readiness substrate eventually depends on `provenance-commencement-readiness` recon as one of its required green gates — coordinate the gate-list update when Slice 5 lands.

## Authority + signature

Atlas (Core banking platform architect, engineering — substrate authoring)
Run: `run:atlas:2026-05-22T07-03-45-966Z`
Brief: `brief:atlas:d-provenance-build-phase-class-decision-card-sco:2026-05-22`
Citation gate: enforced; this card carries citations to the originating finding, all referenced decisions, all touched substrate seams, and the two binding Principles.
