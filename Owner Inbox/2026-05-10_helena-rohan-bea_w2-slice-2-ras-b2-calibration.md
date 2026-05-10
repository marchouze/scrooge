---
title: RAS B2 calibration — CET1 management buffer ratification (W2 Slice 2)
author: Helena (Chief Risk Officer, governance) + Rohan (Risk engineer, engineering — under Helena) + Bea (Accounting & financial reporting engineer, engineering — under Camille (CFO, governance))
date: 2026-05-10
summary: Resolves the deferred RAS B2 line (CET1 management buffer ≥ +1.5pp above PA-set CET1 minimum + Pillar 2A + capital conservation buffer) per ORG-PR-04. Pure calibration function `calibrateRasB2` codifies the formula; build-phase fixture mirrors Bea's reporting-capability spec (target floor 8.5pp, illustrative live 14.0pp, posture green); typed `RasLineCalibrated` event registered + emitted; recon `recon:ras-b2-calibration-coverage` green. Lifts ORG-PR-04 from PARTIAL → IN FORCE per the calibration event (Mira commits the row-status flip in a follow-on PR). Discharges W2 Slice 2 of D-REGULATORY-READINESS-GATE-PLAN. No new policy authored.
decision-required: false
---

# RAS B2 calibration — CET1 management buffer ratification (W2 Slice 2)

> **Authors.** Helena (Chief Risk Officer, governance) + Rohan (Risk engineer, engineering — under Helena) + Bea (Accounting & financial reporting engineer, engineering — under Camille (Chief Financial Officer, governance); consult on capital fixture inputs).
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10); §3 W2 Slice 2 of [Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md).
> **Decision recorded.** `D-REGULATORY-READINESS-W2-SLICE-2` (downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN per the no-pause rule; CLAUDE.md "Operating procedures").
> **Status.** Calibration ratified; substrate live; recon green. The RAS §B3 narrative already declared the line; this slice ratifies the numbers.

---

## 1. What this slice resolves

The Risk Appetite Statement (RAS) §B3 declares — at narrative level — a CET1 management buffer that operates **above all PA-set CET1 minima + Pillar 2A + capital conservation buffer (CCB) + 1.5pp**. The numerical thresholds (the +1.5pp management buffer; trigger at PA-min + 0.75pp; escalate at PA-min + 0.25pp) have been **deferred** in the obligations register since the RAS was approved (2026-05-06):

> `ORG-PR-04` — *Maintain CET1 management buffer ≥ +1.5pp above all PA minima + Pillar 2A + capital conservation buffer (RAS B2 — calibration pending). Status: `PARTIAL (B2 deferred)`.*

This slice closes that defer. The calibration is now:

- **Codified** as a pure TypeScript function (`calibrateRasB2` at `prototype/platform/risk/ras-b2-calibration.ts`).
- **Ratified** as a typed event (`RasLineCalibrated { lineId: "B2", obligationRowId: "ORG-PR-04", … }` registered in `prototype/platform/event-store/event-types.ts` + `EVENT_TYPE_REGISTRY`).
- **Emitted** by `prototype/scripts/record-d-regulatory-readiness-w2-slice-2.ts` against the build-phase fixture.
- **Asserted continuously** by the new recon `recon:ras-b2-calibration-coverage`.

`ORG-PR-04` lifts from `PARTIAL (B2 deferred)` → `IN FORCE` *per the calibration event* (Principle 1 — the event is the canonical signal; the register row is the rendered view). Mira (Compliance / RegTech engineer, engineering — under Iris (Information Officer, governance)) commits the row-status text change in a follow-on PR — see §6 below.

---

## 2. Calibration formula

The calibration is intentionally simple:

```
targetCet1RatioPct   = paCet1MinimumPct + pillar2APct + ccbPct + 1.5
triggerCet1RatioPct  = paCet1MinimumPct + 0.75
escalateCet1RatioPct = paCet1MinimumPct + 0.25
surplusOverTargetPct = liveCet1RatioPct - targetCet1RatioPct
```

Posture classification, applied to `liveCet1RatioPct`:

| Posture | Condition | Required action (RAS §B3) |
|---|---|---|
| `green` | live ≥ trigger | None — operating zone. May still have `surplusOverTargetPct < 0` (live below target but above trigger) — that is the design intent of layered buffers. |
| `amber-trigger` | escalate ≤ live < trigger | Management action plan; CRO surfaces to BRC at next sitting. |
| `red-escalate` | live < escalate | BRC + Board notification; PA escalation per Recovery Plan early-warning indicator. |

The thresholds codify the RAS §B3 narrative byte-for-byte; if either side moves, the recon catches the drift (assertion 6 in `recon:ras-b2-calibration-coverage`).

---

## 3. Fixture inputs (build-phase posture)

Live Pillar-1 ratios from Bea's RWA engine + BA-form generator (W2 Slice 3) and Rohan's stress-projection engine (W2 Slice 4) are not yet wired through. Until they land, the calibration runs against a typed fixture mirroring the synthetic numbers in Bea's reporting-capability spec at [`Owner Inbox/2026-05-06_reporting-capability-spec.md`](2026-05-06_reporting-capability-spec.md):

| Input | Value | Source |
|---|---|---|
| `paCet1MinimumPct` | 4.5pp | Reg 38 / BCBS Basel III baseline (no PA SREP letter in build phase) |
| `pillar2APct` | 0.0pp | No PA SREP letter in build phase |
| `ccbPct` | 2.5pp | BCBS Basel III standard CCB |
| `liveCet1RatioPct` | 14.0pp | Illustrative (build-phase rehearsal — bank holds no real capital yet) |
| `inputSource` | `fixture:ras-b2-fixture-pillar1-2026-05-10` | Tracable in event payload + recon output |

Calibration outputs from these inputs:

| Output | Value | Interpretation |
|---|---|---|
| `targetCet1RatioPct` | 8.5pp | RAS B2 floor (4.5 + 0.0 + 2.5 + 1.5) |
| `triggerCet1RatioPct` | 5.25pp | Management-action threshold (4.5 + 0.75) |
| `escalateCet1RatioPct` | 4.75pp | BRC-escalation threshold (4.5 + 0.25) |
| `surplusOverTargetPct` | +5.5pp | Live 14.0pp minus target 8.5pp |
| `breachPosture` | `green` | Live above trigger by ~8.75pp |

Live (non-fixture) inputs flow through once W2 Slice 3 lands. **The calibration formula is identical in both cases — only the input source changes.** Downstream consumers know the difference via `inputSource` ("fixture:…" vs "live:bea:ba-110:…") and the citation hint in `calibrationParameters`.

---

## 4. Citation chain (Principle 2)

The calibration is bound to five strict citations carried on every emitted `RasLineCalibrated` event (assertion 5 in the recon enforces presence):

| Citation token | Source | What it binds |
|---|---|---|
| `BANKS-ACT-94-1990` | Banks Act 94 of 1990 §§ 70-72 | Statutory capital-adequacy obligation |
| `REG-RELATING-TO-BANKS-REG-38` | Regulations Relating to Banks 2012, Reg 38 | Capital adequacy framework + capital conservation buffer + Pillar 2A `[citation: TBC — exact sub-clause indices for Pillar 2A and CCB; Imani + external counsel ratify at licence-application]` |
| `BCBS-BASEL-III-IV-CAPITAL-BUFFERS` | BCBS Basel III/IV — capital framework + buffers | International framework Reg 38 transposes `[citation: TBC — exact paragraph index for capital conservation buffer + Pillar 2A]` |
| `RAS-FRAMEWORK-2026-05-06-B3` | RAS §B3 — capital buffer floors | Internal authoring location |
| `ORG-PR-04` | Obligations register row | The register entry this calibration discharges |

The citations are recorded in two places: (i) the event-level `citations` array (P2 envelope-level requirement), and (ii) the payload-level `calibrationCitations` array. Recon assertion 5 reads the union, so a citation present on either surface satisfies the requirement.

---

## 5. Substrate landed

| File | Purpose |
|---|---|
| `prototype/platform/risk/ras-b2-calibration.ts` | Pure calibration function; build-phase fixture; constants (1.5 / 0.75 / 0.25 thresholds); citation tokens. |
| `prototype/platform/event-store/event-types.ts` | `RasLineCalibrated` typed event — payload Zod schema + maker function + `TYPED_EVENT_TYPES` registry entry. |
| `prototype/platform/event-store/registry.ts` | `RAS_EVENT_TYPES` block + `EVENT_TYPE_REGISTRY` inclusion (governance class, `RETENTION_GOVERNANCE_7Y`, Helena issuer, subscribers Helena/Camille/Rohan/Bea/Mira/Vera/dashboard). |
| `prototype/platform/recon/ras-b2-calibration-coverage.ts` | Continuous-controls pipeline: 6 assertions (existence; supersedes-chain; payload shape; obligation-row match; required citations; calibration-parameter drift). |
| `prototype/scripts/record-d-regulatory-readiness-w2-slice-2.ts` | Idempotent emitter for both the `CeoDecision` (sub-authorisation event) and the `RasLineCalibrated` (calibration event). |
| `prototype/tests/ras-b2-calibration.test.ts` | 14 tests over the calibration function, fixture, registry entry, payload schema, maker. |
| `prototype/tests/recon-ras-b2-calibration-coverage.test.ts` | 10 tests over the recon pipeline (smoke + 8 synthetic violation classes + supersedes-chain). |
| `prototype/package.json` | `recon:ras-b2-calibration-coverage` script entry + CI wiring. |

---

## 6. Follow-on routes

### 6.1 Obligations-register row-status flip — **route to Mira**

`Regulations/_obligations-register.md` row `ORG-PR-04` reads:

> `| ORG-PR-04 | … | … | Maintain CET1 management buffer ≥ +1.5pp … (RAS B2 — calibration pending). | Capital Management Policy; RAS | Camille (with Helena) | PARTIAL (B2 deferred) | … | … |`

Mira (Compliance / RegTech engineer, engineering — under Iris (Information Officer, governance)) commits a follow-on PR that:

- Lifts the status cell from `PARTIAL (B2 deferred)` → `**IN FORCE**`.
- Updates the description to remove the "calibration pending" qualifier (the calibration is now ratified).
- Adds a citation to `D-REGULATORY-READINESS-W2-SLICE-2` and the calibration source (`Owner Inbox/2026-05-10_helena-rohan-bea_w2-slice-2-ras-b2-calibration.md`).

This is a separate PR per the canonical-source registry (CLAUDE.md `feedback_canonical_source_registry`): the calibration event is the canonical signal; the register-row text is the rendered view. Same scope, different file, different reviewer.

### 6.2 Live-inputs migration — **route to Bea (W2 Slice 3) + Rohan (W2 Slice 4)**

When W2 Slice 3 (RWA engine + BA-form generator) lands, Bea adds a `liveCet1RatioFromBaForm()` adapter that returns the BA-110 line as a `Pillar1Inputs` shape. The calibration emitter switches from `RAS_B2_FIXTURE_PILLAR1` to that adapter; a new `RasLineCalibrated` event is emitted with `supersedesCalibrationEventId` pointing at the fixture-based event. The recon's drift assertion fires until the new event lands — the supersedes-chain keeps the audit lineage intact.

Rohan's W2 Slice 4 stress-projection engine adds a stressed-input variant of the same pathway — a separate `RasLineCalibrated` event class is **not** introduced for stress; instead, stress-projection handlers consume the same calibration via the existing event and apply their own scenario shifts. (Open question — Rohan flag for Slice 4 design.)

### 6.3 Helena's daily risk-appetite-watch — **automatic next tick**

Helena's existing `helena-risk-appetite-watch` handler reads a hard-coded shadow of RAS lines (see `prototype/runtime/agents/helena-risk-appetite-watch.ts`). The CET1 line at `appetite:capital:cet1-buffer` already references RAS §B3; once the structured RAS register lands (Helena + Atlas substrate gap), the handler reads the calibration parameters from the latest `RasLineCalibrated{lineId:"B2"}` event rather than the prose shadow. No change required this slice — the next handler-iteration tick consumes the event when it arrives.

---

## 7. What is **not** in this slice

- **Other RAS lines.** B2 only. B3 (LCR/NSFR), B4 (trading-book VaR), B5 (financial-crime), B6 (cyber), B7 (model risk), B8 (counterparty concentration), B8a (FX-settlement) are out of scope. Each has its own calibration pathway; the substrate (event-type, recon shape) is reusable.
- **Stress-projection engine.** W2 Slice 4 (Rohan + Nadia (Independent-validation engineer under Helena)). The calibration event format includes `calibrationParameters.inputSource` so a future stressed-input emission is unambiguously distinguishable from the steady-state emission.
- **Live Pillar-1 ratios.** Dependent on W2 Slice 3 (Bea + Camille — RWA engine + BA-form generator). Build-phase fixture used until then; the calibration formula is identical.
- **Policy authoring.** No Capital Management Policy text is changed; the Policy already declares the buffer at the floor level. The slice only ratifies the numerical layer the Policy delegates to the RAS.

---

## 8. Substrate gaps surfaced

- **Structured RAS register** — appetite lines are still read from a hand-curated shadow in `helena-risk-appetite-watch.ts`. A structured RAS register (parseable, citation-bound) would let the handler consume `RasLineCalibrated` events without per-line code changes. Owner: Helena + Atlas (Core banking platform architect, engineering). Tracked under Helena's spec § 6 substrate gap.
- **Recon downgrade on empty event-store** — the recon softens its missing-calibration finding to `info` severity when the event-store has zero events of any type (CI / fresh-bench posture). This mirrors the `decision-event-recon` pattern but is a known concession: a partially-populated event-store missing only the B2 calibration would correctly fail. The cleaner fix lands when the event-store is seeded by a CI bootstrap step rather than the per-developer `bun run record-d-*` invocations. Tracked: `feedback_dashboard_state_no_event_dependence` memory note generalises to all CI-time event-store reads.
- **`Pillar2APct = 0.0` is a placeholder** — the bank has not yet received a PA SREP letter. When the PA issues a Pillar 2A add-on, a recalibration emits a new `RasLineCalibrated` event with the updated `pillar2APct` input and a `supersedesCalibrationEventId` pointing at this calibration. The supersedes-chain keeps the audit lineage intact (recon assertion 2 enforces).
- **`liveCet1RatioPct = 14.0` is illustrative** — the bank holds no real capital in build phase. The number is for substrate rehearsal only. The fixture's `inputSource` field (`fixture:ras-b2-fixture-pillar1-2026-05-10`) marks it as such on every event-payload read.

---

## 9. Citations summary (P2)

External standards `[citation: TBC — exact sub-clause / paragraph indices ratified by Imani (Legal-as-code engineer) + external counsel at licence-application]`:

- Banks Act 94 of 1990 §§ 70-72 (capital adequacy) — `BANKS-ACT-94-1990`
- Regulations Relating to Banks 2012, Reg 38 (capital adequacy + CCB + Pillar 2A) — `REG-RELATING-TO-BANKS-REG-38`
- BCBS *Basel III/IV — capital framework + buffers* — `BCBS-BASEL-III-IV-CAPITAL-BUFFERS`

Internal authoring locations:

- RAS §B3 (capital buffer floors) — `RAS-FRAMEWORK-2026-05-06-B3` ([Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md](2026-05-06_risk-appetite-statement-and-framework.md))
- ORG-PR-04 (CET1 management buffer obligation) — `ORG-PR-04` ([Regulations/_obligations-register.md](../Regulations/_obligations-register.md))

Decision lineage:

- `D-RAS` (RAS approval, 2026-05-06)
- `D-REGULATORY-READINESS-GATE-PLAN` (gate plan approval, 2026-05-10)
- `D-REGULATORY-READINESS-W2-SLICE-1` (framework spec, 2026-05-10)
- `D-REGULATORY-READINESS-W2-SLICE-2` (this slice — calibration ratification, 2026-05-10)

---

## 10. Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-10 | Initial draft — calibration substrate + decision record | Helena + Rohan + Bea |
