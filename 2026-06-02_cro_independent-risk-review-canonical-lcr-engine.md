---
title: "Independent CRO Risk-Review of the Canonical-LCR-Engine Recommendation (G1–G4)"
author: "Office of the Chief Risk Officer (governance)"
date: "2026-06-02"
workstream: "WS-LCR-ENGINE-RECONCILIATION"
brief: "brief:helena:independent-cro-risk-challenge-of-canonical-lcr-:2026-06-02"
authority: "D-LCR-TILE-PROVENANCE"
register: "documents"
classification: "governance-opinion"
status: "for-ceo-ratification"
run-role-class: "reviewer"
reviews: "record:documents:treasurer:canonical-lcr-engine-recommendation:2026-06-02 (PR #1005, 32e58436)"
verdict: "concur-with-conditions"
decision-support-for:
  - "Chief Executive Officer — ratification authority (crosses RAS thresholds)"
upstream-deliverables:
  - "record:documents:ravi:lcr-engine-reconciliation:2026-06-02 (PR #1004, 9ec730ae)"
  - "record:documents:treasurer:canonical-lcr-engine-recommendation:2026-06-02 (PR #1005, 32e58436)"
citations:
  - "D-LCR-TILE-PROVENANCE"
  - "D-PROVENANCE-FILTER-ENFORCEMENT"
  - "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
  - "D-BUILD-PHASE-SYNTHETIC-RESPONSE"
  - "Regulations Relating to Banks Reg 26"
  - "Regulations Relating to Banks Reg 26A"
  - "BCBS D295"
  - "brief:helena:independent-cro-risk-challenge-of-canonical-lcr-:2026-06-02"
  - "brief:eitan:joint-canonical-lcr-engine-recommendation-for-ce:2026-06-02"
  - "brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02"
---

# Independent CRO Risk-Review of the Canonical-LCR-Engine Recommendation

**For:** Chief Executive Officer — ratification
**From:** Office of the Chief Risk Officer (governance) — second-line, functionally independent of the Treasurer; RAS / liquidity-appetite-line owner; reviewer-class
**Reviews:** Office of the Treasurer (governance) recommendation G1–G4 (decider-class) — `record:documents:treasurer:canonical-lcr-engine-recommendation:2026-06-02`, PR #1005 `32e58436`
**Upstream engineering:** LCR Engine Reconciliation by the Treasury / ALM engineering function (Ravi, Treasury / ALM engineer, engineering) — PR #1004 `9ec730ae`
**Authority:** D-LCR-TILE-PROVENANCE (CEO directive, 2026-06-02)

---

## 0. Verdict in one page

**Verdict: CONCUR-WITH-CONDITIONS.**

I have independently re-verified every load-bearing figure and `file:line` claim in the Treasurer's recommendation against the home event store (`$HOME/.local/share/bank/event.db`, 62,401 events @ `2026-06-02`, read-only against a copy — I did not touch the live store) and the live source tree. **The Treasurer's diagnosis is sound and the recommendation is directionally correct.** I concur that the BA 325 generator is the right *regulatory* canonical engine, that a deliberately-different return-vs-tile provenance policy is defensible, and that the build-phase figures are watch-only rather than live-breach.

I attach **five binding conditions** and **one substantive divergence** from the Treasurer. The divergence is not on the destination — it is on the *risk characterisation of the interim state*. The Treasurer frames the as-run BA 325 `∞ / empty` as "correct (no production book)". I rule that **canonicalising BA 325 *as-run*, before the union-denominator convergence (Ravi's E2) lands, institutionalises a known R265.6bn+ liquidity-outflow blind spot in the bank's authoritative engine**, and is acceptable *only* under a time-boxed watch with the conditions below. Canonical status is granted to BA 325 **as a target architecture**, not to its current denominator.

| Gate | Treasurer recommendation | CRO ruling |
|---|---|---|
| **G1 — canonical engine** | BA 325 canonical; tile = faithful render | **Concur-with-conditions.** BA 325 is the right canonical *target*. Its *as-run* denominator is materially incomplete; canonical status is conditional on E2 (union denominator) landing within the agreed window, with the blind spot a standing CRO watch item until then. |
| **G2 — provenance policy** | return = `production-only`; tile = prod+simulated; deliberately different, documented | **Concur-with-conditions.** Defensible to the PA/SARB *only if* the divergence is a signed-off, documented model-risk control with a parity gate — not a silent two-filter accident. Without that, the divergence is itself an audit finding. |
| **G3 — RAS appetite line** | watch-only / excluded from breach-triggering; binding ruling deferred to CRO | **CRO BINDING RULING (below).** Appetite line reads the canonical engine under the appetite-watch lens; build-phase `∞/empty` = **not-yet-measurable / watch-only, never green**; R265.6bn = **standing watch item, escalated per D-BUILD-PHASE-SYNTHETIC-RESPONSE, NOT auto-Tier-1, NOT excluded/silenced** — and flagged as a *floor*, materially understated. |
| **G4 — denominator vocab + calibration** | union vocab; floor/inflow-cap literals → CFO constants | **Concur.** No risk objection. Reinforced as Condition 4: the floor MUST be a calibrated constant in the canonical core, not a literal, before convergence is signed off. |

**Model-risk rating of the two-engine state until convergence (E1–E5) lands: HIGH** (see §6).

---

## 1. Independent reproduction — I re-checked, I did not inherit

My independence means I re-derive the numbers, not restate them. All of the following I reproduced myself, read-only.

### 1.1 Event census (home store @ 2026-06-02, read-only copy)

| Event type | Count | Provenance | Entity |
|---|---|---|---|
| `FxSettlementInstructed` | 34 | **all `simulated`** | `LE-ZA-HOZ-BANK` |
| `SettlementInstructionIssued` | 1 | simulated | `LE-ZA-HOZ-BANK` |
| `DepositTaken` | 2 | 1 fixture (`LE-BANK-SA`), 1 simulated (`LE-ZA-HOZ-BANK`) | split |
| `FundingLineDrawn` | 1 | build-phase-fixture | `LE-BANK-SA` |
| `InterbankLoanPlaced` | 2 | build-phase-fixture | `LE-BANK-SA` |
| `RepoTradeOpened` | 1 | build-phase-fixture | `LE-BANK-SA` |
| `BondTradeExecuted` | 2 | simulated | `LE-ZA-HOZ-BANK` |
| `CollateralInventorySnapshotted` | 1 | simulated | `LE-ZA-HOZ-BANK` |
| `TradeMatured` / `EquitySettlementInstructed` | 0 / 0 | — | — |
| **production-tagged LCR-feed events** | **0** | — | — |

This is identical to both upstream censuses. **Confirmed independently:** the only continuous cash-flow feed the bank produces today is 34 simulated `FxSettlementInstructed`, all on `LE-ZA-HOZ-BANK`; there are **zero** production-tagged LCR-feed events; every build-phase fixture sits on the legacy `LE-BANK-SA` identifier. The provenance axes are confirmed near-complementary at `platform/projections/filter.ts:147`–`164` (production-only admits production + build-phase-fixture, rejects simulated) vs `platform/projections/alm-positions.ts:214` (`liveFlowView` drops build-phase-fixture, keeps simulated).

### 1.2 The R265.6bn swing — reproduced AND found to be a *floor*, not a ceiling

I summed the 34 `FxSettlementInstructed` `netCash` legs directly. The combined-mode figures the Treasurer and Ravi quote (grossOutflows **R1,062,524,139,726.77**, grossInflows **R1,912,408,071,626.96**, net **R265,631,034,931.70**) are reproduced **to the rand** — but I establish a fact neither upstream document states plainly: **those figures are computed from the 12 ZAR-leg events only.** The BA 325 ZAR filter (`ba-325-lcr.ts:1228`/`:1235`) drops the 22 non-ZAR-leg events:

| netCash currency | n | gross outflow (R) | gross inflow (R) |
|---|---|---|---|
| **ZAR (kept)** | 12 | 1,062,524,139,726.77 | 1,912,408,071,626.96 |
| GBP (dropped) | 11 | 87,320,828,727.36 | 76,275,411,763.48 |
| USD (dropped) | 6 | 37,526,458,917.65 | 1,915,432.14 |
| CHF (dropped) | 3 | 3,731,902.39 | 7,049,893.09 |
| JPY (dropped) | 2 | ~0 | 69,486,640.14 |

The R265.6bn net is the **25% net-outflow floor binding** on the ZAR-leg gross outflow: `ceil(0.25 × 1,062,524,139,726.77) = 265,631,034,931.70`, because capped inflows (`min(grossInflows, 0.75 × grossOutflows) ≈ R796.9bn`) exceed the pre-floor net, so `preFloorNetOutflows < floor` and the floor binds. **Risk consequence:** the R265.6bn is not the bank's true combined-mode 30-day outflow — it is the regulatory floor on the *ZAR slice alone*. A further **~R128.9bn of GBP+USD+CHF gross outflow** is invisible at the ZAR filter pending rate-enrichment. The genuine combined-mode exposure is *larger* than R265.6bn. This sharpens — it does not soften — my G3 ruling.

### 1.3 The tile structurally cannot be the canonical engine

Independently confirmed at `platform/liquidity/lcr.ts:249`: the tile's net outflow is `Math.max(stressedOutflows − recognisedInflows, 0)` — **there is no Reg 26(11) 25% net-outflow floor in the tile at all.** A tile-LCR can therefore report a *higher* (more comfortable) ratio than the regulation permits, because it omits a binding regulatory constraint. This is, on its own, dispositive of G1: the dashboard convenience engine cannot be the authoritative regulatory number because it omits a mandatory floor. I concur with the Treasurer's G1 direction on this independent ground.

### 1.4 G4 literals + missing constant — confirmed

`ba-325-lcr.ts:1256` `const inflowCap = Math.floor(0.75 * grossOutflows)` and `ba-325-lcr.ts:1260` `const floor = Math.ceil(0.25 * grossOutflows)` are hardcoded literals. `platform/config/financial-constants.ts` carries `lcr.inflow-recognition-cap` (line 206) **but no `lcr.net-outflow-floor` key** — confirmed absent by enumeration of all `lcr.*` constants (zero matches for the floor key). So the 75% cap exists *twice* (a CFO-owned constant the tile reads, a literal BA 325 ignores) and the 25% floor exists *only* as a BA 325 literal with no calibration owner. The Treasurer's G4 finding is correct as stated.

---

## 2. G1 challenge — is BA 325 the right canonical engine from a *risk* view?

**Verdict: CONCUR-WITH-CONDITIONS.**

**Where I concur with the Treasurer (Eitan, Treasurer, governance):** BA 325 is the Principle-1-correct, regulator-shaped, per-entity computation with the full cap stack *and the Reg 26(11) net-outflow floor the tile structurally lacks* (§1.3). The regulatory return must be the single source of truth for a RAS-threshold metric; a dashboard tile must not be a second authority. On the destination, I agree without reservation.

**Where I challenge — and partially diverge:** The Treasurer's framing is that BA 325 *as-run* is "correct" (its `∞ / empty` faithfully reflects "no production book"). From a pure regulatory-return standpoint that is true. **From a liquidity-risk standpoint it is dangerous to canonicalise as-run.** The risk question is not "is the return technically accurate today?" but "does designating this engine authoritative create a structural blind spot a risk function should not bless?" And it does: BA 325 as-run sees **none** of the 34-event FX-settlement flow that is the only continuous cash-flow feed the bank produces, because BA 325 (a) does not fold the behavioural run-off vocabulary at all and (b) drops simulated. The R265.6bn+ combined-mode signal — the single largest liquidity number anywhere in the bank's books — is invisible to the engine we are about to crown.

To canonicalise the engine that is *most blind to the bank's only live cash-flow feed*, without simultaneously committing to E2 (the union denominator) on a bounded clock, would **institutionalise that blind spot** under a "canonical" label that confers false comfort. The reconciliation's own Finding B ("a correct LCR needs both" vocabularies) is exactly this point.

**Resolution (Condition 1):** I grant BA 325 canonical status **as the target architecture** — i.e. the engine that, *once it folds the union denominator*, is authoritative — not to its current denominator. Canonical designation and the E2 convergence commitment are a single package; the CEO should ratify them together, not ratify G1 today and leave E2 open-ended. Until E2 lands, the divergence and the FX blind spot are a **standing CRO watch item** with the model-risk rating in §6.

---

## 3. G2 challenge — is a different provenance policy for the return vs the tile defensible?

**Verdict: CONCUR-WITH-CONDITIONS.**

**The risk position on the divergence itself.** A regulatory return that admitted simulated flows would be a misstatement to the PA — `production-only` for the return is the only defensible basis, and I concur. The tile must see the rehearsed book for situational awareness — prod+simulated is the right lens for the appetite-watch surface, and D-LCR-TILE-PROVENANCE already sets it. So far I am with the Treasurer.

**My challenge:** the *divergence* is precisely the model-risk failure mode that the reconciliation surfaced — "two filters silently pointing opposite ways with nobody having decided so" (Ravi, reconciliation §3.1). A different provenance policy on the same metric across two surfaces is defensible to a regulator **only when it is an explicit, documented, signed-off model-risk control with a reconciliation discipline behind it.** Two surfaces showing two different LCRs for the same bank at the same instant, with no documented control explaining why, is a textbook model-risk audit finding (PA/FSCA model-risk-governance expectations; aligned with SS1/23-equivalent supervisory practice) and would be raised by third-line (Thandiwe, CAE, via Vera) the moment it is examined.

**Resolution (Conditions 2 + 3):** the divergence is defensible **if and only if** (Condition 2) it is captured as a named model-risk control in the model register with both surfaces' provenance lenses and rationale documented and CRO-attested, *and* (Condition 3) the `recon:lcr-engine-parity` gate (Ravi's E4) is delivered as part of convergence so that, under a *common* provenance lens, the two surfaces are provably the same arithmetic — the divergence is then *only* the deliberate provenance difference, never an undetected computational drift. With both conditions, I concur the divergence is PA-defensible. Without them, the divergence is itself the finding, and I would dissent on G2.

---

## 4. G3 — RAS appetite-line ruling (my seat, BINDING)

This is the CRO's call. I rule as follows. **This ruling is binding on the RAS liquidity appetite line.**

### 4.1 Ruling

1. **The RAS liquidity appetite line reads the canonical engine's output** (post-convergence: the BA 325 shared core), under the **appetite-watch provenance lens (production + simulated, no fixtures)** — *not* the legacy `computeLCR`, and *not* the return's strict `production-only` lens. Rationale: a `production-only` appetite line is permanently `∞ / empty` during build phase and monitors nothing; the appetite line exists to give Risk visibility of the bank's liquidity posture *as it would be on the book being rehearsed*. The appetite-watch lens is therefore prod+simulated. I confirm this lens (the Treasurer correctly routed it to me).

2. **Build-phase `∞ / empty` (production-only) is ruled NOT-YET-MEASURABLE / WATCH-ONLY — and explicitly NEVER renders as a green/compliant appetite status.** `∞` here means "no production stress observed", not "infinite liquidity safety". It must surface with a build-phase annotation per **D-BUILD-PHASE-SYNTHETIC-RESPONSE**. A silent green on `∞` is prohibited — that is the precise failure this ruling forecloses.

3. **The combined-mode R265.6bn figure is ruled a STANDING WATCH ITEM, escalated — NOT auto-Tier-1-breach, NOT excluded, NOT silenced.** Because every contributing event is `simulated`, it must **not** auto-fire a RAS Tier-1 liquidity-breach escalation off the simulation harness (that would spam escalations off rehearsed data — exactly what D-BUILD-PHASE-SYNTHETIC-RESPONSE exists to prevent). But it must **not** be excluded or silenced either: the correct response is a standing `AgentEscalation` carrying the build-phase note, surfaced to the CRO each measurement cycle, recording that *if today's rehearsed FX-settlement book were live, the bank would be in an order-of-magnitude liquidity-appetite breach.*

4. **The R265.6bn must be annotated as a FLOOR, materially understated (CRO-specific finding).** Per my §1.2 reproduction, R265.6bn is the 25% floor on the ZAR-leg slice only, with ~R128.9bn of foreign-leg gross outflow dropped at the ZAR filter pending rate-enrichment. The watch item must state "**≥ R265.6bn, understated**", not present R265.6bn as the exposure ceiling. The appetite-watch must not anchor on a number that is itself a partial.

### 4.2 Why not the alternatives

- *Exclude simulated entirely (production-only appetite line):* rejected for the appetite-watch — it monitors nothing until commencement and gives Risk zero rehearsal value. (I *do* endorse `production-only` for the *return* — G2.)
- *Treat R265.6bn as a live Tier-1 breach now:* rejected — over-reacts to rehearsed data, violates D-BUILD-PHASE-SYNTHETIC-RESPONSE, and would degrade escalation signal-to-noise.

### 4.3 Commencement switch

At commencement-of-trading the appetite line auto-switches to live breach-triggering as the production book fills (the `production-only` filter then admits only `production`, and real flows replace the rehearsed ones). The watch-only treatment is strictly a build-phase posture; it must carry an explicit expiry tied to commencement, not an indefinite carve-out. (Condition 5.)

---

## 5. Conditions on CEO ratification

The CEO ratification of G1 / G2-divergence / G3-canonical-link should carry these **five binding conditions**:

1. **Canonical-as-target, not canonical-as-run.** BA 325 is designated canonical *together with* a committed, time-boxed E2 (union-denominator) convergence. Canonical status does not confer comfort on the as-run `∞/empty` denominator. Until E2 lands, the FX-settlement blind spot is a standing CRO watch item at HIGH model risk (§6).
2. **Document the divergence as a named model-risk control.** The deliberate return-vs-tile provenance difference is entered in the model register with both lenses, rationale, and CRO attestation. Markdown-without-control is not acceptable for a RAS-threshold metric.
3. **`recon:lcr-engine-parity` gate is a convergence deliverable, not optional.** Under a common provenance lens the two surfaces must be provably identical arithmetic (Ravi's E4); this is what makes the *remaining* divergence purely-provenance and therefore defensible.
4. **The 25% net-outflow floor becomes a CFO-owned calibrated constant** (`lcr.net-outflow-floor`, cited Reg 26(11)) read by the shared `computeLcrCore`, and the 75% inflow cap is unified to the single existing constant — *before* convergence is signed off. No binding regulatory parameter remains a code literal in the canonical engine (G4).
5. **Build-phase watch-only treatment carries an explicit commencement expiry.** The `∞/empty` and R265.6bn watch-only posture auto-converts to live breach-triggering at commencement-of-trading; it is not an open-ended carve-out.

---

## 6. Residual risk + model-risk rating

**Model-risk rating of the two-engine state until convergence (E1–E5) lands: HIGH.**

Justification: (a) the bank's single most material liquidity number (R265.6bn+, itself understated) is invisible to the engine being designated canonical; (b) two surfaces report materially different LCRs (143% tile vs ∞ return vs R265.6bn-if-admitted) for the same bank at the same instant with no parity control yet in place; (c) a binding regulatory parameter (the 25% floor) is a hardcoded literal with no calibration owner; (d) the `LE-BANK-SA` / `LE-ZA-HOZ-BANK` identifier split (reconciliation Finding C) means capital and flow reads sit on different entity identifiers, a data-quality fault line under the whole computation.

The rating is **HIGH** but **manageable under the five conditions** and **mitigated by build-phase context** — all contributing data is synthetic, there is no production book, no real depositor, no real capital at risk today (operating model, build phase). The rating reflects the *substrate* risk that this state persists into commencement, not a present prudential exposure. It steps down to MEDIUM when E2 (union denominator) + E4 (parity gate) land, and to LOW when E1–E5 complete and the floor is a calibrated constant. I will re-rate at each convergence milestone.

**Residual items routed:** the `LE-BANK-SA`→`LE-ZA-HOZ-BANK` remediation (reconciliation Finding C / E5) is a data-quality dependency I endorse routing to the Accounting & financial reporting engineering function (Bea, Accounting & financial reporting engineer, engineering) + Treasury / ALM engineering (Ravi); until it lands, capital reads cannot be cleanly entity-scoped and the appetite-line denominator carries that caveat.

---

## 7. Explicit verdict

**CONCUR-WITH-CONDITIONS.**

- **G1:** concur-with-conditions — BA 325 canonical *as target architecture*; canonical status packaged with committed E2 convergence (Condition 1).
- **G2:** concur-with-conditions — different provenance defensible *only* as a documented model-risk control with a parity gate (Conditions 2, 3).
- **G3 (my binding ruling):** appetite line reads canonical engine under prod+simulated watch lens; `∞/empty` = watch-only never-green; R265.6bn = standing escalated watch item per D-BUILD-PHASE-SYNTHETIC-RESPONSE, NOT auto-Tier-1, NOT excluded, annotated as a *floor / materially understated*; build-phase posture expires at commencement (Conditions 4, 5 attach).
- **G4:** concur — floor/cap to CFO-owned constants (Condition 4).

**Model-risk rating until convergence: HIGH** (manageable under the five conditions; mitigated by build-phase synthetic context).

**Point of divergence from the Treasurer:** I do **not** accept that canonicalising BA 325 *as-run* is risk-neutral. The Treasurer frames the as-run `∞/empty` as simply "correct"; I rule it is an institutionalised liquidity blind spot that is acceptable *only* under a time-boxed watch with committed E2 convergence. We agree on the destination (BA 325 canonical, union denominator, parity gate); we diverge on the risk characterisation of the interim, and on the firmness of the conditions that must bracket it.

---

## 8. Citations

- D-LCR-TILE-PROVENANCE (CEO directive, 2026-06-02; PR #1003 `c3ebec84`) — governs the tile provenance lens
- D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12)
- D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
- D-BUILD-PHASE-SYNTHETIC-RESPONSE — synthetic-data breach handling (surface, annotate, never silence)
- Regulations Relating to Banks Reg 26 (LCR), Reg 26(11) net-outflow floor, Reg 26A (NSFR)
- BCBS D295
- brief:helena:independent-cro-risk-challenge-of-canonical-lcr-:2026-06-02 (this brief)
- brief:eitan:joint-canonical-lcr-engine-recommendation-for-ce:2026-06-02 (Treasurer recommendation)
- brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02 (upstream reconciliation)
