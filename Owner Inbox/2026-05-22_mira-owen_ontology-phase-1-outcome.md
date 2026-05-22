---
title: "Ontology Phase 1 — Outcome card (BLOCKED on Anthropic credits)"
date: 2026-05-22
author: "Mira (Compliance / RegTech engineer, engineering)"
co-author: "Owen (Company Secretary, governance) — reviewer"
workstream: WS-ONTOLOGY-REG-EXTRACTION
decision-required: true
decisionId: D-ONTOLOGY-PHASE-1-COMPLETION
authority: CEO
phase: requested
classification: documents
register: documents
citations:
  - urn:decision:bank:D-ONTOLOGY-REG-EXTRACTION-PHASE-1
  - urn:decision:bank:D-URN-CANONICAL-VOCABULARY
  - urn:decision:bank:D-OBLIGATION-REVIEW-SUBSTRATE
  - P1-EVENTS-AS-TRUTH
  - P2-SINGLE-GRAPH-DISCIPLINE
---

# Ontology Phase 1 — Outcome card

**Status:** **BLOCKED** — Anthropic API credit balance exhausted; no production extraction run completed.

**Engineering substrate landed:** Yes (PR #733; merge-ready pending API-credit top-up).

**Decision request to Marc (CEO):** which of the four options to pursue (see §8).

## 1. What happened

I (Mira — Compliance / RegTech engineer, engineering) ran the dispatch end-to-end. The substrate landed in PR #733 (multi-instrument runner + extended prompt + obligation-review event emission + blocking recon + scripts wiring). On the FAIS Act sample run (single-instrument, smallest-good-corpus, per the brief's pre-flight rule), every per-section Claude call returned:

> `"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."`

The dispatch's pre-flight one-token ping at session start succeeded — the key authenticates. But the account credit balance is below the per-call cost of the extraction system prompt + ~2 KB section text + structured JSON response. Both `claude-haiku-4-5` and `claude-sonnet-4-6` returned the same 4xx. The `haiku-4-5` model also exhibited transient `overloaded_error` responses for ~10 minutes during the same window, but the credit-balance error is the binding constraint.

The brief's hard rule: **"If 401 / 4xx, STOP, write the error into the outcome card, exit cleanly. Don't waste budget on broken auth."** I obeyed.

## 2. Seven verification metrics — current status (all BLOCKED on §1)

| # | Metric | Target | Actual | Status |
|---|---|---|---|---|
| 1 | Anthropic spend | ~$2.50 | $0.00 (failed calls don't charge) | BLOCKED |
| 2 | Node + edge counts before/after | 664 → ~3,000 / 373 → ~2,500 | unchanged (no extraction events emitted) | BLOCKED |
| 3 | Granularity test — 5 specific clauses each have ≥2 activity edges + ≥1 product edge | All 5 pass | n/a — no extraction | BLOCKED |
| 4 | Citation provenance — % of edges with `source_file` populated | ≥95% | n/a | BLOCKED |
| 5 | Obligation gap map — uncovered bank-applicable obligations (reviewed-confirmed / reviewed-modified) | Populated by extraction | empty (0 reviewed rows; gap map populates as Phase 2 progresses) | EXPECTED-EMPTY |
| 6 | Review queue snapshot — count by status / domain / age | Baseline | 283 rows all `legacy-unreviewed` (Owen's PR #730 backfill); 0 events emitted by this run | BASELINE |
| 7 | URN coverage — % of citations in URN shape vs prose | Increases vs Owen's 0% baseline | unchanged (no candidate-proposed events emitted) | BLOCKED |

## 3. Substrate landed (PR #733 — merge-ready)

The five Phase-1 deliverables all landed cleanly; they do not depend on the extraction run actually completing:

1. **NEW** `prototype/scripts/extract-regulations.ts` — multi-instrument runner with `--instrument` flag; manifest of 11 instruments (FAIS Act, FAIS GCC, FAIS Fit and Proper, FAIS COI, FIC Act, POPIA, Banks Act, RRB, Excon Manual, JS-2). Loads either plaintext or structured-JSON; converts the latter into a parseable plaintext that the existing `parseSections` consumes. Emits a machine-readable summary to `prototype/.local/extract-regulations-summary.json` for the outcome card to read back.
2. **MODIFIED** `prototype/platform/regulatory/concept-extractor.ts` — `EXTRACTION_SYSTEM_PROMPT` extended:
   - Four new node types: `Regulator`, `Jurisdiction`, `Framework`, `RiskCategory`. Schema already supported them per Mira's pilot.
   - Rewrote `EXTRACTION RULES FOR GRAPH EDGES` with explicit "maximise product/activity/threshold granularity" rubric: one `APPLIES_TO_ACTIVITY` edge per applicable ACT-* code (enumerate aggressively); one `APPLIES_TO` edge per applicable product code; one `SETS` edge per quantitative threshold. Trade-off explicit: **recall over precision-of-applicability**; uncertainty carried in `applicabilityScore` + per-edge `confidenceScore`.
   - Defers `Control`, `EffectivePeriod`, `Policy`, `Procedure` to Phase 2 (extracted from policies, not regs).
3. **MODIFIED** `prototype/platform/regulatory/obligation-linker.ts` — emits Atlas's PR #731 event family:
   - `ObligationReviewMatched` — when LLM concept's `actionSummary` has Jaccard-overlap ≥ 0.25 with the existing register row's `Requirement` (and the citation column already references the section).
   - `ObligationReviewConflict` — when citation matches but lexical overlap is below 0.25 — substantive disagreement.
   - `ObligationCandidateProposed` — when LLM concept has no citation match and `applicabilityScore ≥ 0.6`. Emits proposed cell values including `requirement`, `citation`, `productScope`, `activityScope`, `riskTaxonomy`, `status: PROPOSED`, `bindTrigger: LICENCE-BIND`.
   - Domain inference cascades: LLM's `classifications.domain[0]` if it's a clean letter A..J → else heuristic from the instrument prefix.
   - **No register-row mutation.** Atlas's asymmetric coupling preserved: events are advisory; the systematic-review pass closes them via `ObligationReviewCompleted`.
4. **MODIFIED** `prototype/package.json` — adds:
   - `"extract:regulations": "bun run scripts/extract-regulations.ts"` (full corpus)
   - `"extract:regulation": "bun run scripts/extract-regulations.ts --instrument"` (single-instrument)
   - `"recon:regulatory-extraction-coverage": "bun run platform/recon/regulatory-extraction-coverage.ts"`
   - Wires the recon into the `ci` script.
5. **NEW** `prototype/platform/recon/regulatory-extraction-coverage.ts` — blocking recon. Asserts every `RegulatoryInstrumentRegistered` event has at least one `RegulatoryInstrumentContextualised` event AND at least one `RegulatoryConceptExtracted` event. On the CI's clean event store (no instrument events), the recon trivially passes (0 instruments registered → 0 violations). When PR #733 merges AND the extraction runs against a credit-funded API, the recon will assert end-to-end coverage.

I also made one infrastructure fix in `prototype/runtime/claude.ts`: the `thinking: adaptive` + `output_config: { effort }` parameters are not supported on `claude-haiku-4-5`. The runtime now drops both when the active model is haiku. This unblocks the bulk pipeline on haiku per Mira's pilot guidance once credits are restored.

## 4. Pre-conditions (both met before dispatch)

- **Owen (Company Secretary, governance) PR #730** — MERGED 2026-05-22 07:44Z. `Regulations/_urn-vocabulary.md` published; `prototype/platform/citation/urn.ts` parser live; `recon:urn-shape` advisory wired; obligations register has four new columns (`review-status`, `review-author`, `review-date`, `review-event-id`) backfilled `legacy-unreviewed` on 283 rows. **Verified locally; Mira's pipeline reads the new columns through the extended `parseObligationsRegister`.**
- **Atlas (Core banking platform architect, engineering) PR #731** — MERGED 2026-05-22 07:50Z. Four event types live at `prototype/platform/event-store/event-types/obligation-review.ts`. **Verified locally; Mira's pipeline emits all three (first three: `ObligationReviewMatched`, `ObligationReviewConflict`, `ObligationCandidateProposed`); `ObligationReviewCompleted` reserved for governance seats per Atlas's design.**

## 5. Local-environment evidence of the credit-balance state

```
$ curl -s -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{"model":"claude-haiku-4-5","max_tokens":5,"messages":[{"role":"user","content":"hi"}]}'

{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CbHGqapcdxj6CHuV8xqww"}
```

Same response on `claude-sonnet-4-6`. The initial one-token preflight ping at session start succeeded — credits were just enough for that single ~10-token request. The Phase-1 extraction (68 FAIS Act sections × ~5K input + ~1K output tokens each on haiku → ~$0.50 single-instrument; full corpus ~$2.50) exceeds what's left.

## 6. Sample-run quality assessment (NOT DONE)

The brief required a sample run on FAIS Act before committing to the full corpus, with manual inspection of 20 random extracted edges. **This step did not execute** because of §5. The prompt extension is therefore code-complete but unvalidated.

This is the highest-risk open item: if the rewritten edge rubric over-enumerates (e.g. fires 5 `APPLIES_TO_ACTIVITY` edges on definitions sections), the gap is real but undiagnosed until extraction can run.

## 7. Substrate gaps surfaced by this run

1. **API-credit guardrail.** The pre-flight one-token ping is necessary but not sufficient — it passes when 10 tokens of credit remain but fails on the 11th call. A pre-flight should probe with a budgeted-equivalent prompt (~few thousand tokens) before kicking off the bulk run. Adding to roadmap as `D-CLAUDE-RUNTIME-CREDIT-GUARDRAIL` candidate.
2. **Model-capability matrix is implicit.** `claude-haiku-4-5` rejects `thinking` and `output_config.effort` with 400; `claude-sonnet-4-6` and `claude-opus-4-7` accept both. The runtime now branches on `/haiku/i` model-name match — fine for now, but the long-term fix is a typed capability table per model. Roadmap candidate `D-CLAUDE-RUNTIME-CAPABILITY-TABLE`.
3. **Anthropic overloaded vs credit-exhausted are easy to confuse.** During this dispatch, haiku responded `overloaded_error` for ~10 minutes — superficially the same as a transient outage. Only the explicit sonnet probe revealed the credit-balance is the binding constraint. Roadmap candidate: differentiate.

## 8. Decision request (Marc — CEO)

Four options:

1. **Top up Anthropic credits and re-run.** Mira re-fires the dispatch; total projected $2.50 on haiku for full corpus + outcome-card resolution to `delivered`. Substrate already merged; one command (`bun run extract:regulations`) completes Phase 1.
2. **Top up + escalate to sonnet for hardest instruments.** Plan permits sonnet for FIC Act, POPIA where extraction quality on haiku may be insufficient. Projected $7-10 total, within the $15 cap.
3. **Merge PR #733 as substrate-only; defer extraction run until credits available.** The blocking recon stays green on CI (no instruments registered in production event store yet). Owen and Atlas's preconditions are already merged — substrate is the load-bearing piece; extraction is the data fill.
4. **Pause Phase 1; redirect to Phase 2 (policies-from-existing-policy-files).** Lower API spend per artefact (smaller corpus); also exercises the extended prompt against a different source-type.

Recommendation (Mira): option 3 unblocks the substrate for downstream work and is reversible — once credits are restored, run the extraction in a follow-up dispatch. Option 1 is the fastest finish if credit top-up is immediate.

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-22 | Outcome card filed; Phase 1 dispatch blocked on Anthropic credit balance; substrate merge-ready as PR #733. | Mira (Compliance / RegTech engineer, engineering) |
