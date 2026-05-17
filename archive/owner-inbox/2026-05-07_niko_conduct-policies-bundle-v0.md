---
title: Conduct-policies bundle v0 — FAIS Policy and Customer Treatment Policy stubs
author: Niko (with Zara on policy substance)
date: 2026-05-07
summary: Two stub policies (FAIS Policy; Customer Treatment Policy / TCF) at v0.1 anchoring the keystone Reg→Policy→Procedure→Capability chain on Niko's substrate. Both were `PLANNED` (FAIS Policy is FSP-conditional); this stub moves them to `STUB` so the chain reconciles. Niko's seat remains operationally paused until licence-day.
decision-required: false
riskTaxonomy: [RT-CD, RT-CD.CC, RT-CD.TC]
---

# Conduct-policies bundle v0 — stubs

**Author:** Niko (with Zara as conduct-policy owner) · **Status:** `STUB` (policy register entries flip from `PLANNED` to `STUB`; FAIS Policy remains additionally `FSP-conditional`) · **Date:** 2026-05-07

## Why this stub exists

Niko's seat is paused for the build phase, but the substrate is being built so the lifecycle can light up cleanly at licence-day. Per Principle 6, the substrate (advice-record schema, suitability questionnaire, advice-capture procedure) cannot be authored without anchoring policies. The two policies referenced are `PLANNED` in the register; this bundle authors stubs so the citations resolve.

The substantive policy ownership sits with Zara (CCO, conduct policies in her bundle). The stubs here are minimal — they establish discipline lines for Niko's substrate and explicitly defer all substance to Zara's full BRC-approved policies.

---

## Policy 1 — FAIS Policy v0.1 (STUB, FSP-conditional)

**Owner:** Zara (with Niko + Saskia on substrate) · **Approval (target):** BRC · **Cadence:** Annual · **Citation envelope:** FAIS Act 37/2002; General Code of Conduct; FSCA Conduct Standards

> **Conditionality.** This policy fully activates only when the FSP licence is granted (`ORG-CD-02`). Until then it is a forward-compatible substrate definition.

### §1 Purpose

Govern the bank's operation as a financial services provider once FSP-licensed: advice and intermediary services on financial products to institutional counterparties.

### §2 Scope at licence-day

- Cat I (advice + intermediary services on listed equities, money-market, debt, derivatives — institutional only).
- Cat II (where carried) — discretionary investment.
- COFI-bill forward-compatibility tracked in the regulatory-change register.

### §3 Advice-record discipline

- Every advice interaction with a regulated client produces a typed advice record per [`prototype/platform/sales/_advice-record.md`](../prototype/platform/sales/_advice-record.md).
- The record is a **side-effect of the conversation**, not a post-hoc form: structured fields populate as the conversation unfolds.
- Records are immutable once archived; corrections are versioned amendments.
- Citations under Principle 2 are mandatory; FAIS / FSCA / TCF references resolve at archival.

### §4 Suitability discipline

- A typed suitability questionnaire (per [`prototype/platform/sales/_suitability-questionnaire.md`](../prototype/platform/sales/_suitability-questionnaire.md)) precedes any advice.
- Suitability outcome must be `suitable` (or escalation per Niko §10) before advice can be given.
- The institutional-only variant is the only operational variant; retail variants are out of scope per strategic foundation.

### §5 Rep authorisation

- Every rep is registered in the FAIS rep-register (paused with Sade's HR slice; activates licence-day).
- A rep cannot give advice on a product category for which they are not authorised; the constraint is enforced by the advice-capture procedure (`PROC-CRM-FA-01`).

### §6 Status of this stub

This is a **stub** and is **FSP-conditional**. The full FAIS Policy lands in Zara's annual policy cycle once the FSP licence is granted.

---

## Policy 2 — Customer Treatment Policy (TCF outcomes) v0.1 (STUB)

**Owner:** Niko (with Zara) · **Approval (target):** BRC · **Cadence:** Annual · **Citation envelope:** FSCA TCF outcomes; FAIS General Code; CPA where relevant

### §1 Purpose

Govern how the bank treats its clients in line with the FSCA's six TCF outcomes:

1. Confidence that the firm is trustworthy.
2. Products and services designed for identified target markets.
3. Clear, appropriate, timely information.
4. Advice that is suitable.
5. Products and services that perform as expected.
6. No unreasonable post-sale barriers to switching, complaint, claim.

### §2 Operationalisation

- Every TCF outcome is operationalised as one or more typed events + supporting procedures + Vera-monitorable controls.
- TCF outcome 4 (suitable advice) operationalises through the advice-record + suitability-questionnaire substrate.
- TCF outcome 3 (information) operationalises through fee disclosure, total-cost illustration, structured product term-sheets.
- TCF outcome 6 (no unreasonable barriers) operationalises through the complaints-handling procedure (Zara + Niko) and a structured switching / withdrawal flow.

### §3 Annual TCF review

Niko + Zara run the annual TCF review (per Niko spec §6). Findings flow as `AgentEscalation` events to Owen + the BRC.

### §4 Status of this stub

Same posture as the FAIS Policy stub; the full Customer Treatment Policy is on Zara's annual cycle.

---

## What the stubs unblock

| Artefact | Cites | Was blocked because |
|---|---|---|
| Advice-record schema | FAIS Policy v0.1 §3; Customer Treatment v0.1 §2 | Both `PLANNED`; substrate needed citable policy ancestors |
| Suitability questionnaire | FAIS Policy v0.1 §4 | Same |
| Procedure `PROC-CRM-FA-01` (advice-record capture) | FAIS Policy v0.1 §3–§5; Customer Treatment v0.1 §2 | Procedure must cite a policy under P6 |

## Substrate-gap notes

- **No FSP licence yet.** FAIS Policy is FSP-conditional. The substrate exists so the procedure lights up at licence-day with an FSP licence; until then the procedure runs as a Scrooge-coordinated table-top exercise against the soft-franchise pipeline.
- **No BRC-approved full policies yet.** Stubs are stubs.
- **Owen — please flip both register entries from `PLANNED` to `STUB`** in [`Owner Inbox/2026-05-06_policy-register.md`](2026-05-06_policy-register.md). For the FAIS Policy, additionally annotate "FSP-conditional" so the conditional activation is visible.
- **Niko's seat status** remains `paused` per CLAUDE.md build-phase rules. This thread closes the chain anchoring; it does not change the operational pause.
