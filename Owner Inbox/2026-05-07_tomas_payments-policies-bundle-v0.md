---
title: Payments-policies bundle v0 — Payments Policy and Sponsor-Bank Operating Policy stubs
author: Tomas
date: 2026-05-07
summary: Two stub policies (Payments Policy; Sponsor-Bank Operating Policy) at v0.1 anchoring the keystone Reg→Policy→Procedure→Capability chain on Tomas's payments substrate. Neither policy was in the policy register — both are added (as STUB) with the indirect-participant posture as a first-class concern. One substrate-gap ask of Mira: register a Domain N — Payment systems section in the obligations register so NPS Act / SARB NPSD obligations have ORG-PS-* IDs.
decision-required: false
---

# Payments-policies bundle v0 — stubs

**Author:** Tomas (with Devon as governance owner; Imani for contracting seam) · **Status:** `STUB` (both new policies added to the register at `STUB`) · **Date:** 2026-05-07

## Why this stub exists

Same posture as the Imani / Bea / Rohan / Niko bundles. The keystone procedure on Tomas's payments substrate (`Procedures/by-policy/outbound-payment-sponsor-bank-channel.md`) cites a payments policy under Principle 6, but no payments policy exists in the register. This bundle authors two stub policies sufficient to anchor the procedure; the BRC-approved full policies follow at the annual cycle.

A second gap is that **no payment-system obligations-register entries exist**. The procedure cites the National Payment System Act 78/1998 directly via `statute` references and SAMOS / BankservAfrica scheme rulebooks via `scheme-rulebook` references — both are typed citation kinds the Tomas substrate uses. The cleaner solution is for Mira to register a Domain N — Payment systems with `ORG-PS-*` IDs covering NPS Act, SARB NPSD directives, and the relevant scheme designations under the Act. This bundle includes that ask explicitly.

---

## Policy 1 — Payments Policy v0.1 (STUB)

**Owner:** Devon (with Tomas + Eitan + Imani) · **Approval (target):** BRC · **Cadence:** Annual · **Citation envelope:** National Payment System Act 78/1998; SARB NPSD directives; scheme rulebooks (SAMOS, BankservAfrica, SWIFT, Strate, CLS); ISO 20022

### §1 Purpose

Govern the bank's participation in payment systems — domestic and cross-border — and the operating discipline around message generation, reconciliation, cut-offs, exception handling, and operational resilience.

### §2 Scope

- All outbound payment instructions the bank originates as principal.
- All inbound payments the bank receives.
- All settlement legs of trades booked by Kai (post-licence) — equities (via Strate), bonds (via Strate), OTC IRD margin / collateral flows.
- All treasury operations Eitan / Ravi initiate.

### §3 Indirect-participant posture

The bank operates as an **indirect participant** in critical market infrastructures (SAMOS, CLS) and in domestic clearing schemes (BankservAfrica). It accesses these schemes via sponsor / correspondent banks, captured in the typed sponsor-bank operating model ([`prototype/platform/payments/_sponsor-bank-operating-model.md`](../prototype/platform/payments/_sponsor-bank-operating-model.md)).

The posture has structural implications:

- Outbound payment instructions are wrapped in a sponsor-bank-channel envelope before reaching the scheme. The bank does not generate scheme-direct messages.
- Cut-off windows are three-layered: bank-internal → sponsor → scheme. Internal cut-offs precede sponsor cut-offs precede scheme cut-offs, with margin per Tomas spec §6.
- Settlement finality reconciliation walks the sponsor-relayed envelope back to the bank's instruction; orphan envelopes (sponsor-relayed without a matching bank instruction) are findings.
- Capital and liquidity treatment of indirect participation flows through Helena's RAS and Eitan's funding model.

### §4 ISO 20022 discipline

- Every message family is registered in the catalogue ([`prototype/platform/payments/_iso-20022-message-catalogue.md`](../prototype/platform/payments/_iso-20022-message-catalogue.md)).
- Every outbound message preserves UETR / EndToEndId / TxId as typed correlation fields on the bound event.
- Schema upgrades follow Anya's data-contract-evolution discipline (Tomas spec §14).

### §5 Reconciliation discipline

- Reconciliation runs **intraday**, not at month-end (Tomas spec §5).
- Three-way recon: trade-leg ↔ payment-leg ↔ ledger-leg (Tomas Substrate Gap §6, M1 target).
- Reconciliation breaks raise `ReconciliationBreak` events; auto-match within tolerance, case-open above.
- Bea's posting-rule register and Tomas's payment events reconcile bidirectionally.

### §6 Cut-off discipline

- Cut-offs are deadlines, not aspirations (Tomas spec §5).
- Cut-off engine owns the bank's cut-off calendar; multi-jurisdictional extension is in scope at second-jurisdiction onboarding (Principle 5).
- Cut-off breaches escalate per Tomas spec §10.

### §7 Sanctions-aware payment screening

- Every payment passes through Mira's sanctions screening as a non-bypassable gate.
- `SanctionsHoldRaised` events are sealed escalations to Mira / Zara; only the MLRO can release a sanctions-tagged hold.

### §8 Operational resilience

- Important Business Services (per BCBS Operational Resilience / `ORG-PR-18`) include the payment rails. Impact tolerances and scenario testing are owned by Devon's Operational Resilience Policy; this Payments Policy operationalises through cut-off rehearsals (daily) and connectivity-health checks (weekly Monday).

### §9 Status of this stub

This is a **stub**. The full Payments Policy is on Devon's drafting queue; BRC approval is the target.

---

## Policy 2 — Sponsor-Bank Operating Policy v0.1 (STUB)

**Owner:** Devon (with Tomas + Imani + Saskia) · **Approval (target):** BRC · **Cadence:** Annual · **Citation envelope:** National Payment System Act 78/1998; scheme rulebooks; ISDA / GMRA correspondent-banking clauses (planned in Imani's clause library)

### §1 Purpose

Govern the bank's relationships with sponsor / correspondent banks for indirect-participant access to payment systems.

### §2 Outbound payment-instruction relay

- Every outbound payment instruction is relayed via the sponsor in a typed envelope.
- The bank's instruction is the originating event; the sponsor's relayed message is a downstream event in the same correlation chain.
- Settlement finality is recognised at the scheme's settlement event; the bank's accounting recognition (Bea) follows the sponsor's confirmation, not the bank's own dispatch.

### §3 Sponsor due-diligence and selection

- Sponsor selection is a CEO decision card. Inputs: scheme coverage; counterparty-credit standing (Helena); operating-cost; CSP attestation (Senna); contract terms (Imani); reputational alignment.
- Annual due-diligence cycle reviews each operational sponsor against the same inputs; status-flip from `operational` to `wound-down` is a structured event.

### §4 Operating-contract discipline

- Every operational sponsor-bank relationship is backed by an executed operating contract owned by Imani.
- The contract draws on a forthcoming clause family in Imani's clause library — sponsor-bank correspondent-banking clauses (governing law, settlement finality, default-and-termination, intraday-credit, indemnities). That clause family is the next slice on Imani's clause-library after the governing-law family.
- The contract is identified by `contractRef` in the sponsor-bank operating-model register.

### §5 Limits and cut-offs

- Daily and intraday limits negotiated with each sponsor are captured in the operating-model register.
- Cut-off windows are three-layered (internal → sponsor → scheme) per Payments Policy §3.

### §6 Status of this stub

Same posture as the Payments Policy stub above.

---

## What the stubs unblock

| Artefact | Cites | Was blocked because |
|---|---|---|
| ISO 20022 catalogue entry `MSG-PACS-008-01` | Payments Policy v0.1 §3–§4; Sponsor-Bank Operating v0.1 §2 | No payments policy existed; substrate needed citable policy ancestors |
| Sponsor-bank operating-model `SPB-ZA-001` | Sponsor-Bank Operating v0.1 §2–§5; Payments Policy v0.1 §3 | Same |
| Procedure `PROC-OPS-PS-01` (sponsor-bank channel) | Payments Policy v0.1 §3, §5; Sponsor-Bank Operating v0.1 §2 | Procedure must cite a policy under P6 |

## Substrate-gap notes

- **No BRC-approved full policies yet.** Stubs are stubs. Both go on Devon's drafting queue.
- **Owen — please add both new policies to the register at `STUB`** in [`Owner Inbox/2026-05-06_policy-register.md`](2026-05-06_policy-register.md). Suggested home: a new section "Payments and operations policies" between Operations & technology (existing) and the Markets bundle, owned by Devon.
- **Mira — please register a Domain N — Payment systems** in [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md), with ORG-PS-* entries for NPS Act 78/1998 (recognition), SARB NPSD directives, and the relevant designations under the Act. Tomas's keystone procedure currently uses direct `statute` and `scheme-rulebook` citations; once the register entries land, those citations get firmed up to `regulation` IDs.
- **No live sponsor relationship yet.** `SPB-ZA-001` is a placeholder. Sponsor selection is a CEO decision card to be opened by Saskia + Eitan with input from Devon and Imani.
- **No live SAMOS / BankservAfrica / SWIFT connectivity yet.** All scheme contexts in the catalogue are `synthetic-only`; live connectivity activates at licence-day with sponsor onboarding.
