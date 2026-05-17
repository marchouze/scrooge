---
status: POPULATED
---
# Procedure — Outbound payment instruction lifecycle (sponsor-bank channel, indirect-participant posture)

**Procedure ID:** PROC-OPS-PS-01
**Owner:** Tomas (operations + payments) · Eitan (treasury, where treasury-originated) · Mira (sanctions screening — non-bypassable gate) · Imani (sponsor-bank operating contract — read-only consumption)
**Approval:** BRC (under Payments Policy v0.1 — STUB; Sponsor-Bank Operating Policy v0.1 — STUB)
**Cadence:** Per-instruction; runs whenever the bank originates an outbound payment
**Version:** v0.1 — 2026-05-07
**Status:** **In force (build-phase scope, synthetic-only)** — runs against synthetic instructions today; lights up on real instructions at licence-day with sponsor onboarding + scheme connectivity

## 1. Source policy

- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Payments Policy v0.1 §3 (Indirect-participant posture); §4 (ISO 20022 discipline); §5 (Reconciliation discipline); §6 (Cut-off discipline); §7 (Sanctions screening).
- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Sponsor-Bank Operating Policy v0.1 §2 (Outbound payment-instruction relay); §4 (Operating-contract discipline); §5 (Limits and cut-offs).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-PR-18` | Operational Resilience — Important Business Services. | Payment rails are an IBS; the procedure operationalises impact-tolerance discipline. |
| `ORG-FC-*` (sanctions screening, exact ID per Mira's register) | Sanctions screening before payment dispatch. | Step 4 (sanctions gate). |
| `ORG-PS-01..` (PROPOSED — Mira to register Domain N) | NPS Act 78/1998 — payment-system participation. | Procedure currently uses `statute` direct reference. |
| `National Payment System Act 78/1998` (direct statute) | Recognition of payment-system participants and sponsor / settlement-bank designation. | Procedure's indirect-participant relay model. |
| `SAMOS Rule Book — current version` (scheme rulebook) | SAMOS participant rules; sponsor-relayed flows. | Step 5 (sponsor envelope). |
| `ISO 20022 — pacs.008.001.10` (standard) | Customer Credit Transfer message schema. | Step 3 (message generation). |

> **Substrate gap:** the obligations register has no Domain N — Payment systems today; citations to NPS Act and SARB NPSD directives are direct-statute / scheme-rulebook references in the bundle. Mira ask is open in the Owner Inbox bundle.

## 3. Purpose

Govern the lifecycle of every outbound payment instruction the bank originates as principal, under the indirect-participant posture. The procedure is the keystone of Tomas's payments substrate: every other Tomas procedure (cut-off rehearsal, reconciliation-break handling, nostro management, scheme-rule cycle) consumes events this procedure emits. When this procedure runs cleanly end-to-end, the rest of the payments substrate has reliable inputs.

In the build phase the procedure runs against synthetic instructions; the message catalogue, sponsor-bank operating-model register, cut-off engine, and reconciliation harness are exercised end-to-end. Live SAMOS / BankservAfrica connectivity and live sponsor relationships activate at licence-day under Saskia's pre-licence go-live readiness gate.

## 4. Trigger

- `SettlementInstructionReceived` event — from Kai (trades), Eitan / Ravi (treasury), or Bea (client transfers, post-licence). SLA: validation + routing within 5 seconds (Tomas spec §7).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Validate the instruction. Required fields: amount, currency, valueDate, originatingEntityId, beneficiary details, scheme hint (or auto-resolve from beneficiary). Reject with `PaymentRejected` if invalid. | system | `@platform/payments/instruction-validator` (PLANNED — today: typed validation in handler) | Idempotency key required on the instruction. |
| 2 | Resolve the scheme + sponsor. From the scheme hint (or beneficiary-derived inference: domestic-RTC / domestic-EFT / domestic-RTGS / cross-border), look up the sponsor-bank relationship in [`_sponsor-bank-operating-model.md`](../../prototype/platform/payments/_sponsor-bank-operating-model.md). Confirm `status: operational` (build-phase: `target-relationship` is acceptable for synthetic dry-runs). | Tomas | `@platform/payments/sponsor-bank-operating-model` | If no sponsor covers the scheme — escalate to Devon + Eitan per Tomas spec §10. |
| 3 | Generate the ISO 20022 message. From the message catalogue ([`_iso-20022-message-catalogue.md`](../../prototype/platform/payments/_iso-20022-message-catalogue.md)) resolve the message family for this scheme + direction (e.g., `MSG-PACS-008-01` for outbound customer credit transfer). Populate envelope; preserve UETR / EndToEndId / TxId. | system | `@platform/payments/iso-20022-message-catalogue`; `@platform/payments/<scheme>-connector` (synthetic-only today) | The catalogue's `boundEvent` says which Tomas event ties to this message. |
| 4 | Sanctions screen. Pass the instruction through Mira's screening pipeline. If `SanctionsHoldRaised` — hold the payment; do not auto-release; wait for Mira / Zara disposition per Tomas spec §10. | system + Mira | `@platform/screening/sanctions.ts` (Mira-owned; Tomas calls as non-bypassable gate) | A held instruction does **not** progress to Step 5; the gate is structural. |
| 5 | Wrap the ISO 20022 message in the sponsor-bank-channel envelope. The sponsor-bank operating-contract (Imani, contractRef from Step 2) defines the envelope shape; today the shape is a synthesised correlation header. | system | `@platform/payments/sponsor-channel-envelope` (PLANNED) | Envelope preserves the bank's correlation IDs through to the sponsor. |
| 6 | Cut-off check. Cut-off engine asserts the instruction lands within the sponsor cut-off (which precedes scheme cut-off). If approaching the bank-internal cut-off, fast-track or escalate. If past internal cut-off, defer to next cycle (or value-date carry per Tomas spec §9). | Tomas | `@platform/payments/calendar-engine` | Build-phase: synthetic cut-offs from the sponsor-bank operating-model register. |
| 7 | Dispatch to sponsor (synthetic-only today). Emit `PaymentInitiated { paymentId, amount, currency, scheme, sponsorRelationshipId, msgId, uetr, endToEndId }`. | system | `@platform/payments/<scheme>-connector` | Build-phase: synthetic sponsor handler echoes a `pacs.002` acknowledgement after a synthetic delay. |
| 8 | Track confirmation. Listen for inbound sponsor response. On positive ACK (`pacs.002` PaymentStatusReport with `ACSC` settled status), emit `PaymentSettled { paymentId, settlementTime, sponsorAck }`. On rejection, retry per Tomas spec §9 or emit `PaymentFailed`. | system | `@platform/payments/<scheme>-connector` | UETR is the primary join key. |
| 9 | Hand off to reconciliation. The `PaymentSettled` event is consumed by the three-way reconciliation harness (trade-leg ↔ payment-leg ↔ ledger-leg). | system | `@platform/payments/reconciliation` (Tomas Substrate Gap §6) | Bea's posting rule fires on `PaymentSettled` to post the cash leg per `PR-CASHIN-001` (and sibling rules). |
| 10 | Audit hand-off. The full event chain (`SettlementInstructionReceived` → `PaymentInitiated` → `PaymentSettled`) is consumed by Vera's planned payments recon (Wave-4 candidate). | system | `@platform/event-store` (event subscription) | Structural; not a step Tomas takes. |

## 6. Reconciliation

- **Events produced:** `PaymentInitiated`, `PaymentSettled` (or `PaymentFailed` / `PaymentRetried`), optionally `SanctionsHoldRaised` (Mira) and `ReconciliationBreak` (downstream).
- **Reconciliation check:** every `PaymentSettled` (a) traces back through the same UETR to a `PaymentInitiated` and a `SettlementInstructionReceived`; (b) carries a sponsor-relayed envelope identifier resolving to an operational sponsor-relationship in the operating-model register; (c) reconciles to a posted ledger entry via Bea's posting rule (cross-domain).
- **Cross-domain check:** every `PaymentSettled` produces a downstream `JournalEntryPosted` from Bea via `PR-CASHIN-001` (or sibling rule) within the daily close cycle. Orphan settlements are findings.
- **Failure modes:** rejected at Step 1 (validation), 2 (no sponsor), 4 (sanctions hold), or 6 (cut-off breach). Each failure mode has a typed event and an explicit downstream consequence.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `PaymentInitiated`, `PaymentSettled` events | Event log | Indefinite (P1) | Counterparty-confidential |
| ISO 20022 message envelope | Captured as typed correlation field on the bound event | Indefinite | Counterparty-confidential |
| Sponsor-bank channel envelope | Same | Indefinite | Counterparty-confidential + sponsor-confidential |
| Sanctions-screening evidence | Mira's pipeline (sealed) | Per FIC retention | Sealed |

## 8. Manual steps

- **Steps 1–10 collectively** run against synthetic flows today. Live connectivity activates at licence-day with sponsor onboarding + scheme connectivity.
- **Sponsor-bank channel envelope** (Step 5) is a synthesised correlation header until the sponsor-bank operating contract executes (post-licence) and Imani's clause-library sponsor-bank correspondent-banking clauses land.
- **Cut-off engine** (Step 6) runs against synthetic cut-offs from the operating-model register; live cut-offs come from the sponsor's published timetable.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Validation fails | Step 1 | Tomas — fix in originating handler; do not retry the bad instruction |
| No sponsor covers the scheme | Step 2 | Devon + Eitan per Tomas spec §10 — sponsor-relationship gap |
| Sanctions hold raised | Step 4 | Mira + Zara per Tomas spec §10 — sealed escalation; same business day |
| Approaching cut-off | Step 6 | Tomas — fast-track; if past internal cut-off, defer to next cycle |
| Cut-off breach (post-dispatch) | Sponsor / scheme response | Devon + Saskia + Eitan + Camille per Tomas spec §10; PA-notification path lit if statutory |
| Sponsor connectivity outage | `SchemeConnectivityChanged` | Atlas + Tomas; failover path per operational-resilience scenario testing |
| Cross-border ExCon question outside Authorised-Dealer envelope | Step 1 / Step 2 | Mira + Imani + Eitan per Tomas spec §10 — pre-release |

## 10. Related procedures

- `Procedures/by-policy/samos-cut-off.md` — **planned (Tomas-owned)** — the cut-off rehearsal procedure that exercises Step 6 daily.
- `Procedures/by-policy/reconciliation-break-handling.md` — **planned (Tomas-owned)** — handles `ReconciliationBreak` events Step 9 may produce.
- `Procedures/by-policy/sanctions-screening.md` — **populated (Mira-owned)** — the screening pipeline Step 4 calls.
- `Procedures/by-policy/posting-rule-publication.md` — **populated (Bea-owned)** — produces the posting rules that consume `PaymentSettled` events.
- `Procedures/by-policy/excon-otc-derivatives.md` — **populated (Mira + Imani + Tomas co-owned)** — handles cross-border ExCon flows that touch this procedure.
- `Procedures/by-policy/nostro-management.md` — **planned (Tomas + Eitan co-owned)** — runs alongside this procedure for treasury-originated flows.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Tomas (via Scrooge) | Initial draft as keystone of Tomas's first end-to-end Reg→Policy→Procedure→Capability chain demonstration. Indirect-participant posture is structural; sponsor-bank operating model is consumed read-only. |

## 12. Audit / assurance

Vera's planned payments recon (Wave-4 candidate) will assert: (a) every `SettlementInstructionReceived` results in either a `PaymentSettled`, a `PaymentFailed`, or a sealed `SanctionsHoldRaised`; (b) every `PaymentSettled` resolves to an operational sponsor-relationship and to a Bea posting; (c) cut-off breaches are flagged; (d) UETR uniqueness is preserved across the lifecycle; (e) ISO 20022 catalogue entries exist for every message family in flight.
