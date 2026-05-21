---
title: "D-OPRISK-ENGINEER-ROLE-LICENCE-DAY — Re-examine operational-risk-engineer staffing at the pre-licence go-live readiness gate"
agent: Owen (Company Secretary, governance)
trigger: ceo-decision-proposal
decisionId: D-OPRISK-ENGINEER-ROLE-LICENCE-DAY
decision-required: false
recommendation: Deferred — recommendation deliberately left blank until the pre-licence go-live readiness gate (PROC-MK-PLG-01) fires, when actual operational-loss event volume + Risk Return §3 cadence + Pillar 3 §3.6 first-issue load are observable.
record-kind: ceo-decision-proposal
workstream: WS-MARKET-RISK-PROCEDURES
brief: brief:owen:implement-d-oprisk-engineer-role-option-b-open-l:2026-05-21
runId: run:owen:2026-05-21T09-11-07-480Z
asOf: 2026-05-21T09:15:00Z
date: 2026-05-21
authority:
  - "CLAUDE.md — Decision authority routing (CRO bench staffing → CEO category)"
  - "Principles/6-autonomous-by-default.md"
  - "D-OPRISK-ENGINEER-ROLE (Option B approved 2026-05-21, PR #671) — this card is the licence-day successor"
citations:
  - "PR #671 — D-OPRISK-ENGINEER-ROLE Option B approval (Marc, CEO, 2026-05-21T08:50Z)"
  - "PR #666 — original D-OPRISK-ENGINEER-ROLE decision card (Owen, 2026-05-21)"
  - "Policies/regulatory-reporting-policy-v1.md §3 — Risk Return D4/2022 operational-risk content"
  - "Policies/pillar-3-disclosure-policy-v1.md §3.6 — Operational Risk Disclosures D10/2025"
  - "Team/_team-roster.json — canonical roster"
  - "Procedures/markets/pre-licence-go-live-gate.md — PROC-MK-PLG-01, the licence-day gate firing trigger"
  - "Team/Saskia.md — owner of the pre-licence go-live readiness substrate"
classification: ceo-only
register-key: decisions
status: requested
relatedDecisions:
  - "D-OPRISK-ENGINEER-ROLE"
trigger-for-reexamination: "PROC-MK-PLG-01 (pre-licence go-live readiness gate) firing — one of Devon (Chief Operating Officer, governance)'s gate-condition checks should be: has the operational-risk staffing posture been re-examined since D-OPRISK-ENGINEER-ROLE was approved Option B?"
---

# D-OPRISK-ENGINEER-ROLE-LICENCE-DAY — Re-examine operational-risk-engineer staffing at the pre-licence go-live readiness gate

> **Decision asked (at licence-day).** Given that `D-OPRISK-ENGINEER-ROLE` was approved Option B on 2026-05-21 (subsume into Rohan (Risk engineer, engineering) + Bea (Accounting & financial reporting engineer, engineering) + Vera (Internal audit engineer, engineering) + Devon (Chief Operating Officer, governance), sponsored by Helena (Chief Risk Officer, governance)), and given that the bank is now approaching the pre-licence go-live readiness gate where actual operational-loss event flow, Risk Return §3 cadence, and Pillar 3 §3.6 first-issue load are observable: **does the matrix arrangement remain fit-for-purpose, or does the licence-day workload justify a dedicated operational-risk engineer bench seat?**
>
> **Author.** Owen (Company Secretary, governance) — governance hygiene authority over bench staffing posture and persona-policy coherence.
>
> **Recommendation.** **Deferred.** This card is opened with phase `requested` and a deliberately blank recommendation. The recommendation cannot be authored responsibly today: the signals that would distinguish "keep the matrix" from "hire" do not exist in the build phase. The card stands ready for Owen to author a substantive recommendation when PROC-MK-PLG-01 fires.

---

## 1. Decision summary

This decision card is the **licence-day successor** to `D-OPRISK-ENGINEER-ROLE` (CEO-approved Option B on 2026-05-21 via PR #671). It re-asks the same staffing question — does the bank need a dedicated operational-risk engineer agent on Helena (Chief Risk Officer, governance)'s engineering bench? — but at the cadence where the answer is actually decidable.

The original card (PR #666) noted that the build-phase workload is **zero live loss events**: no clients, no payments, no positions taken against real markets, and therefore no operational-loss event flow against which to size a staffing posture. Option B (subsume into the existing bench) was approved on the explicit understanding that licence-day signal would either confirm the matrix is sufficient or surface the need for a dedicated seat.

This card holds that re-examination open. It is opened now (2026-05-21) so that:

1. Saskia (pre-licence go-live readiness engineer, engineering)'s `PROC-MK-PLG-01` (pre-licence go-live readiness gate) walkthrough has a concrete gate-condition reference — "has the operational-risk staffing posture been re-examined since D-OPRISK-ENGINEER-ROLE was approved Option B?" — that ticks visible on the decisions register.
2. The decision-card chain is auditable: PR #666 → PR #671 (approval) → this card (successor), all under the same `decisionId` family.
3. Owen's calendar of pending governance work carries an explicit licence-day item, not a memory note.

The decision authority remains CEO (CRO bench staffing in the build phase per CLAUDE.md decision-authority-routing). The expected authoring cadence is one Owen dispatch at licence-day, once PROC-MK-PLG-01 fires.

---

## 2. Context — what has changed since D-OPRISK-ENGINEER-ROLE was approved

### 2.1 What Option B set in motion

Option B distributed the six operational-risk substrate items across existing seats:

| Substrate item | Owner |
|---|---|
| `OperationalLossEvent` event type + Basel II taxonomy | Rohan (Risk engineer, engineering) |
| RCSA-cycle procedure delivery | Helena (Chief Risk Officer, governance) + Devon (Chief Operating Officer, governance) |
| KRI framework | Helena |
| Risk Return §3 generator | Bea (Accounting & financial reporting engineer, engineering) |
| Pillar 3 §3.6 disclosure renderer | Bea |
| SMA RWA computation engine | Rohan |
| Continuous assurance (RCSA control testing, loss-event coding, KRI breach) | Vera (Internal audit engineer, engineering) |
| Sponsorship + sign-off | Helena |

Each owner picks up their item under their standing workstream; no new bench seat was created in `Team/_team-roster.json`. The two policies (`Policies/regulatory-reporting-policy-v1.md` §3 and `Policies/pillar-3-disclosure-policy-v1.md` §3.6) were updated to name the contributor matrix (Block A of the implementing PR).

### 2.2 What the build phase still cannot tell us

Per CLAUDE.md "Operating model — what is real, deferred, paused" and the memory note `project_rules_bind_at_commencement.md`, banking-specific obligations bind at commencement-of-trading. Operational risk regulation is COMMENCEMENT-BIND:

- D4/2022 Risk Return §3 (operational-loss event submissions) activates at licence-day.
- D10/2025 Pillar 3 §3.6 (operational-risk disclosures) activates at the first Pillar 3 publication cadence after licence.
- SMA RWA reporting (operational-risk capital) activates at licence-day.

Until licence-day, the workload signal is:

- Zero live operational-loss events.
- Zero Risk Return §3 drafts under production cadence.
- Zero Pillar 3 §3.6 publications under live operations.
- Zero RCSA cycles run against real business lines.
- Zero KRI breaches against live process data.

These zeroes are the structural reason the original card recommended deferring the hire/no-hire decision: every signal the decision would turn on is structurally absent.

### 2.3 What licence-day will tell us

By the pre-licence go-live readiness gate (PROC-MK-PLG-01, owned by Saskia), the following signals will exist or be measurable in dry-run:

- **Dry-run loss-event flow.** Synthetic operational incidents against the dry-run scenarios (per the dry-run substrate that Saskia walks). Volume, complexity, taxonomy-coding burden, control-tagging burden — all observable.
- **First Risk Return §3 draft cadence.** Bea will have produced at least one Risk Return §3 against the synthetic loss-event projection under realistic quarter-end pressure.
- **First Pillar 3 §3.6 dry-run.** Bea will have produced the first Pillar 3 §3.6 disclosure draft against the synthetic substrate.
- **RCSA cycle dry-run.** Helena + Devon will have walked at least one full RCSA cycle against the business-line decomposition, with synthetic control-effectiveness ratings.
- **KRI framework population.** Helena will have populated the KRI framework with synthetic threshold breaches against the dry-run data, integrated into the RAS taxonomy.
- **SMA RWA computation rehearsal.** Rohan will have rehearsed the SMA RWA computation against the synthetic loss-event window and Business Indicator Component data.
- **Vera continuous-assurance pipeline.** Vera will have built and run at least one recon pipeline covering loss-event coding integrity and KRI breach reporting.

Each of those is a concrete signal: how much effort each owner spent on the operational-risk slice of their workstream, how much of that effort is *recurring* vs *one-time substrate-build*, and whether the matrix's diffuseness produced operational friction (handoff delays, coding inconsistencies, ownership ambiguity).

That signal is the input the licence-day re-examination needs. None of it is available today.

### 2.4 Why open the card now rather than at licence-day

Opening the card with phase `requested` today creates three immediate operational benefits:

1. **PROC-MK-PLG-01 has a concrete gate-condition citation.** When Devon walks the pre-licence-readiness gate at licence-day, one of the checks is "has the operational-risk staffing posture been re-examined since `D-OPRISK-ENGINEER-ROLE`?" — and the answer points to this card. Without this card, the gate-condition has nothing to point at.
2. **The decisions register carries the open item.** Marc and the dashboard see a pending licence-day item, not a memory note. The dashboard's decisions tile surfaces it; Owen's calendar of pending governance work carries it.
3. **The decision-chain is auditable.** PR #666 (original card) → PR #671 (approval) → this card (successor) is a citable chain. SARB / external auditor at licence-application can trace the operational-risk staffing question from first surface (PR #660 identity-drift sweep) through approval through licence-day re-examination — clean governance hygiene.

---

## 3. Options (at licence-day re-examination time)

These options will be re-scoped when the card fires; the sketches below are the *expected* shape, to seed Owen's licence-day authoring.

### Option A (sketch) — Extend the Option B matrix arrangement

If the licence-day workload signal shows that the matrix arrangement is operationally smooth (no handoff delays, no taxonomy-coding inconsistencies, no ownership ambiguity at Risk Return §3 publication time), keep the subsume arrangement live and close this card without a new bench seat.

### Option B (sketch) — Hire a dedicated operational-risk engineer

If the licence-day workload signal shows that the matrix arrangement is producing operational friction — recurring effort cumulative across Rohan + Bea + Helena + Devon + Vera exceeds what a dedicated agent would carry, or handoff coordination is taking measurable cycles per Risk Return cadence — author a role spec via PAX, brief Nolan to hire, and add the seat to `Team/_team-roster.json`. The substrate items already built under Option B lift to the new agent's roadmap.

### Option C (sketch) — Restructure the matrix

If the licence-day signal shows that *part* of the matrix is fine and *part* is creating friction (e.g. Rohan + Bea is smooth but RCSA cycle ownership between Helena and Devon needs a dedicated operational-risk engineer to carry), author a partial restructure: keep some items distributed, consolidate others into a new seat or a clearer single-owner shape.

The genuine shape of these options depends on signal not yet available. The sketches above are placeholders to seed the licence-day authoring; they are not the final option set.

---

## 4. Recommendation — deferred to licence-day

This card is opened with phase `requested` and the recommendation deliberately left blank. The reasoning:

- **The signals that would distinguish the options are structurally absent in the build phase.** Authoring a recommendation today would be reproducing the analysis from PR #666 with no new input — wasted effort and possibly misleading if licence-day signals turn out to point a different direction than current intuition.
- **The Option B approval is the standing arrangement.** Until this card is authored substantively at licence-day, Option B is in effect. There is no governance gap.
- **The author of the licence-day recommendation should be the author at that time** — Owen (or Owen's licence-day successor), with the licence-day signal in hand. Today's Owen is honest about the signal gap.

The recommendation section will be filled in at licence-day when PROC-MK-PLG-01 fires the re-examination trigger.

---

## 5. Implications — when this card fires

### Trigger event

PROC-MK-PLG-01 (pre-licence go-live readiness gate) firing. Devon (Chief Operating Officer, governance) walks the gate per the procedure; one of the gate-condition checks is operational-risk staffing posture re-examination. If the check is "not yet re-examined since D-OPRISK-ENGINEER-ROLE Option B approval (2026-05-21)", the trigger fires this card.

### Owen dispatch at trigger

A brief is opened for Owen to:

1. Pull the licence-day workload signal from the seven measurable inputs in §2.3.
2. Substantively author the options (replacing the sketches in §3 with the actual option set).
3. Substantively author the recommendation.
4. Set `decision-required: true` and `phase: "requested"` → `phase: "proposed"` for CEO review.
5. Update the dashboard decisions tile accordingly.

### CEO decision pathway

Marc reviews the substantively-authored card. Approval routes:

- Option A (extend matrix) → no new files; close this card as approved-status-quo.
- Option B (hire) → PAX research dispatch → Nolan hire dispatch → roster row added → policy text update (the contributor matrix in `regulatory-reporting-policy-v1.md` and `pillar-3-disclosure-policy-v1.md` gains a new named contributor).
- Option C (restructure) → mixed shape per the substantive options at that time.

### Cost line items

- Anthropic token spend: zero immediate increment (this is a placeholder card).
- Author time at trigger: one Owen dispatch for substantive authoring + one CEO review.
- If Option B is chosen at licence-day: PAX + Nolan + policy-update dispatches (per the original card's Option A implication shape).

---

## 6. Decision

```
[ ] Approved — Option A (extend the Option B matrix; close as approved-status-quo)
[ ] Approved — Option B (hire a dedicated operational-risk engineer)
[ ] Approved — Option C (restructure the matrix)
[ ] Sent back for more analysis

Authority: Marc (CEO)
Decided at: <pending — to be filled at licence-day when PROC-MK-PLG-01 fires>
Signature: <pending>
```

Routing on approval (at licence-day):
- Option A → close this card as approved-status-quo; no further dispatches.
- Option B → PAX role-research dispatch → Nolan hire dispatch → policy-update dispatch.
- Option C → Owen partial-restructure dispatch + selected onwards dispatches per the licence-day option specifics.

If sent back at licence-day: comment with the angle missing.

---

*Authored by Owen (Company Secretary, governance) under brief `brief:owen:implement-d-oprisk-engineer-role-option-b-open-l:2026-05-21`, run `run:owen:2026-05-21T09-11-07-480Z`, in worktree `agent-ae1b511ae6d647d63`, on branch `worktree-agent-ae1b511ae6d647d63`. Successor to `D-OPRISK-ENGINEER-ROLE` (PR #666, approved Option B in PR #671). Trigger for re-examination: PROC-MK-PLG-01 firing. CEO decision routing per CLAUDE.md "Decision authority routing". Identity discipline (name + position on first mention) observed throughout.*
