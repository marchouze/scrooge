---
title: "§16 substrate-gap staleness audit — 2026-05-31"
author: Vera (Internal audit / continuous-assurance engineer)
date: "2026-05-31"
type: audit-finding
brief: "brief:vera:16-substrate-gap-staleness-audit-findings-spec-c:2026-05-31"
run: "run:vera:2026-05-31T07-56-01-633Z"
---

# §16 Substrate-gap staleness audit — 2026-05-31

## Scope

All 30 `Team/*.md` agent specs, section 16 "Substrate gaps (current state)". Reviewed against live `prototype/` substrate, recon pipeline registry (~115 pipelines), and event-type registry as at 2026-05-31.

## Summary

24 of 30 specs were last reviewed 2026-05-14 (17 days before this audit). A large block of substrate landed after that date: D-TREASURY-GAPS-WAVE1 (2026-05-19), model-registry-scope-closure (2026-05-29), RWA live projection + valuation-adjustment (2026-05-30–31). Six specs required correction.

## Findings

### F-SPEC-001 — Rohan.md: model registry stale (closed gap)

**Spec claimed:** "Model registry — designed; partial. Currently lives as Markdown methodology documents."  
**Actual:** Typed calculation-provenance registry live at `platform/model-registry/calculation-provenance.ts`; CALC_BINDINGS expanded to 11 keys (2026-05-29). Gap is partially closed.  
**Correction applied:** v1.4 change-log entry; §16 updated to "partial-closed 2026-05-29."

### F-SPEC-002 — Rohan.md: risk engine modules understated

**Spec claimed:** "Risk engine modules — market / credit / liquidity / operational all in build-only."  
**Actual:** VaR engine (`platform/market-risk/var-engine.ts`), CVA engine (`platform/market-risk/cva-engine.ts`), RWA projection (`platform/projections/rwa-from-positions.ts`, `capital-metrics.ts`), and credit-limit engine (`recon:credit-limit-*`) are live.  
**Correction applied:** §16 updated to enumerate live engines; remaining gaps (SA-CCR EAD, FRTB sensitivities, ECL production) retained.

### F-SPEC-003 — Rohan.md: FRTB target conflicts with CRO opinion

**Spec claimed:** "FRTB sensitivity engine — Target: post-licence."  
**Actual:** Helena (Chief Risk Officer) opinion filed 2026-05-31 classifies FRTB-SA GIRR as mandatory *pre-licence* for IRS / rate-product trading. Spec target was 17 days stale and now conflicts with CRO's governing opinion.  
**Correction applied:** Target updated to "pre-licence"; CRO opinion 2026-05-31 cited.

### F-SPEC-004 — Helena.md: RAS measurability overstates gaps

**Spec claimed:** "only 3 of 13 RAS lines measurable … tier-1 prudential triad LCR/NSFR/CET1 remain unbuilt."  
**Actual:** LCR/NSFR engines live (D-TREASURY-GAPS-WAVE1 2026-05-19); CET1/RWA measurable via `rwa-from-positions.ts` + `capital-metrics.ts` (2026-05-29–31). Tier-1 prudential triad is now measurable in substrate.  
**Correction applied:** v1.3 change-log entry; §16 updated to ~6–8 of 13 lines measurable; "tier-1 triad unbuilt" removed.

### F-SPEC-005 — Camille.md + Bea.md: BA-return generator understated

**Spec claimed (both):** "BA-return generator — not yet built" / "not yet wired to projections."  
**Actual:** BA 700 generator live at `platform/returns/ba700/generator.ts`; BA 325 LCR return engine live at `platform/liquidity/`; `recon:ba-returns-vs-gl-balances` gate live.  
**Correction applied:** Both specs updated to "partially closed — BA700/BA325 live; BA100/200/300/900 pending."

### F-SPEC-006 — Nadia.md: model registry and validation events stale

**Spec claimed:** "Model registry not yet built" / "typed validation events not yet in event-types.ts or registry.ts."  
**Actual:** Model registry partially closed (see F-SPEC-001). Typed validation event schemas confirmed in `platform/event-store/event-types/model-risk.ts` — gap is "schemas exist; emit handlers not yet wired," not "events not defined."  
**Correction applied:** v1.1 change-log entry; both §16 entries updated.

### F-SPEC-007 — Env.md: missing review date

**Spec claimed:** No review date; no change-log entry since v1.0 (2026-05-19).  
**Actual:** Env.md was excluded from the 2026-05-14 mandate review sweep. All five §16 gaps confirmed still valid.  
**Correction applied:** "Reviewed 2026-05-31" added; v1.1 change-log entry recording the sweep miss.

## Process finding

**Root cause — no automated §16 freshness gate.** The Vera Wave-4 #10 agent-spec-integrity pipeline (still planned per `Sade.md §16 gap 4`, `Nolan.md §16`, `PAX.md §16`) would have caught this drift. `recon:agent-spec` exists in `package.json` but its scope is uncertain — confirm whether it asserts §16 review-date staleness. If not, that gate should be added to its mandate.

**Systemic risk:** Three existing recon pipelines (`recon:agent-spec`, `recon:agent-spec-cross-link`, `recon:mandate-coverage`) collectively cover some spec-integrity surface but do not appear to assert §16 freshness. Until the freshness gate lands, the recommendation is a quarterly Scrooge-coordinated in-session sweep of all §16 sections.

## Status

All seven findings corrected inline in this PR. No open items — corrections are substantive, not cosmetic.

## Corrections summary

| File | Version | Change |
|---|---|---|
| `Team/Rohan.md` | v1.4 | Model registry partial-closed; risk engines enumerated; FRTB target pre-licence; review date 2026-05-31 |
| `Team/Helena.md` | v1.3 | RAS measurability updated; tier-1 triad statement corrected; review date 2026-05-31 |
| `Team/Camille.md` | v1.2 | BA700/BA325 partial-close noted; review date 2026-05-31 |
| `Team/Bea.md` | v1.5 | BA700/BA325 partial-close noted; review date 2026-05-31 |
| `Team/Nadia.md` | v1.1 | Model registry partial-closed; validation events reframed; review date 2026-05-31 |
| `Team/Env.md` | v1.1 | Review date 2026-05-31 added; sweep miss recorded |
