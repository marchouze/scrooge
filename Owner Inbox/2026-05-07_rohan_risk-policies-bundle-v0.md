---
title: Risk-policies bundle v0 — Provisioning / IFRS 9 ECL Policy stub
author: Rohan
date: 2026-05-07
summary: Stub Provisioning / IFRS 9 ECL Policy at v0.1 anchoring the keystone Reg→Policy→Procedure→Capability chain on Rohan's risk substrate. The Risk Appetite Statement (Helena, EXISTS) is reused unchanged. One stub policy was `PLANNED`; this stub moves it to `STUB`.
decision-required: false
riskTaxonomy: RT-CR
---

# Risk-policies bundle v0 — stub

**Author:** Rohan · **Status:** `STUB` (policy register entry flips from `PLANNED` to `STUB`) · **Date:** 2026-05-07

## Why this stub exists

Same posture as Imani's and Bea's bundles from earlier today. The keystone procedure on Rohan's risk substrate (`Procedures/by-policy/ecl-stage-projection-refresh.md`) cites the **Provisioning / IFRS 9 ECL Policy** under Principle 6, but the policy is `PLANNED` in the register. This bundle authors a stub sufficient to anchor the procedure; the BRC + AC-approved full policy follows at the annual cycle.

The Risk Appetite Statement (Helena-owned, `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) already exists and is in-force. Procedures and the model registry cite it directly — no stub needed for RAS.

---

## Provisioning / IFRS 9 ECL Policy v0.1 (STUB)

**Owner:** Helena (with Bea) · **Approval (target):** BRC + AC · **Cadence:** Annual · **Citation envelope:** IFRS 9; BCBS D350; RAS B7

### §1 Purpose

Govern the bank's recognition and measurement of expected credit losses (ECL) under IFRS 9. The policy is the canonical declaration of the bank's elections within IFRS 9 §5.5 and the supervisory expectations in BCBS D350.

### §2 Three-stage staging discipline

- **Stage 1.** Performing — 12-month ECL recognised on initial recognition.
- **Stage 2.** Significant increase in credit risk (SICR) since initial recognition — lifetime ECL recognised.
- **Stage 3.** Credit-impaired — lifetime ECL recognised; interest revenue calculated on the net (post-ECL) carrying amount.
- **POCI.** Purchased or originated credit-impaired financial assets — lifetime ECL recognised, with credit-adjusted EIR.

### §3 Significant-increase-in-credit-risk (SICR) trigger

- The SICR trigger is the **stage-2 transition criterion** under §5.5.9.
- The trigger uses a combined quantitative-qualitative test: relative-PD-change threshold + watchlist / forbearance / 30-days-past-due flags.
- The trigger thresholds are set by Rohan in `MOD-ECL-001`, calibrated against the RAS Stage-Transition Tolerances band.
- The model is Tier 1; independent validation is a hard precondition for in-use status (RAS B7 / SR 11-7).

### §4 Forward-looking macroeconomic overlays

- Lifetime ECL incorporates forward-looking information per IFRS 9 §5.5.17.
- Macroeconomic-scenario weights are reviewed quarterly; weights and the resulting overlay magnitude are typed events under Rohan's `ScenarioLibraryPublished` and `ModelVersionPublished` streams.

### §5 Disclosure

- ECL roll-forward, stage-distribution, and macroeconomic-sensitivity disclosures run per IFRS 7 (`ORG-AC-04`); the disclosure paragraphs are **generated** from event-log queries (Principle 6 downward).

### §6 Status of this stub

This is a **stub**. The full Provisioning / IFRS 9 ECL Policy is on Helena's drafting queue; BRC + AC approval is the target. Until then, citations of "Provisioning / IFRS 9 ECL Policy v0.1" point to this section as canonical source.

---

## What the stub unblocks

| Artefact | Cites | Was blocked because |
|---|---|---|
| Risk-taxonomy entry `RISK-CR-01` | Provisioning v0.1 §2 | Policy was `PLANNED`; class needed citable policy ancestor |
| Model `MOD-ECL-001` | Provisioning v0.1 §2–§3 | Same |
| Procedure `PROC-RSK-EC-01` (ECL stage refresh) | Provisioning v0.1 §3; RAS Credit-risk band | Procedure must cite a policy under P6 |

## Substrate-gap notes

- **No BRC + AC-approved full policy yet.** Stub is a stub.
- **Owen — please flip the register entry from `PLANNED` to `STUB`** in [`Owner Inbox/2026-05-06_policy-register.md`](2026-05-06_policy-register.md), with a pointer to this bundle as canonical source.
- **No independent validation of `MOD-ECL-001` yet.** The model is `draft` and cannot be in-use until validated. Validation seam is in the registry's `validation` field.
