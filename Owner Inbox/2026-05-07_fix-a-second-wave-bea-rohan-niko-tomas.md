---
title: Fix-(a) second wave — Bea, Rohan, Niko, Tomas keystone chains landed
author: Scrooge (orchestrating Bea, Rohan, Niko, Tomas)
date: 2026-05-07
summary: Four end-to-end Reg→Policy→Procedure→Capability chains landed, in upstream-dependency order. Bea (accounting) — POPULATED. Rohan (risk) — POPULATED. Niko (sales, FSP-conditional) — POPULATED, paused. Tomas (payments) — POPULATED, indirect-participant posture made structural. Procedures index 11 → 15 populated. Citation gate + prose-duplication recon green.
decision-required: false
---

# Fix-(a) second wave — Bea, Rohan, Niko, Tomas

**Author:** Scrooge (orchestrating four agent threads in sequence) · **Date:** 2026-05-07

This run completes the second wave of the fix-(a) demonstration Marc approved this morning — the Imani thread proved the pattern; this wave replicates it for the next four agents in upstream-dependency order. The shape of each thread is identical: substrate (typed register + JSON Schema) → stub policy bundle → keystone procedure → spec change-log → Owner Inbox report (bundle).

## Summary

| Agent | Substrate added | Stub policies (new at STUB) | Keystone procedure | Status |
|---|---|---|---|---|
| **Bea** | Chart of accounts (CoA) + posting-rule register | Accounting Policies (IFRS) v0.1; Financial Reporting & Disclosure v0.1 | `PROC-FIN-AC-01` Posting-rule publication | **POPULATED** |
| **Rohan** | Risk taxonomy + model registry | Provisioning / IFRS 9 ECL Policy v0.1 (RAS reused unchanged — Helena, in-force) | `PROC-RSK-EC-01` ECL stage projection refresh | **POPULATED** |
| **Niko** | FAIS advice-record schema + suitability questionnaire library | FAIS Policy v0.1 (FSP-conditional); Customer Treatment (TCF) v0.1 | `PROC-CRM-FA-01` FAIS advice-record capture | **POPULATED, paused (FSP-conditional)** |
| **Tomas** | ISO 20022 message catalogue + sponsor-bank operating-model | Payments Policy v0.1; Sponsor-Bank Operating Policy v0.1 (both new to register) | `PROC-OPS-PS-01` Outbound payment sponsor-bank channel | **POPULATED** |

Procedures index status summary: **11 → 15 populated** (and counting: still 4 of ~80 in absolute terms; the substrate shape is now load-bearing for the rest of the queue).

## Per-thread artefacts

### Bea — accounting

- [`prototype/platform/accounting/chart-of-accounts.schema.json`](../prototype/platform/accounting/chart-of-accounts.schema.json) + [`_chart-of-accounts.md`](../prototype/platform/accounting/_chart-of-accounts.md) (one populated entry: `ACC-1100-001` Cash and balances at SARB; multi-currency declared at account level per Principle 5; BA-line mapping embedded as a typed array).
- [`prototype/platform/accounting/posting-rule.schema.json`](../prototype/platform/accounting/posting-rule.schema.json) + [`_posting-rules.md`](../prototype/platform/accounting/_posting-rules.md) (one populated rule: `PR-CASHIN-001` Inbound cash receipt; balanced double-entry per currency per entity).
- [`Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`](2026-05-07_bea_finance-policies-bundle-v0.md) (Accounting Policies (IFRS) v0.1 STUB + Financial Reporting & Disclosure v0.1 STUB).
- [`Procedures/by-policy/posting-rule-publication.md`](../Procedures/by-policy/posting-rule-publication.md) (`PROC-FIN-AC-01`) — the meta-procedure: every postable event type gets a citation-checked, balanced, BA-mapped posting rule. Every other Bea procedure depends on this one running cleanly.
- [`Team/Bea.md`](../Team/Bea.md) v1.1 change-log — Substrate Gap §3 status updated.

Chain: `IFRS 9 / IAS 1 / Banks Act → ORG-AC-01..15 → Accounting Policies (IFRS) v0.1 → PROC-FIN-AC-01 → @platform/accounting/chart-of-accounts + @platform/accounting/posting-rules → ACC-1100-001 + PR-CASHIN-001 → PostingRulePublished event`.

### Rohan — risk

- [`prototype/platform/risk/risk-taxonomy.schema.json`](../prototype/platform/risk/risk-taxonomy.schema.json) + [`_risk-taxonomy.md`](../prototype/platform/risk/_risk-taxonomy.md) (one populated class: `RISK-CR-01` IFRS 9 three-stage credit risk).
- [`prototype/platform/risk/model-registry.schema.json`](../prototype/platform/risk/model-registry.schema.json) + [`_model-registry.md`](../prototype/platform/risk/_model-registry.md) (one populated model: `MOD-ECL-001` ECL staging engine v0.1, Tier 1, `draft` status pending validation).
- [`Owner Inbox/2026-05-07_rohan_risk-policies-bundle-v0.md`](2026-05-07_rohan_risk-policies-bundle-v0.md) (Provisioning / IFRS 9 ECL Policy v0.1 STUB; RAS reused unchanged — Helena's in-force RAS at `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`).
- [`Procedures/by-policy/ecl-stage-projection-refresh.md`](../Procedures/by-policy/ecl-stage-projection-refresh.md) (`PROC-RSK-EC-01`) — runs continuously on incremental events, fully re-projects daily; outputs not consumed by Bea until `MOD-ECL-001` validation lands (model-validation gate is structural).
- [`Team/Rohan.md`](../Team/Rohan.md) v1.1 change-log — Substrate Gap §8 status updated.

Chain: `IFRS 9 §5.5 / BCBS D350 → ORG-AC-02 + ORG-PR-21 → Provisioning / IFRS 9 ECL Policy v0.1 + RAS (in-force) → PROC-RSK-EC-01 → @platform/risk/risk-taxonomy + @platform/risk/model-registry → RISK-CR-01 + MOD-ECL-001 → StageTransition + RiskRunCompleted events → cross-domain to Bea via PR-ECL-* (planned)`.

### Niko — sales (paused, FSP-conditional)

- [`prototype/platform/sales/advice-record.schema.json`](../prototype/platform/sales/advice-record.schema.json) + [`_advice-record.md`](../prototype/platform/sales/_advice-record.md) (skeleton populated record — institutional IRD example with placeholder IDs).
- [`prototype/platform/sales/suitability-questionnaire.schema.json`](../prototype/platform/sales/suitability-questionnaire.schema.json) + [`_suitability-questionnaire.md`](../prototype/platform/sales/_suitability-questionnaire.md) (skeleton institutional-counterparty IRD questionnaire).
- [`Owner Inbox/2026-05-07_niko_conduct-policies-bundle-v0.md`](2026-05-07_niko_conduct-policies-bundle-v0.md) (FAIS Policy v0.1 STUB FSP-conditional; Customer Treatment Policy (TCF) v0.1 STUB).
- [`Procedures/by-policy/fais-advice-record-capture.md`](../Procedures/by-policy/fais-advice-record-capture.md) (`PROC-CRM-FA-01`) — operationally paused; runs as table-top exercises against Saskia's soft-franchise pipeline today; activates live at licence-day with FSP authorisation.
- [`Team/Niko.md`](../Team/Niko.md) v1.1 change-log — Substrate Gaps §2 + §3 status updated.

Chain: `FAIS Act / FSCA Conduct Standards / TCF → ORG-CD-01..06 → FAIS Policy v0.1 + Customer Treatment v0.1 → PROC-CRM-FA-01 → @platform/sales/advice-record + @platform/sales/suitability-questionnaire → AdviceRecord + SuitabilityQuestionnaire schemas → AdviceRecorded event (post-licence)`. Niko's seat status remains `paused` — this thread closes the chain anchoring; it does not change the operational pause.

### Tomas — payments

- [`prototype/platform/payments/iso-20022-message-catalogue.schema.json`](../prototype/platform/payments/iso-20022-message-catalogue.schema.json) + [`_iso-20022-message-catalogue.md`](../prototype/platform/payments/_iso-20022-message-catalogue.md) (one populated entry: `MSG-PACS-008-01` Customer Credit Transfer; three scheme contexts all `role: indirect-via-sponsor`).
- [`prototype/platform/payments/sponsor-bank-operating-model.schema.json`](../prototype/platform/payments/sponsor-bank-operating-model.schema.json) + [`_sponsor-bank-operating-model.md`](../prototype/platform/payments/_sponsor-bank-operating-model.md) (one placeholder relationship: `SPB-ZA-001`; the open sponsor-selection CEO decision card has its target landing here).
- [`Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md`](2026-05-07_tomas_payments-policies-bundle-v0.md) (Payments Policy v0.1 STUB; Sponsor-Bank Operating Policy v0.1 STUB; both new to the policy register).
- [`Procedures/by-policy/outbound-payment-sponsor-bank-channel.md`](../Procedures/by-policy/outbound-payment-sponsor-bank-channel.md) (`PROC-OPS-PS-01`) — indirect-participant posture is structural in the procedure; sponsor-bank channel envelope is its own step.
- [`Team/Tomas.md`](../Team/Tomas.md) v1.1 change-log — sponsor-onboarding ask flagged.

Chain: `NPS Act 78/1998 + SAMOS Rule Book + ISO 20022 → (no ORG-PS-* register IDs yet — see Mira ask) → Payments Policy v0.1 + Sponsor-Bank Operating Policy v0.1 → PROC-OPS-PS-01 → @platform/payments/iso-20022-message-catalogue + @platform/payments/sponsor-bank-operating-model → MSG-PACS-008-01 + SPB-ZA-001 → PaymentInitiated + PaymentSettled events → cross-domain to Bea via PR-CASHIN-001`.

## Cross-thread effects

A few useful structural side-effects this wave produced:

- **Imani's clause library is now load-bearing for two downstream agents.** The keystone clause `CL-GVL-001` (Governing law — South Africa) is implicitly cited by Tomas's sponsor-bank operating contracts (the next slice of Imani's clause-library — sponsor-bank correspondent-banking clauses — is the bottleneck for live sponsor onboarding). The Imani → Tomas dependency is now structurally explicit rather than prose-only.
- **Bea ↔ Rohan cross-domain handoff is structural.** `MOD-ECL-001` outputs a `StageTransition` event; Bea's keystone procedure consumes that event via a planned posting rule `PR-ECL-*`. The validation gate is honoured: Bea does not consume Rohan's outputs until the model is `in-use`. The structural pattern (event subscription, not direct call) preserves the measurer / accountant split per Rohan §15.
- **Tomas → Bea handoff via `PR-CASHIN-001`.** Tomas's `PaymentSettled` event is exactly the trigger Bea's keystone consumes to fire the cash posting rule. Same event-subscription pattern.
- **Indirect-participant posture made structural.** The previously-prose-only memory `project_indirect_participant_posture` is now embedded in: the sponsor-bank operating-model register (typed); the ISO 20022 catalogue's `schemeContexts.role` field (always `indirect-via-sponsor` for SAMOS / CLS / BankservAfrica); the keystone procedure's Step 5 (sponsor-bank channel envelope). The `D-LICENCE-TYPE` decision card on indirect participation now has a concrete substrate to refer to.

## Substrate gaps still open (this wave)

| Gap | Owner | Target | Notes |
|---|---|---|---|
| Close engine | Bea + Atlas | M2 | Posting rules can be published; auto-firing on event landing is the close engine. |
| Posting-rule validator (runtime) | Bea + Atlas | M2 | Today: hand-validation against schema; recon at event-emission time. |
| BA-return generator | Bea + Anya | Pre-licence | Consumes the `baReturnLines` array on each chart-of-accounts entry. |
| `MOD-ECL-001` independent validation | Helena (model-risk gate); Rohan | Pre-licence | Tier 1 model; cannot be `in-use` without independent validation per RAS B7. |
| Stress-test / scenario-replay engine | Rohan + Atlas | Pre-licence | Step 6 of `PROC-RSK-EC-01` (forward-looking overlay) waits on this. |
| Live CRM, suitability engine, advice-record store | Niko + Atlas + Mira | Pre-licence | All Niko substrate gaps; live operation requires FSP licence. |
| Voice / video / chat capture | Niko + Saskia + Senna | Pre-licence | Voice & Communications Recording Policy is `PLANNED` (Saskia bundle). |
| Live SAMOS / BankservAfrica / SWIFT / Strate / CLS connectivity | Tomas + Atlas + Senna (CSP) | Licence-day; pre-licence rehearsal under Saskia's go-live readiness gate | All scheme contexts in the catalogue are `synthetic-only`. |
| Sponsor-bank selection (`D-LICENCE-TYPE`-adjacent) | Saskia + Eitan to open the CEO decision card | Pre-licence | `SPB-ZA-001` is a placeholder; substrate awaits selection's outcome. |
| Imani clause-library — sponsor-bank correspondent-banking clauses | Imani | After governing-law family | Bottleneck for Tomas's `contractRef` populating; also Imani's published next slice. |
| Three-way reconciliation harness (trade ↔ payment ↔ ledger) | Tomas + Bea + Anya | M1 | Cross-cutting; consumes Tomas's events + Bea's posting outputs. |

## Asks and follow-ons

### For Owen (governance / register)

Please flip the following entries in [`Owner Inbox/2026-05-06_policy-register.md`](2026-05-06_policy-register.md):

| Policy | From | To |
|---|---|---|
| Accounting Policies (IFRS) | `PLANNED` | `STUB` (canonical source: Bea bundle) |
| Financial Reporting & Disclosure Policy | `PLANNED` | `STUB` (canonical source: Bea bundle) |
| Provisioning / IFRS 9 ECL Policy | `PLANNED` | `STUB` (canonical source: Rohan bundle) |
| FAIS Policy | `PLANNED` | `STUB, FSP-conditional` (canonical source: Niko bundle) |
| Customer Treatment Policy (TCF outcomes) | `PLANNED` | `STUB` (canonical source: Niko bundle) |

Please **add the following new entries** to the register at `STUB`, in a new section "Payments and operations" between Operations & technology and Markets:

| Policy | Owner | Approval | Cadence | Citation envelope |
|---|---|---|---|---|
| Payments Policy v0.1 (STUB) | Devon (with Tomas + Eitan + Imani) | BRC | Annual | NPS Act; SARB NPSD; scheme rulebooks; ISO 20022 |
| Sponsor-Bank Operating Policy v0.1 (STUB) | Devon (with Tomas + Imani + Saskia) | BRC | Annual | NPS Act; scheme rulebooks; ISDA / GMRA correspondent-banking clauses (planned) |

Also: Imani's bundle from this morning had the same ask (Contracting Policy + Document Execution Policy from `PLANNED` to `STUB`); please action together.

### For Mira (obligations register)

Please register a new **Domain N — Payment systems** in [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md), with `ORG-PS-*` entries covering at minimum:

- `ORG-PS-01` — National Payment System Act 78/1998 (recognition; settlement-bank designation).
- `ORG-PS-02` — SARB NPSD directives (cycle: per circular).
- `ORG-PS-03` — Designated participant rules under the Act (relevant to the indirect-participant posture).

Once registered, Tomas's keystone procedure replaces its direct `statute` and `scheme-rulebook` citations with `regulation` IDs, firming up the citation chain.

### For Saskia + Eitan (sponsor selection)

Please open the CEO decision card for sponsor-bank selection. Inputs the substrate is waiting on:

- Scheme coverage (SAMOS / BankservAfrica / SWIFT correspondent / Strate settlement agent / CLS Third Party — same sponsor across schemes, or split?).
- Counterparty-credit standing (Helena input).
- Operating cost.
- CSP attestation alignment (Senna input).
- Contract terms (Imani's clause library — sponsor-bank clauses are next slice).
- Reputational alignment (sponsor's market standing).

Once the decision lands, `SPB-ZA-001` populates with concrete data; the placeholder retires.

## Verification

- **Citation gate:** 8 events asserted, **0 violations**. The four new procedures + their substrate documents reconcile cleanly against the citation discipline.
- **Prose-duplication recon:** 53 assertions, **0 violations**. No canonical-source-registry duplications introduced.
- **Procedures index:** 4 new populated rows; status summary moved from 11 → 15 populated. 4 supporting `PLANNED` rows added under the new "Payments and operations" section for downstream Tomas procedures.

## What this enables

The fix-(a) pattern is now demonstrably replicable — five agent threads landed (Imani earlier today; Bea, Rohan, Niko, Tomas now) — each in roughly the same shape and weight. The remaining domain-blocked agents (Yael, Kai, Ravi) follow the same pattern; per the priority sequencing in this morning's report, they were behind the four landed today and now have the upstream substrate they need:

- **Yael (tax)** — needs Bea's chart of accounts (now substrate) + customer tax-residency from Niko's substrate (now substrate, FSP-conditional). Yael's keystone is the deferred-tax cycle on revenue events; revenue starts at licence-day so live runs await.
- **Kai (trading)** — needs Rohan's risk taxonomy + model registry (now substrate) + Imani's clause library for ISDA-bound trades (now substrate). Kai's keystone is the OMS pre-trade gateway; live runs await exchange connectivity.
- **Ravi (treasury / ALM)** — needs Rohan's models (now substrate) + Tomas's sponsor-bank operating model (now substrate). Ravi's keystone is the daily LCR / NSFR projection; live runs await funding flows.

If the pattern is right, Scrooge sequences Yael next, then Kai, then Ravi, on each agent's own cadence — same shape as today's runs, same Owner Inbox bundle pattern, same procedures-index growth.

## Asks of Marc

None — informational. The thread is complete; the gates pass; the chain reconciles bidirectionally for each of the four agents.

If Marc wants to inspect any one of the chains, the Owner Inbox bundle for each agent + that agent's keystone procedure is the readable entry point. The dashboard's 30s refresh will surface the new files; no further user action needed.

—Scrooge
