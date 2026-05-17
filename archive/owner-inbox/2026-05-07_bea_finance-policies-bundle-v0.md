---
title: Finance-policies bundle v0 — Accounting Policies (IFRS) and Financial Reporting & Disclosure stubs
author: Bea
date: 2026-05-07
summary: Two stub policies (Accounting Policies (IFRS); Financial Reporting & Disclosure) at v0.1. Anchors the keystone Reg→Policy→Procedure→Capability chain for Bea's accounting substrate. Both were `PLANNED` in the policy register; this stub moves them to `STUB` so the chain reconciles. Full AC-approved policies follow at policy-cycle cadence.
decision-required: false
riskTaxonomy:
  - RT-LR.RC
  - RT-ST.EV
  - RT-OP.MD
---

# Finance-policies bundle v0 — stubs

**Author:** Bea · **Status:** `STUB` (policy register status flips from `PLANNED` to `STUB`) · **Date:** 2026-05-07

## Why this stub exists

Same posture as Imani's legal-policies bundle v0 from earlier today: two policies (`Accounting Policies (IFRS)` and `Financial Reporting & Disclosure Policy`) are `PLANNED` in the register and were blocking the first end-to-end Reg→Policy→Procedure→Capability chain on Bea's substrate. This bundle authors stubs sufficient to anchor the citations; full AC-approved policies follow at the annual policy cycle.

The stubs are intentionally minimal. They do not duplicate the obligations register's IFRS / IAS citations, nor do they pre-empt Camille's full Accounting Policies paper. They establish the discipline lines the keystone procedure relies on.

---

## Policy 1 — Accounting Policies (IFRS) v0.1 (STUB)

**Owner:** Camille (with Bea) · **Approval (target):** AC + Board · **Cadence:** Annual · **Citation envelope:** IFRS 9 / 7 / 13 / 15 / 16; IAS 1 / 12 / 21

### §1 Purpose

Set the IFRS-aligned accounting basis for every event the bank recognises. Per Principle 6, every posting rule and chart-of-accounts entry cites an IFRS / IAS reference and a regulation ID; this policy is the canonical declaration of the bank's elections and interpretations within IFRS.

### §2 Cash and equivalents

Cash and balances at SARB are classified as **financial assets at amortised cost** under IFRS 9 §4.1.2 — held to collect contractual cash flows; cash flows are SPPI. Operational cash is presented per IAS 1 §54(i).

### §3 Recognition and double-entry discipline

- Recognition follows IFRS 9 §3.1.1 (financial assets) and §3.1.2 (financial liabilities) — recognise when the bank becomes party to the contractual provisions of the instrument.
- Every recognition event flows through the posting-rule register (`prototype/platform/accounting/_posting-rules.md`). Manual journals outside the register are tracked exceptions under Principle 3 with explicit Camille approval.
- Postings are double-entry, balanced per currency per entity (Principle 5).

### §4 Multi-currency and entity discipline

- Functional currency is set per legal entity in the legal-entity tree (Imani-owned). Every account declares its `currencies` array; FX translation runs per IAS 21 as a query, not as authored postings.
- Inter-entity flows (when subsidiaries are added) are explicit events with arm's-length pricing, per Principle 5.

### §5 IFRS 9 ECL

Provisioning runs the three-stage ECL model per IFRS 9 §5.5 (`ORG-AC-02`). The methodology is co-owned with Rohan; Bea's accounting application is downstream of Rohan's `ModelVersionPublished` event and Bea's `IFRSClassificationAssigned` event.

### §6 Hedge accounting

Hedge accounting follows IFRS 9 (CEO election F1, 2026-05-06; `ORG-AC-03`); IAS 39 carryover is not used. Hedge designations are typed events; Eitan + Camille co-own the policy paper.

### §7 Status of this stub

This is a **stub**. The full Accounting Policies paper is on Camille's drafting queue (annual cycle); AC + Board approval is the target. Until then, citations of "Accounting Policies (IFRS) v0.1" point to this section as canonical source.

---

## Policy 2 — Financial Reporting & Disclosure Policy v0.1 (STUB)

**Owner:** Camille (with Bea) · **Approval (target):** AC + Board · **Cadence:** Annual · **Citation envelope:** Banks Act + Regs Relating to Banks; IFRS; JSE Listings Requirements (forward-compatible)

### §1 Purpose

Govern the bank's external financial reporting — BA returns to PA, statutory annual financial statements, audited disclosures, and forward-compatible XBRL packs.

### §2 BA returns

Every BA-return cell is a **query** over event flows + chart-of-accounts entries + posting rules, never an authored figure (Principle 1). The `baReturnLines` array on each chart-of-accounts entry is the single source of truth for cell mapping; the BA-return generator (Bea-owned, planned) consumes that array. Under no circumstance is a BA-return cell hand-typed.

Bea drafts; Camille signs the `BAReturnSubmitted` event.

### §3 Statutory annual financial statements

Statutory AFS are queries over the close-cycle outputs at year-end, not assemblies. Auditor working papers are side-effects of normal operation (Bea spec §5).

### §4 Disclosure citation discipline (Principle 2)

Every disclosure paragraph cites the IFRS / regulatory provision it discharges. Disclosures without citations are findings.

### §5 Status of this stub

Same posture as the Accounting Policies stub above.

---

## What the stubs unblock

| Artefact | Cites | Was blocked because |
|---|---|---|
| Chart-of-accounts entry `ACC-1100-001` | Accounting Policies v0.1 §2 | Policy was `PLANNED`; account needed citable policy ancestor |
| Posting-rule `PR-CASHIN-001` | Accounting Policies v0.1 §3 | Same |
| Procedure `PROC-FIN-AC-01` (posting-rule publication) | Accounting Policies v0.1 §3; Financial Reporting & Disclosure v0.1 §2 | Procedure must cite a policy under P6 |
| Future BA-return cell mappings | Financial Reporting & Disclosure v0.1 §2 | Same |

## Substrate-gap notes

- **No AC-approved full policies yet.** Stubs are stubs.
- **Owen — please flip the two register entries from `PLANNED` to `STUB`** in [`Owner Inbox/2026-05-06_policy-register.md`](2026-05-06_policy-register.md), with a pointer to this bundle as canonical source per the canonical-source-registry convention.
- **No close engine yet.** Posting rules can be published into the register but cannot yet auto-fire on event landing — this depends on Bea Substrate Gap §3 (close engine, target M2).
