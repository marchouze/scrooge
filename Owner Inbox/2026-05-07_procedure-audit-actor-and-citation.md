---
title: Procedure audit — actor + Principle-2 citation for human-default steps
author: Vera · Scrooge
date: 2026-05-07
summary: All 11 populated procedures audited under Wave-4 #11/#12. 6 GREEN, 5 AMBER, 0 RED. Five findings (F-1 to F-5) routed to named owners; two GREEN-template procedures named as the P2-conformant idiom for the rest to adopt.
decision-required: false
---

# Procedure audit — actor + Principle-2 citation for human-default steps

**Author:** Vera (Internal audit / continuous-assurance engineer) — *consulting role per her conflicts register; the audit-charter sub-clause Owen will add formalises this scope.*
**Reviewed by:** Scrooge (Chief of Staff) for cross-cutting framing
**For:** Marc (CEO)
**Date:** 2026-05-07
**Authority:** Step 3 of the four-step Principle-7 rollout (CCM extension ✓ → persona-spec rollout ✓ → runtime substrate spec ✓ → **procedure audit**). Tests against Wave-4 pipeline #11 (`procedure-actor.ts`) and Wave-4 pipeline #12 (`mandate-agent.ts`) per `Owner Inbox/2026-05-07_vera_agent-discipline-assurance-extension.md`.
**Scope:** All 11 populated procedures in `Procedures/by-policy/`. Planned procedures (~70) excluded; they will be audited against the same checks at population time.

> **Derivation note (Principle 6 — downward).** This audit is a query over the procedures library, the obligations register, the policy register, and the persona library. It does not author new substance.

---

## 1. What the audit asserts

Two conjoint checks per procedure step (Wave-4 #11 + #12):

1. **Actor discipline.** Every step names a typed actor. Under Principle 7, the default is an *agent* (a named persona resolvable in `/Team/<name>.md`). `human` actors are exceptions; each must carry a Principle-2 citation justifying why the action cannot be (or should not be) automated.
2. **Mandate ↔ agent reconciliation.** The procedure's owner field resolves to a mandate-bearing agent (i.e. a persona with the agent-spec format introduced in `Team/_agent-spec-template.md`). Owners that resolve to character-sheet personas are findings until upgraded.

The audit does **not** assert that humans should be removed from the loop. It asserts that any human-in-the-loop step must be *justified by a structured citation* — exactly the Principle-2 discipline already in force for events.

## 2. Summary

| Procedure | Steps | `system`-only | `human` (cited per-step) | `human` (cited at procedure level) | `human` (weak / unclear citation) | Owner agent-shaped today | Verdict |
|---|---|---|---|---|---|---|---|
| capital-ratio-monitoring | 11 | 9 | 0 | 2 (§8 narrative) | 0 | Camille ✗ · Helena ✓ · Eitan ✗ · Bea ✗ | **AMBER** — §8 names Camille's sign-off as human, but no step table row reflects it; weak P2 grounding ("legal accountability" without URN) |
| ceo-decision-review | 6 | 1 | 1 (CEO via §Citations) | 0 | 2 ("Author", "Affected owners") | Owen ✗ · Scrooge (in CLAUDE.md) | **AMBER** — generic actors "Author" and "Affected owners" do not resolve to named agents; CEO step is well-grounded |
| change-management | 11 | 0 | 0 | 6 (§2 + §8 narrative) | 0 | Devon ✗ · Atlas ✓ · Senna ✗ | **AMBER** — §8 manual-step justifications use lay language ("engineer's judgement") without obligation URNs |
| conflicts-declaration | 10 | 2 | 0 | 6 (§2 + §8 narrative) | 0 | Owen ✗ · Helena ✓ · Zara ✗ | **GREEN** — Companies Act ss.75–77 mandates human declaration; the human-default is the regulation; §8 names each manual step |
| incident-response | 12 | 0 | 0 | 8 (§2 + §8 explicit P2) | 0 | Senna ✗ · Iris ✗ · Zara ✗ | **GREEN** — §8 explicitly invokes "tracked exception under P2"; Joint Standard 1 of 2024 + BCBS Op Resilience grounding |
| kyc-onboarding | 9 | 5 | 0 | 3 (§2 + §8 explicit P2) | 0 | Zara ✗ · Mira ✓ | **GREEN** — §8 explicitly: "tracked exceptions under P2; each is a typed event with the actor identity recorded" |
| popia-breach-notification | 11 | 1 | 0 | 9 (§2 + §8 explicit P2) | 0 | Iris ✗ · Senna ✗ · Zara ✗ | **GREEN** — §8 explicitly P2-grounded; statutory POPIA s.22 duties |
| popia-dsar | 11 | 5 | 0 | 5 (§2 + §8) | 0 | Iris ✗ · Anya ✗ · Senna ✗ | **GREEN** — §2 cites POPIA ss.23/24/71/Reg.4; §8 names each manual step |
| pricing-approval | 12 | 9 | 0 | 3 (§2 + §8) | 0 | Niko ✗ · Helena ✓ · Eitan ✗ · Camille ✗ · Zara ✗ | **AMBER** — §8 names manual steps but cites them as "commercial judgement" / "conduct judgement" without per-step URN |
| sanctions-screening | 8 | 5 | 1 (Step 6 MLRO via §2) | 2 (§2 + §8 explicit P2) | 0 | Zara ✗ · Mira ✓ · Senna ✗ | **GREEN** — strongest P2 grounding (Sanctions Policy + RAS B4 + FIC s.29(3) tipping-off); MLRO authority cryptographically gated |
| secure-sdlc | 13 | 9 | 0 | 4 (§2 + §8) | 0 | Senna ✗ · Rashida ✗ · Atlas ✓ | **GREEN** — Joint Standard 1 of 2024 + ISO 27001 + NIST SSDF + SLSA v1.0; §8 names manual steps with security-reviewer-judgement basis |

**Roll-up:** 11 procedures audited. **6 GREEN**, **5 AMBER**, **0 RED** (no procedure has a fundamentally unjustified human-default step). **All 11** have at least one owner-agent that is not yet agent-shaped — pipeline #12 will run mostly red until the persona-rollout tranches 2–3 land.

## 3. Findings to remediate

### Finding F-1 — `capital-ratio-monitoring` step 10 actor mismatch (HIGH)

**Subject:** `Procedures/by-policy/capital-ratio-monitoring.md` step 10.
**Observed:** Step 10 actor is `system`. §8 (Manual steps) states "Camille's sign-off on the generated BA return is human (legal accountability)". The step table does not reflect Camille as a step actor anywhere.
**P2 anchor:** Banks Act 94 of 1990 + SARB Prudential Authority practice (BA returns are signed by the named accountable person to the PA — `ORG-PR-01` in the obligations register).
**Remediation:** Add a step 10a: `Camille reviews and signs the generated BA return content`. Actor: `agent:camille → human (signature)`. Capability: `@platform/multi-sig`. Notes column should cite the Banks Act obligation URN.
**Owner:** Bea (engineering author) + Camille (governance signatory). Owen routes to AC reading.

### Finding F-2 — `change-management` §8 lay-language citations (MEDIUM)

**Subject:** `Procedures/by-policy/change-management.md` §8 (Manual steps).
**Observed:** §8 enumerates 6 manual touch-points but justifies each with lay language ("engineer's judgement", "human-driven communications") without naming the obligation URN. §2 has rich citations (Joint Standard 1 of 2024 ORG-CY-01/03, BCBS Op Risk, BCBS Op Resilience) but the linkage from §8 to §2 is implicit.
**P2 anchor:** Already in §2; needs to be reflected per-manual-step.
**Remediation:** Rewrite §8 in the incident-response style — "Each manual step is a tracked exception under P2 with citation" — and add per-step URNs (e.g. step 6 DoA approval cites Companies Act + Governance Framework DoA matrix; step 7 pre-notification cites PA Directive 3 of 2018 where applicable).
**Owner:** Devon (procedure governance) + Atlas (engineering co-owner) + Senna (security gate). Owen routes to AC reading.

### Finding F-3 — `pricing-approval` §8 lay-language citations (MEDIUM)

**Subject:** `Procedures/by-policy/pricing-approval.md` §8.
**Observed:** §8 cites "commercial judgement" / "conduct judgement" without per-step URN. §2 has FAIS + FSCA conduct standards + RAS B2 + BCBS Market Risk grounding.
**P2 anchor:** Already in §2; needs per-step linkage.
**Remediation:** Same as F-2 — adopt the IR-style "tracked exception under P2 with citation" formulation, with per-step URN references (step 7 TCF cites FAIS + FSCA TCF outcomes; step 9 multi-sig cites RAS / capital cost / FTP attribution).
**Owner:** Niko + Zara + Helena + Eitan + Camille. Owen routes.

### Finding F-4 — `ceo-decision-review` generic human actors (MEDIUM)

**Subject:** `Procedures/by-policy/ceo-decision-review.md` steps 1, 5.
**Observed:** Step 1 actor is `Author (any team member)` — generic, does not resolve to a named agent. Step 5 actor is `Affected owners` — equally generic.
**P2 anchor:** Under Principle 7, both should resolve to the agent that owns the deliverable's substance (step 1) and the agents that consume the resolved decision (step 5).
**Remediation:** Step 1 actor → `agent (drafting the deliverable's substance — resolved by deliverable subject-matter)`. Step 5 actor → `agents whose specs reference the decision's subject — substrate routes via subscriptions to `CeoDecision` events`. Notes column: "Resolution to a specific agent ID happens at substrate-runtime registration; until A1, Scrooge maintains the manual map."
**Owner:** Owen (procedure custodian) + Scrooge (orchestration). Atlas's substrate (A1) makes this fully agent-resolvable.

### Finding F-5 — Generic `system` actor across all procedures (LOW, but pervasive)

**Subject:** All 11 populated procedures.
**Observed:** The actor field reads `system` (or `system + human`) without naming the specific agent that the substrate will route the call to. This is the legacy of authoring before Principle 7 was explicit doctrine.
**P2 anchor:** No regulatory issue today — `system` is acceptable as a stand-in for "code, no human discretion". Under Principle 7, however, `system` becomes `agent:<name>` because the agent identity carries permissioning, signing keys, and audit-trail attribution.
**Remediation:** Update `Procedures/templates/procedure-template.md` to require named-agent actors (`agent:mira`, `agent:atlas`, etc.) in the step table. Backfill the 11 populated procedures in a single pass once Tranche 2 and Tranche 3 of the persona rollout land (the relevant agents need to be spec'd before they can be named). Estimated: 1 working day of authoring across all 11 procedures.
**Owner:** Owen (template + index custodian). Coordinated with each procedure's domain owner.

## 4. Strengths to standardise

The following procedures are templates the rest should adopt:

- **`incident-response.md` §8** — explicit "tracked exception under P2" formulation with the procedure-level citation block (§2) doing the URN heavy-lifting. Cleanest P2 idiom in the library.
- **`sanctions-screening.md` §8** — combines the §2 procedure-level citations with cryptographic enforcement of the human authority (MLRO override only). Demonstrates that "human" can be a *constraint* on the system, not just a step in it.
- **`kyc-onboarding.md` §8** — "each is a typed event with the actor identity recorded" — gives Vera's pipelines #11 and #15 a clean signal at audit time.
- **`secure-sdlc.md`** — strongest §2 citation block (Joint Standard 1 of 2024 + ISO 27001 + NIST SSDF + SLSA v1.0); each manual step is a security-reviewer judgement bound to a CI-enforced gate.

These four procedures effectively define the P2-conformant idiom; the AMBER findings remediate the other procedures into the same idiom.

## 5. Cross-cutting recommendations

### 5.1 Update the procedure template

`Procedures/templates/procedure-template.md` §5 (Steps) must:

- Require the **Actor** field to name an agent — `agent:<name>` — or a named human (`human:<persona>`) where Principle-2-cited.
- Require the **Notes** column to carry the specific obligation URN where the step is human-default.

§8 (Manual steps) must:

- Adopt the standardised opening: "Each manual step is a tracked exception under P2 with the citation listed in the Notes column of §5 and elaborated below."
- Per-step bullets explicitly cite the URN, not lay language.

This template change is itself a "no orphan capability" item: the change is approved through Owen's procedural-discipline route at the next IAF reading, and Vera's pipeline #11 becomes the post-merge enforcement mechanism.

### 5.2 Sequence with the persona rollout

- **Findings F-1, F-2, F-3** can be remediated *now* (they don't depend on the agent runtime).
- **Findings F-4, F-5** are best remediated *after Tranche 2 + Tranche 3 of the persona rollout land*, because the named agents (Owen, Devon, Camille, Senna, Iris, Thandiwe, Rashida, Zara, Rohan, Tomas) need their agent-specs first. Until then, F-4 and F-5 carry an explicit "to be resolved at A1 substrate registration" note and pipeline #11 emits warn-severity (not fail-severity).

### 5.3 Wave-4 #11 calibration

When Vera's pipeline #11 (`procedure-actor.ts`) ships, the severity calibration is:

- `fail` — a human-default step with **no** procedure-level §2 citation **and** no per-step URN. (Today: zero such steps. Pipeline runs green on this strict assertion.)
- `warn` — a human-default step with §2 citation but no per-step URN, or with lay-language §8 ("engineer's judgement"). (Today: ~25 such steps across change-management, capital-ratio-monitoring, pricing-approval, ceo-decision-review.)
- `info` — a `system`-actor step that hasn't been migrated to `agent:<name>` form. (Today: ~50 such steps across all procedures.)

The `info` rate becomes a roadmap signal — closing it is the persona-rollout / template-update work.

### 5.4 Mandate ↔ agent reconciliation (pipeline #12)

Pipeline #12 will run mostly red until tranches 2–3 land:

- **Today (vanguard four agent-shaped):** Atlas, Helena, Mira, Vera. Of the 11 procedures, only `kyc-onboarding` (Mira) and `sanctions-screening` (Mira) and `change-management` (Atlas, partial) reconcile to fully-agent-shaped owners. Others have at least one character-sheet owner.
- **Post-Tranche 2:** Owen, Zara, Camille, Devon, Rohan agent-shaped. Reconciliation rises sharply — ~9 of 11 procedures fully reconciled.
- **Post-Tranche 3:** Senna, Rashida, Iris, Thandiwe, Tomas agent-shaped. All 11 populated procedures fully reconciled.

This sequencing is the rationale for Tranche 2 → Tranche 3 → audit-rerun in the persona-rollout note's §4.

## 6. What this audit does *not* do

- **Does not audit planned procedures** (~70). They are picked up at population time against the same checks. Owen's procedural-discipline review at population is the gate.
- **Does not test reconciliation events.** The reconciliation checks named in each procedure's §6 are pipeline #11's *next* concern; this audit is structural (the §5 step table) only.
- **Does not test the obligations register** for citation accuracy. That is Vera Wave-3 pipeline #7 (planned). Today's audit assumes §2 citations are accurate.
- **Does not adjudicate whether a given human step *should* remain human** — it asserts only that the human-default carries a citation. The substantive question "could this be automated?" is the agent-spec author's recurring question (Principle 7's "review periodically for whether automation has caught up").

## 7. Open items routed elsewhere

- **To Owen:** template update per §5.1; AC reading for findings F-1 through F-5 remediation; updates to `Procedures/_index.md` to reflect the audit cycle.
- **To Bea + Camille:** F-1 remediation on capital-ratio-monitoring step 10.
- **To Devon + Atlas + Senna:** F-2 remediation on change-management §8.
- **To Niko + Zara + Helena + Eitan + Camille:** F-3 remediation on pricing-approval §8.
- **To Scrooge:** F-4 remediation pre-Atlas-A1; manual agent-resolution map until substrate registers agents.
- **To Vera:** calibrate pipeline #11 severity (§5.3) at implementation; produce baseline report on first run.
- **To Mira:** confirm `automated-decisioning` obligation cluster (POPIA s.71 + Joint Standard 1 of 2024 + BCBS AI/ML guidance) is in the obligations register so step-level citations on agent-default steps have URNs to point to.

—Vera (audit) · Scrooge (cross-cutting framing)
