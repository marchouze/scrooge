---
title: Legal-policies bundle v0 — Contracting Policy and Document Execution Policy stubs
author: Imani
date: 2026-05-07
summary: Two stub policies (Contracting; Document Execution / ECTA) at v0.1. Anchors the first end-to-end Reg→Policy→Procedure→Capability chain for the legal substrate. Both were `PLANNED` in the policy register; this stub moves them to `STUB` so the chain reconciles. Full BRC-approved policies follow at policy-cycle cadence.
decision-required: false
riskTaxonomy: [RT-LR.CT, RT-OP.LE]
---

# Legal-policies bundle v0 — stubs

**Author:** Imani · **Status:** `STUB` (policy register status flips from `PLANNED` to `STUB`) · **Date:** 2026-05-07

## Why this stub exists

The policy register entries — Contracting Policy and Document Execution Policy (ECTA) — have been `PLANNED` since the policy-register pass on 2026-05-06. They blocked the first end-to-end demonstration of the chain `Regulation → Policy → Procedure → System Capability` because procedures cite policies under Principle 6, and a `PLANNED` policy is not citable.

This bundle authors **stubs** — enough policy substance to anchor the procedure and clause-library citations under Principle 2, no more. Full BRC-grade policies follow at policy-cycle cadence (annual per the policy register; first cycle to be sequenced by Owen as governance-cycle work). The stub is honest about its scope: the citation chain reconciles; the BRC has not yet approved the full text.

The stubs are intentionally minimal. Inflating them would:

- duplicate substance the BRC will eventually own (against Owen's canonical-source-registry rule);
- create a parallel "stub policy" that diverges from the eventual BRC-approved policy;
- pretend the policy is more mature than it is, hiding the substrate gap.

So: stub means stub.

---

## Policy 1 — Contracting Policy v0.1 (STUB)

**Owner:** Imani · **Approval (target):** BRC · **Cadence:** Annual · **Citation envelope:** Companies Act 71/2008; ECTA 25/2002

### §1 Purpose

Govern the bank's contracting practice as a structured, citation-bearing legal-as-code substrate (per Principle 6). Every contract the bank enters as a party — master agreement, schedule, confirmation, NDA, onboarding agreement — is composed from clauses in the clause library (`prototype/platform/legal/_clause-library.md`), not authored from a blank page.

### §2 Default governing law

The default governing law for any agreement Bank Newco enters as the South African counterparty is **the law of the Republic of South Africa**, materialised by clause `CL-GVL-001`. Variants for English law and New York law are added to the clause library when first proposed by a counterparty; they are not authored speculatively.

### §3 Clause-library discipline

- Every contract draft references clause IDs from the clause library. Bespoke wording outside a library entry is forbidden.
- Where a counterparty proposes a clause not in the library, Imani opens a `ClauseChangeProposed` event (per Imani spec §7); the proposed clause becomes a new library entry (or a versioned variant of an existing one) before the contract proceeds. Bespoke deals lacking template lineage escalate to Saskia + Owen (Imani §10).

### §4 Legal-entity discipline

- Every contract identifies the contracting entity by its legal-entity ID from the legal-entity tree (`_legal-entity-tree.md`).
- Cross-entity contracts (where they arise post-incorporation of subsidiaries) are explicit `inter-entity` flows with consideration and arm's-length pricing, per Principle 5.

### §5 Citation discipline (Principle 2)

Every clause in every contract carries at least one typed citation (regulation / policy / ISDA-protocol / statute) per the clause-library schema. Untyped prose references in contract drafts are findings, surfaced by Vera's planned clause-library recon.

### §6 Status of this stub

This is a **stub**. The full Contracting Policy is on Imani's drafting queue (annual cycle); BRC approval is the target. Until the full policy is approved, citations of "Contracting Policy v0.1" point to this section as the canonical source — see Owen's canonical-source registry.

---

## Policy 2 — Document Execution Policy (ECTA) v0.1 (STUB)

**Owner:** Imani · **Approval (target):** BRC · **Cadence:** Annual · **Citation envelope:** Electronic Communications and Transactions Act 25/2002

### §1 Purpose

Govern how the bank executes contracts and other legal instruments under the Electronic Communications and Transactions Act 25/2002 (ECTA), per CLAUDE.md Principle 3 (cloud-native; nothing manual or physical except where essential).

### §2 Default execution mode

Default execution mode is **electronic, ECTA-compliant**. Wet-signature is reserved for the narrow set of cases where it is required by law or counterparty constraint:

- ECTA Schedule 1 exclusions (wills; alienation of land; certain bills of exchange; long-term leases where statute requires writing — per `ORG-EL-02` in the obligations register);
- counterparties who cannot electronically sign (technical, contractual, or jurisdictional impossibility).

Each wet-signature exception is a registered, cited exception under Principle 3 — `WetSignatureExceptionRegistered` event (planned, activates at licence-day per Imani §11).

### §3 Recognition of electronic execution

- Every electronically-executed contract carries the recognition statement embodied in the default governing-law clause (`CL-GVL-001`): the agreement is a "data message" within ECTA, not affected solely by reason of its electronic form, save for Schedule 1 matters.
- Cryptographic-signature evidence is captured as a typed correlation field on the `EctaExecutionApproved` event, sourced from the platform HSM (Senna's domain) — see Imani Substrate Gap §2 for the integration gap.

### §4 ECTA Schedule 1 gate

The ECTA-execution engine (`@platform/legal/ecta-execution`, planned) gates every execution attempt against Schedule 1. A Schedule 1 trigger emits `ECTAExceptionFlagged` and routes per Imani spec §10 (Owen + Saskia / onboarding lead post-licence). The engine refuses electronic execution; wet-signature is the only valid path.

### §5 Counterparty electronic-capability statement

Before electronic execution, the bank records the counterparty's electronic-capability statement (intake form, planned, post-licence). Pre-licence, the soft-franchise negotiations-in-principle posture means no live signed agreements; the capability statement substrate is designed but not active.

### §6 Status of this stub

Same posture as Contracting Policy v0.1. Stub anchors the chain; BRC-approved full policy follows.

---

## What the stubs unblock

| Artefact | Cites | Was blocked because |
|---|---|---|
| Clause library `CL-GVL-001` (Governing law — South Africa) | Contracting Policy v0.1 §2; Document Execution Policy v0.1 §3 | Both were `PLANNED`; clause needed a citable policy ancestor under P2 |
| Procedure `counterparty-governing-law-clause-adoption.md` | Contracting Policy v0.1 §2–§3; Document Execution Policy v0.1 §3 | Procedure must cite a policy under P6 |
| Future clause variants (CL-GVL-002 English law; CL-GVL-003 NY law) | Contracting Policy v0.1 §2 | Same |

## Substrate-gap notes

- **No BRC-approved full policies yet.** Stubs are stubs. The full policies are on Imani's drafting queue.
- **No HSM integration yet.** Document Execution Policy §3 references cryptographic-signature evidence sourced from the platform HSM; the integration is Imani Substrate Gap §2 (Senna co-owner).
- **No `ECTAExceptionFlagged` event handler yet.** The escalation channel is designed but the runtime trigger is part of the agent-runtime substrate (Atlas's roadmap A0–A3).
- **Owen — please file Contracting Policy v0.1 and Document Execution Policy v0.1 as `STUB` in the policy register**, with a pointer to this bundle as the canonical source, per the canonical-source-registry convention.
