---
title: "D-BRC-INTERIM-MR-1-FX — CEO interim-authority approval of Helena's MR-1-FX controlled-launch limit framework (BRC substitute, build-phase)"
agent: Owen (Company Secretary, governance)
trigger: ceo-decision-proposal
decisionId: D-BRC-INTERIM-MR-1-FX
decision-required: true
recommendation: Approve under Option A — CEO interim-authority approval of Helena's MR-1-FX controlled-launch limit framework (PR #634) as the build-phase substitute for Board Risk Committee tabling, with mandatory re-tabling at Board constitution. Mirrors the D-NPA-FX-SPOT-INTERNAL-TEST + board-notification build-phase-substitute pattern Marc approved 2026-05-21 (PR #674).
record-kind: ceo-decision-proposal
workstream: WS-MARKET-RISK-PROCEDURES
brief: brief:owen:author-ceo-decision-card-d-brc-interim-mr-1-fx-i:2026-05-21
runId: run:owen:2026-05-21T09-42-03-203Z
asOf: 2026-05-21T09:50:00Z
date: 2026-05-21
authority:
  - "Policies/market-risk-policy-v1.md §3 — 'recalibration requires Helena's recommendation and CEO (Board interim) approval'"
  - "Policies/market-risk-policy-v1.md §3.1 — 'limit expansion beyond a defined increase threshold requires CEO (Board interim) approval'"
  - "Policies/market-risk-policy-v1.md §6 — 'Approval: Board (CEO interim) constitutes the Market Risk Committee; BRC is the Board-level governance layer'"
  - "CLAUDE.md — Decision authority routing (Risk-appetite calibration / market-risk limits → CRO author; CEO build-phase substitute for BRC)"
  - "Principles/6-autonomous-by-default.md"
citations:
  - "PR #634 — Helena (Chief Risk Officer, governance) controlled-launch MR-1-FX limit proposal + compensating-control attestation block"
  - "PR #667 — Devon (Chief Operating Officer, governance) PROC-MK-PLG-01 meta-rehearsal (surfaced this as the second Open blocker)"
  - "PR #674 — D-NPA-FX-SPOT-INTERNAL-TEST approval (parallel build-phase-substitute pattern; Marc, CEO, 2026-05-21)"
  - "PR #672 — D-OPRISK-ENGINEER-ROLE-LICENCE-DAY (the licence-day re-tabling card pattern)"
  - "Policies/market-risk-policy-v1.md"
  - "Procedures/by-policy/market-risk-limit-monitoring.md (PROC-RISK-MRL-01)"
  - "Procedures/markets/pre-licence-go-live-gate.md (PROC-MK-PLG-01)"
  - "Procedures/by-policy/npa-gate.md (PROC-NPA-GATE-01)"
  - "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md"
  - "project_ai_driven_bank"
classification: ceo-only
register-key: decisions
status: requested
entity: LE-ZA-HOZ-BANK
relatedDecisions:
  - "D-NPA-FX-SPOT-INTERNAL-TEST"
  - "D-BRC-INTERIM-MR-1-FX-RETABLE"
---

# D-BRC-INTERIM-MR-1-FX — CEO interim-authority approval of Helena's MR-1-FX controlled-launch limit framework (BRC substitute, build-phase)

> **Decision asked.** Does Marc (CEO) grant **interim-authority approval** of Helena (Chief Risk Officer, governance)'s controlled-launch MR-1-FX limit framework (PR #634) — ZAR 350,000 1-day 99% VaR / USD 1m EOD position cap / USD 1.5m intraday peak / USD 500,000 per-counterparty daily notional cap, USD/ZAR only, with the eight trigger criteria of §1.8 governing any future lift to `live` and the compensating-control attestations for G-1 (no live FX feed), G-2 (FRTB SA unvalidated), G-5 (B-cluster automation absent) — as the **build-phase substitute** for Board Risk Committee (BRC) tabling, with mandatory re-tabling at Board constitution under `D-BRC-INTERIM-MR-1-FX-RETABLE` (placeholder card to be opened on approval)?
>
> **Author.** Owen (Company Secretary, governance) — governance hygiene authority over BRC-equivalent procedure and audit-trail integrity. Helena (Chief Risk Officer, governance) is the framework author; this card asks for the authorisation envelope, not for an edit to the framework.
>
> **Recommendation.** **Approve under Option A.** Mirrors the build-phase-substitute pattern Marc just approved for `D-NPA-FX-SPOT-INTERNAL-TEST` (PR #674): a governance body that does not yet exist (BRC) is substituted by CEO acknowledgment, with explicit re-tabling at Board constitution. The substantive risk envelope (Helena's framework) is unchanged; only the authorisation channel is build-phase-adapted.

---

## 1. Decision summary

This decision card asks Marc (CEO) to make Helena (Chief Risk Officer, governance)'s MR-1-FX controlled-launch limit framework (authored in PR #634) **operationally binding** for the internal pre-licence FX-spot test scope (cleared by `D-NPA-FX-SPOT-INTERNAL-TEST` in PR #674) by granting CEO interim-authority approval as the build-phase substitute for Board Risk Committee tabling.

`Policies/market-risk-policy-v1.md` is explicit on the authorisation channel for the MR-line family: §3 names "Board (CEO interim) for all RAS market risk lines; recalibration on material change or annual ICAAP cycle"; §3.1 names "limit expansion beyond a defined increase threshold requires CEO (Board interim) approval"; §6 names "Board (CEO interim) constitutes the Market Risk Committee; BRC is the Board-level governance layer". The phrase "CEO interim" in those three places is the policy's own provision for the build-phase posture this card operationalises.

Helena's PR #634 framework is the proposal; this card is the authorisation. The two are intentionally separated:

- **PR #634** answers "what numbers, what controls, what trigger criteria?" — the substantive market-risk content.
- **This card** answers "by what authority does the framework become binding?" — the governance channel.

The decision authority is **CEO** in the build phase per CLAUDE.md decision-authority-routing ("Risk-appetite calibration → CRO" for substantive design; "CEO (build phase)" for the Board-equivalent sign-off until governance-seat authorities are active). The policy's own "(CEO interim)" formulation in §3, §3.1, and §6 is direct policy authority for this routing.

**Three options** on the table: (A) CEO interim-authority approval, with re-tabling at Board constitution; (B) defer until Board constitution; (C) constitute an interim BRC composed of build-phase agents.

---

## 2. Context — what triggered this card

### 2.1 Devon's PROC-MK-PLG-01 meta-rehearsal surfaced the gap

Devon (Chief Operating Officer, governance)'s PROC-MK-PLG-01 (pre-licence go-live readiness gate) meta-rehearsal (PR #667, merged 2026-05-21) walked the gate conditions for internal FX-spot pre-licence test scope and returned two substantive Open blockers:

1. `BLOCKED-BY-NPA-fx-spot-schema-defined` — addressed by `D-NPA-FX-SPOT-INTERNAL-TEST` (Saskia (Head of Global Markets / Chief Markets Officer, governance) + Owen, approved by Marc 2026-05-21 in PR #674).
2. `BLOCKED-BY-NPA-fx-spot-risk-limits-set` — addressed by **this card**.

The second blocker is structural: Helena's MR-1-FX framework exists (PR #634, FINAL status, BRC-pack format in §3) but lacks an operationally-binding authorisation. PROC-MK-PLG-01 cannot satisfy the limits-set condition with a `FINAL` markdown alone; it needs a typed `Decision{phase:"approved"}` event against the framework.

### 2.2 The governance gap — no Board, no BRC

The bank has no Board Risk Committee because the bank has no Board. Per CLAUDE.md operating model ("real human directors ... only at licence-day, in the minimum number SA law requires") and the memory note `project_ai_driven_bank`, Board constitution is a licence-day statutory-minimum hire (5–10 humans including non-executive directors, BRC chair, audit committee chair).

`Policies/market-risk-policy-v1.md` §6 anticipates exactly this: "Board (CEO interim) constitutes the Market Risk Committee; BRC is the Board-level governance layer." The "(CEO interim)" formulation is the policy's own build-phase posture — the same posture this card operationalises.

### 2.3 The parallel pattern Marc just approved

The structural shape of this card is the same as the `board-notification` dimension in `D-NPA-FX-SPOT-INTERNAL-TEST` (PR #674, approved by Marc 2026-05-21):

| Aspect | D-NPA-FX-SPOT-INTERNAL-TEST | D-BRC-INTERIM-MR-1-FX |
|---|---|---|
| Governance body required | Board (for product notification) | BRC (for market-risk limit tabling) |
| Body exists today? | No (no Board) | No (no BRC) |
| Build-phase substitute | CEO acknowledgment via decision card | CEO interim-authority approval via decision card |
| Re-tabling at licence-day | Production-scope NPA gate (separate run) | `D-BRC-INTERIM-MR-1-FX-RETABLE` (this card's successor) |
| Substantive risk envelope | FX-spot internal-test scope | Helena's MR-1-FX framework (numerical limits + compensating controls) |
| Authorisation channel | CEO substitutes for Board | CEO substitutes for BRC |

The parallelism is intentional: Marc made the build-phase-substitute call for the product-notification dimension; the same call applies to the limit-calibration dimension because the structural cause is identical (no Board ⇒ no Board-derived committees).

### 2.4 What Helena's framework actually contains

PR #634 is Helena's BRC-tabled limit proposal + compensating-control attestation block. The numerical envelope:

| Limit | Value | Calibration anchor |
|---|---|---|
| MR-1-FX 1-day 99% VaR | ZAR 350,000 | Parametric VaR on USD 1m at 0.85% daily vol × 2.326 z-score, rounded down |
| EOD position cap | USD 1,000,000 (≈ ZAR 18.5m) | BRC-explainable round number; well below ExCon AD limit |
| Intraday peak | USD 1,500,000 | 1.5× EOD ceiling for normal flow management |
| Per-counterparty daily notional cap | USD 500,000 | 50% of EOD ceiling, single-counterparty concentration constraint |
| Pair scope | USD/ZAR only | Per `Policies/trading-mandate-v1.md §2.5` positive enumeration |
| Counterparty whitelist | Standard Bank Corp Treasury, Investec Bank Treasury | Both onboarded with live credit-limit-engine headroom |

The framework also defines **eight trigger criteria** (PR #634 §1.8) that must all be met before Helena will table a `live` (post-controlled-launch) limit calibration. The framework is intentionally tighter than the steady-state placeholder in the Trading Mandate (~14–27× tighter on the MR-1-FX line).

The **compensating-control attestation block** (PR #634 §2) covers three substrate gaps deferred past first trade: G-1 (no live FX feed), G-2 (FRTB SA engine unvalidated), G-5 (B-cluster Vera recon pipeline absent). For each gap, Helena attests to the standing compensating control and the deadline for substantive remediation.

This card does not modify any of the above. It asks Marc to make the framework operationally binding through CEO interim-authority approval.

---

## 3. Options

### Option A — CEO interim-authority approval (build-phase substitute)

Marc (CEO) approves Helena's MR-1-FX framework under explicit interim authority. The framework becomes operationally binding immediately for the internal pre-licence FX-spot test scope (cleared by `D-NPA-FX-SPOT-INTERNAL-TEST` in PR #674).

**Mechanics on approval:**

1. The `Decision` event for `D-BRC-INTERIM-MR-1-FX` moves from `phase:"requested"` to `phase:"approved"`.
2. The framework's numerical limits become the binding desk envelope for any FX-spot trade booked under the controlled-launch perimeter.
3. PROC-MK-PLG-01 Condition 2 (`NPA-fx-spot-risk-limits-set`) flips from Open to Satisfied on the next rehearsal run.
4. A placeholder successor card `D-BRC-INTERIM-MR-1-FX-RETABLE` is opened (phase `requested`, recommendation deferred) pinned to the pre-licence go-live readiness gate. At Board constitution at licence-day, the framework is re-tabled before the actual BRC; the successor card captures the re-tabling outcome.
5. Helena's framework PR #634 carries an immediate amendment to its frontmatter (`status: APPROVED-CEO-INTERIM`), or — preferable for substrate hygiene — a separate annotation file references this card as the operative authorisation envelope without modifying PR #634's content.
6. The compensating-control attestation block (PR #634 §2) is implicitly approved as part of the framework; Vera (Internal audit engineer, engineering) carries the standing assurance obligation against the attested controls.

**Pattern mirrors:** `D-NPA-FX-SPOT-INTERNAL-TEST` board-notification dimension (PR #674); `Policies/market-risk-policy-v1.md` §3 / §3.1 / §6 "(CEO interim)" provisions.

### Option B — Defer until Board constitution

Helena's framework stays in proposed-but-unapproved state. PR #634 remains `FINAL` (Helena's authoring status) but not operationally binding.

**Consequences:**

- Devon's PROC-MK-PLG-01 second Open blocker stays Open indefinitely.
- The internal pre-licence FX-spot test cleared in PR #674 cannot be exercised against a binding limit envelope; any synthetic trade booked at `/trade-book.html` operates against framework-as-documentation, not framework-as-binding-limit.
- The bank forfeits the build-phase opportunity to operate against a calibrated, BRC-explainable limit framework — a rehearsal-rigor regression.
- The framework's eight trigger criteria (§1.8) cannot accrue evidence ("20 consecutive business days clean at controlled-launch limits" cannot run if the limits aren't binding).
- Re-activation is the same as Option A's licence-day re-tabling: the framework is tabled at the real BRC once constituted. The only difference is build-phase ground-truth operation is lost.

This option is governance-conservative ("no live limit without real BRC sign-off") but at the cost of build-phase rehearsal value. The structural cause (no Board) is identical to the `board-notification` cause Marc already accepted CEO substitution for; consistency argues against deferring.

### Option C — Constitute an interim BRC

Marc constitutes an interim BRC composed of build-phase agents — candidates: Helena (chair, as CRO), Vera (Internal audit engineer, engineering — second-line assurance), Thandiwe (Chief Audit Executive, governance — third-line independence), Owen (secretarial), Marc (CEO). The interim BRC tables the framework and approves it via a recorded minute-event.

**Consequences:**

- Approvability is the same as Option A (framework becomes binding for internal-test scope).
- Adds a governance body to the bank's operating diagram that **does not match the eventual statutory Board structure**. Real BRCs sit under a real Board with non-executive director composition (per Banks Act + King IV); a build-phase agent-composed BRC is structurally different.
- Creates a SARB licence-application coherence risk: "what is this committee that doesn't exist in your governance framework?" The committee would need to be explicitly disbanded at Board constitution, which is operational overhead for marginal substantive gain over Option A.
- Adds 2–3 PRs of interim-BRC scaffolding (constitution decision, minute event type if not already covered, dashboard register tile, secretarial procedure).
- Sets a precedent for substituting other Board-derived committees the same way (Audit Committee, Remuneration Committee, etc.) — a substrate proliferation that should be deferred unless build-phase value is high.

Option C is the most "governance-orthodox" reading of the gap but produces a structure the bank will dismantle within months. The marginal value over Option A (a recorded minute event vs. a CEO decision-card event) does not justify the substrate footprint.

---

## 4. Recommendation

**Approve under Option A.**

The substantive content of Helena's framework is unchanged across all three options; the choice is purely about the authorisation channel. Three reasons favour Option A over B and C:

1. **Consistency with the already-approved pattern.** Marc approved `D-NPA-FX-SPOT-INTERNAL-TEST` (PR #674) on 2026-05-21 using the CEO-substitute-for-Board pattern for the `board-notification` dimension. The structural cause here is identical (no Board ⇒ no BRC). Approving one and deferring the other would create a coherence gap in the build-phase governance posture; consistency argues for Option A.

2. **Policy text authorises it directly.** `Policies/market-risk-policy-v1.md` §3 ("Board (CEO interim) for all RAS market risk lines"), §3.1 ("CEO (Board interim) approval"), and §6 ("Board (CEO interim) constitutes the Market Risk Committee") are explicit. The "(CEO interim)" parenthetical is the policy's own provision for exactly this situation. Option A is not a workaround; it is the policy's stated build-phase channel.

3. **Build-phase rehearsal value is real.** Devon's PROC-MK-PLG-01 rehearsal exists to surface integration gaps before licence-day. A bound limit envelope lets Helena's eight trigger criteria (§1.8) accrue evidence; lets Rohan's daily limit-utilisation reporting operate against real numbers; lets Vera's compensating-control assurance pipelines (against the G-1/G-2/G-5 attestations) be exercised against a live envelope. Option B forfeits all of that. Option C delivers it at the cost of a structure the bank will dismantle.

The no-pause posture for governance bodies that do not yet exist (a pattern that has guided D-NPA-FX-SPOT-INTERNAL-TEST and the broader build-phase substrate) is the right operational stance. Approve.

Re-tabling at Board constitution is non-negotiable. The mandatory placeholder successor card `D-BRC-INTERIM-MR-1-FX-RETABLE` (phase `requested`, recommendation deferred to licence-day) is opened on approval, pinned to the pre-licence go-live readiness gate per the D-OPRISK-ENGINEER-ROLE-LICENCE-DAY pattern (PR #672). When the real BRC convenes at licence-day, the framework is re-tabled; the successor card captures the outcome; if the real BRC approves it, the interim-authority approval is superseded; if the real BRC amends or rejects it, the framework is recalibrated under the real authority channel and any in-flight trading is paused / reduced per the recalibrated envelope.

— Owen (Company Secretary, governance), 2026-05-21

---

## 5. Implications

### If Option A approved

- `Decision{decisionId:"D-BRC-INTERIM-MR-1-FX", phase:"approved", authority:"CEO", entity:"LE-ZA-HOZ-BANK"}` event emitted under `recordDecision` with `authorityRef:"marc@tgv.co.za"` and `recordedVia:"scrooge:session-delegation"`.
- Helena's MR-1-FX framework (PR #634) becomes operationally binding for the internal pre-licence FX-spot test scope.
- PROC-MK-PLG-01 Condition 2 (`NPA-fx-spot-risk-limits-set`) flips Open → Satisfied on next rehearsal.
- Successor card `D-BRC-INTERIM-MR-1-FX-RETABLE` opened (phase `requested`, recommendation deferred) — one Owen dispatch, mirrors PR #672 shape.
- Rohan's daily market-risk reporting begins operating against the bound envelope; Vera's compensating-control assurance pipelines exercise against the attested G-1/G-2/G-5 controls; Helena's eight trigger criteria begin accruing evidence.
- No change to PR #634 content; an annotation file `2026-05-21_owen_brc-interim-authority-mr-1-fx_annotation.md` references this card as the operative authorisation envelope. Helena's framework remains canonical for substance.
- No new substrate beyond the annotation file and the successor card.

### If Option B (defer)

- Framework stays unapproved; PR #634 remains as documentation.
- Devon's PROC-MK-PLG-01 second blocker stays Open.
- Internal pre-licence FX-spot test cleared in PR #674 cannot operate against a binding envelope — rehearsal value lost.
- Helena's eight trigger criteria cannot accrue evidence.
- Re-activation pathway: framework tabled at the real BRC at Board constitution; everything above is deferred to that point. Net outcome at licence-day is identical to Option A's re-tabling step, but build-phase rehearsal is forfeited.

### If Option C (constitute interim BRC)

- 2–3 PRs of interim-BRC scaffolding: constitution decision card, `InterimBrcMeetingMinuted` event type (or alias to `MarketRiskCommitteeMeetingMinutes`), dashboard register tile, secretarial procedure.
- Interim BRC convenes, tables the framework, approves it via recorded minute event.
- Net outcome on the framework is the same as Option A (framework becomes binding).
- SARB licence-application coherence risk on the auditor question "why does your governance framework include a committee that doesn't match Banks Act board-derived committee structure?"
- Interim BRC requires explicit disbandment decision at Board constitution; operational overhead for marginal substantive gain.

---

## 6. Decision

```
[ ] Approved — Option A (CEO interim-authority approval; framework operationally binding; D-BRC-INTERIM-MR-1-FX-RETABLE opened)
[ ] Approved — Option B (Defer until Board constitution)
[ ] Approved — Option C (Constitute interim BRC; framework approved via interim-BRC minute)
[ ] Sent back for more analysis

Authority: Marc (CEO)
Decided at: <pending>
Signature: <pending>
```

Routing on approval:

- **Option A** → `recordDecision({phase:"approved", ...})` emit + annotation file authored + `D-BRC-INTERIM-MR-1-FX-RETABLE` placeholder card opened (one Owen dispatch). Devon's PROC-MK-PLG-01 rehearsal re-run picks up Condition 2 = Satisfied.
- **Option B** → No event emit beyond this card's `phase:"requested"` (already recorded). Devon's blocker persists; deferred to licence-day.
- **Option C** → Interim-BRC constitution decision card + minute event type + secretarial procedure (Owen + Atlas (Substrate engineer, engineering) co-author).

If sent back: comment with the angle missing — most likely candidates are (i) clarification on which specific market-risk-policy §3 / §3.1 / §6 "(CEO interim)" provision binds; (ii) request to see the compensating-control attestation evidence (which sits in PR #634 §2); (iii) request to vary the successor-card trigger (currently pinned to PROC-MK-PLG-01 firing, alternative would be the BRC-constitution event itself).

---

*Authored by Owen (Company Secretary, governance) under brief `brief:owen:author-ceo-decision-card-d-brc-interim-mr-1-fx-i:2026-05-21`, run `run:owen:2026-05-21T09-42-03-203Z`, in worktree `agent-a9396abeb52bf2fde`. Mirrors the build-phase-substitute pattern Marc approved in `D-NPA-FX-SPOT-INTERNAL-TEST` (PR #674, 2026-05-21). The substantive framework (Helena (Chief Risk Officer, governance)'s PR #634) is unchanged; this card asks only for the authorisation envelope. CEO decision routing per CLAUDE.md "Decision authority routing" and `Policies/market-risk-policy-v1.md` §3 / §3.1 / §6 "(CEO interim)" provisions. Identity discipline (name + position on first mention) observed throughout.*
