---
policy-parent: OTC Trading Policy (planned, markets bundle)
last-reviewed: 2026-05-16
procedureId: PROC-MK-ODP-06
title: OTC derivative confirmation (post-execution)
author: Kai (trading systems engineer) · Tomas (operations engineer) · Imani (legal-as-code engineer)
date: 2026-05-16
owner: Kai (trading systems engineer) · Tomas (operations engineer) · Imani (legal-as-code engineer)
status: POPULATED
policy-cited: OTC Trading Policy (planned, markets bundle)
system-capability: "@trading/confirmation-gen · @trading/confirmation-dispatch · @trading/confirmation-tracking (DRAFTING)"
---

# Procedure — OTC derivative confirmation (post-execution)

**Procedure ID:** PROC-MK-ODP-06
**Owner:** Kai (trading systems engineer) · Tomas (operations engineer) · Imani (legal-as-code engineer)
**Approval:** BRC (under OTC Trading Policy)
**Cadence:** Per-trade; SLA tracked continuously; daily reconciliation at EOD
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

OTC Trading Policy (planned, markets bundle). The policy sets the SLA windows and escalation thresholds that this procedure operationalises. The obligation chain:

```
Regulation (CS 3/2018 §4 — SARB Conduct Standard)
  → OTC Trading Policy (planned)
    → PROC-MK-ODP-06 (this procedure)
      → @trading/confirmation-gen · @trading/confirmation-dispatch · @trading/confirmation-tracking (DRAFTING)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-002` (CS 3/2018 §4) | All material terms of every OTC derivative trade must be confirmed promptly with the counterparty; SLA windows are set by the standard and the OTC Trading Policy. |
| `ORG-JS2-003` (JS 2/2020 §5) | Confirmation and portfolio-reconciliation controls are interdependent; confirmation completeness is a prerequisite for portfolio reconciliation. |
| `ORG-CD-03` (FAIS Act — General Code of Conduct §4) | Records of advice and transaction confirmations must be maintained for each regulated transaction; ECTA s.11 gives legal effect to electronic confirmations. |
| ECTA s.11 | Electronic records and signatures are legally valid; confirmation dispatch must comply with ECTA Schedule 1 for documents that are not excluded from electronic form. |
| `ORG-GV-15` (ISDA 2002 Master Agreement — confirmation protocol) | Where the ISDA MA is in force, confirmations supplement and form part of the MA; unsigned confirmations without counterparty objection may be binding per the ISDA confirmation-by-silence protocol. |

## 3. Purpose

1. Generate an ISDA-aligned confirmation of all material terms (notional, tenor, rate, day-count, payment dates, counterparty identifiers, governing law) for every OTC IRD trade executed by the bank.
2. Dispatch each confirmation to the counterparty via an ECTA-compliant electronic channel within the SLA window (T+1 for vanilla IRS / OIS / FRA; T+5 for exotic / structured).
3. Track counterparty acknowledgement and escalate promptly where the SLA is at risk.
4. Maintain an immutable record of every confirmation and acknowledgement in the event store for reconciliation, regulatory inspection, and dispute resolution.
5. Feed the confirmed-terms record into the OMS master trade record so that post-trade lifecycle events (fixing, settlement, margin) operate on legally confirmed terms.

## 4. Trigger

- **Primary:** `OtcTradeExecuted { tradeId, product, notional, currency, tenor, rateTerms, counterpartyId, executionTime }` — emitted by the OMS at trade execution.
- **SLA escalation check:** `ConfirmationSlaCheckDue { tradeId, slaDeadline }` — emitted by a scheduler at T+1 (vanilla) or T+5 (exotic) after execution, if `ConfirmationAcknowledged` is not yet in committed state.
- **Daily reconciliation:** `EndOfDayReconciliationStarted { date }` — emitted by the EOD scheduler; triggers the daily executed-vs-confirmed-vs-acknowledged sweep.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On `OtcTradeExecuted`: classify product as vanilla (IRS / OIS / FRA) or exotic / structured; set SLA deadline (`slaDeadline = executionDate + T+1` or `T+5`); emit `ConfirmationScheduled { tradeId, product, slaDeadline }` | `system` | `@trading/confirmation-gen` (DRAFTING) | Classification uses the product taxonomy from `prototype/platform/markets/products/`; unclassified products default to T+5. |
| 2 | Generate confirmation document containing all material ISDA terms: trade date, effective date, termination date, notional, currency, fixed rate / floating index, day-count convention, payment dates, counterparty legal name, LEI, account details, governing law, ISDA Master Agreement reference | `agent` (Kai) | `@trading/confirmation-gen` (DRAFTING) | Document format: ISO 20022 FpML confirmation message, or counterparty-agreed format (FIA / SWIFT / email template per the counterparty's documented preference in the Party register). |
| 3 | Imani (legal-as-code engineer) validates the generated confirmation: confirms all material terms captured; ECTA electronic-signature mode appropriate for the counterparty relationship; ISDA Master Agreement / Schedule reference valid | `agent` (Imani) | `@platform/legal/confirmation-validator` (PLANNED) | For vanilla products, validation is automated against the ISDA term-set and the CSA in force. For exotic / structured, Imani applies rule-based review with human-escalation flag if a bespoke term is present. |
| 4 | Emit `ConfirmationGenerated { tradeId, confirmationRef, generatedAt, slaDeadline, format, materialTermsHash }` | `system` | `@platform/event-store` | `materialTermsHash` is a BLAKE3 hash of the confirmation document; used for tamper-detection in reconciliation. |
| 5 | Tomas (operations engineer) dispatches the confirmation to the counterparty via the counterparty's documented preferred channel (SWIFT MT messaging, FpML over DTCC Deriv/SERV, or secure email with ECTA-compliant e-signature) | `agent` (Tomas) | `@trading/confirmation-dispatch` (DRAFTING) | Dispatch method is read from the Party register (`counterpartyConfirmationChannel` field). ECTA s.11 compliance is validated by Imani's substrate at step 3. |
| 6 | Emit `ConfirmationDispatched { tradeId, confirmationRef, dispatchedAt, channel, counterpartyId }` | `system` | `@platform/event-store` | Dispatch timestamp is the start of the SLA countdown to acknowledgement. |
| 7 | Track counterparty acknowledgement: await `ConfirmationAcknowledged { tradeId, confirmationRef, ackTime, counterpartySignatory }` — received via the same channel or counterparty's affirmation platform | `agent` (Tomas) | `@trading/confirmation-tracking` (DRAFTING) | Acknowledgement may be: explicit (counterparty countersigns); implicit (ISDA confirmation-by-silence protocol after objection period lapses); or disputed (escalate per PROC-MK-ODP-07). |
| 8 | **SLA check.** On `ConfirmationSlaCheckDue { tradeId }`: if `ConfirmationAcknowledged` is absent → emit `ConfirmationSlaBreached { tradeId, confirmationRef, slaDeadline, currentTime, overdueDuration }` and route to Tomas (operations engineer) for immediate follow-up with counterparty | `system` | `@platform/escalation` (existing) | Tomas attempts direct contact within 4 business hours of the SLA check. |
| 9 | **Escalation if no resolution.** If the counterparty does not acknowledge within 1 business day of step 8 escalation → route to Saskia (Head of Global Markets, governance) for senior counterparty engagement | `agent` (Tomas → Saskia) | `@platform/escalation` (existing) | Saskia escalates to Helena (Chief Risk Officer, governance) if unresolved after a further 2 business days; Helena may trigger PROC-MK-ODP-07. |
| 10 | On receipt of `ConfirmationAcknowledged`: update the OMS master trade record with `confirmedTerms: true, ackTime: …`; post-trade lifecycle (fixing, settlement, margin) is gated on this flag | `system` | `@trading/oms` (PLANNED) + `@platform/event-store` | Post-trade lifecycle gate prevents downstream events from operating on unconfirmed terms. |
| 11 | **Daily EOD reconciliation.** On `EndOfDayReconciliationStarted`: sweep all `OtcTradeExecuted` events for the day; assert every trade has a `ConfirmationDispatched` event; flag trades missing dispatch or acknowledgement; emit `DailyConfirmationReconciliationSummary { date, tradesExecuted, confirmationsDispatched, confirmationsAcknowledged, slaBreach, openItems }` | `system` | `@trading/confirmation-tracking` (DRAFTING) + `@platform/recon` | Vera (internal-audit / continuous-assurance engineer) asserts this daily invariant. |

## 6. Reconciliation

- **Events produced:**
  - `ConfirmationScheduled { tradeId, product, slaDeadline }`
  - `ConfirmationGenerated { tradeId, confirmationRef, generatedAt, materialTermsHash }`
  - `ConfirmationDispatched { tradeId, confirmationRef, dispatchedAt, channel, counterpartyId }`
  - `ConfirmationAcknowledged { tradeId, confirmationRef, ackTime, counterpartySignatory }`
  - `ConfirmationSlaBreached { tradeId, slaDeadline, overdueDuration }` — on SLA miss
  - `DailyConfirmationReconciliationSummary { date, tradesExecuted, confirmationsDispatched, confirmationsAcknowledged, slaBreach, openItems }`
- **Reconciliation checks (Vera asserts):**
  - Every `OtcTradeExecuted` has a downstream `ConfirmationDispatched` within SLA; any gap is a Vera finding.
  - `materialTermsHash` in `ConfirmationGenerated` must match the hash of the document held in the document store — tamper-detection invariant.
  - Every `ConfirmationSlaBreached` has a downstream escalation event (`EscalationRouted`) within 4 business hours.
  - `DailyConfirmationReconciliationSummary.tradesExecuted` must equal the count of `OtcTradeExecuted` events for the day.
- **Failure mode:** confirmation-gen engine unavailable → Kai produces the confirmation manually using the ISDA confirmation template; Tomas dispatches via secure email; both steps are flagged with `ManualConfirmationFlag { tradeId, reason }` and Imani validates the manual output before dispatch.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Confirmation documents (generated, dispatched, acknowledged) | Document store (BLAKE3-addressed, referenced by event) | 7 years (FAIS records / ECTA s.17) | Confidential — counterparty commercial data |
| `Confirmation*` event chain | Event log (`@platform/event-store`) | Permanent (Principle 1) | Restricted |
| `DailyConfirmationReconciliationSummary` | Event log + confirmation register projection | 7 years | Internal |
| Counterparty channel preference records (Party register) | `prototype/platform/party/` | Current + 7 years post-relationship | Restricted |
| SLA breach log and escalation records | Event log + escalation register | 7 years | Internal |

## 8. Manual steps

The following steps cannot yet be fully automated; each is a named substrate gap:

1. **Exotic / structured confirmation generation (step 2 + 3):** Bespoke terms in exotic / structured trades require Imani (legal-as-code engineer) to author the confirmation template; no automated template engine for non-vanilla products yet. Substrate gap: `@trading/confirmation-gen` exotic-product template library — owner: Kai + Imani, v1 follow-on.
2. **Channel dispatch for non-standard counterparties (step 5):** Counterparties not connected to DTCC Deriv/SERV or SWIFT require secure email dispatch; Tomas manages these manually until a general dispatch adapter is built. Substrate gap: `@trading/confirmation-dispatch` multi-channel adapter — owner: Tomas + Kai.
3. **ECTA-compliant e-signature set-up (step 5):** The e-signing pipeline (Imani's substrate) is PLANNED; until live, ECTA-compliant dispatch uses counterparty-specific signed-PDF channels. Each arrangement is documented in the Party register.
4. **Counterparty acknowledgement receipt (step 7):** Acknowledgements via non-automated channels (fax, email, voice) are manually entered by Tomas into the confirmation-tracking module. Substrate gap: multi-channel acknowledgement parser — owner: Tomas + Kai.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Confirmation not generated within 2 hours of `OtcTradeExecuted` | `ConfirmationScheduled` present but no `ConfirmationGenerated` within 2h | Kai; auto-alert; re-generate or flag manual step |
| Confirmation dispatched but no acknowledgement by SLA | `ConfirmationSlaCheckDue` fires; no `ConfirmationAcknowledged` in store | Tomas (same day) → Saskia (next day) → Helena (day 3) → PROC-MK-ODP-07 |
| Counterparty disputes terms in confirmation | Counterparty raises objection on receipt | Imani + Tomas; escalate to PROC-MK-ODP-07 immediately |
| Material terms hash mismatch (tamper-detection) | Vera recon asserts `materialTermsHash` vs document store | Imani + Kai; halt post-trade lifecycle on affected trade; investigate |
| Confirmation engine (DRAFTING) unavailable | System health check | Kai; manual confirmation process per §8 step 1; Helena informed if >3 trades affected simultaneously |
| SLA systemic breach (>10% of daily trades breaching T+1) | `DailyConfirmationReconciliationSummary.slaBreach > 0.10 × tradesExecuted` | Saskia + Helena; BRC notification; root-cause investigation within 2 business days |

## 10. Related procedures

- [`otc-dispute-resolution.md`](otc-dispute-resolution.md) (PROC-MK-ODP-07) — escalation path when a counterparty disputes confirmed terms or acknowledgement is withheld.
- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) (PROC-MK-ODP-02) — the Party register counterparty-channel preference (step 5) is populated during onboarding.
- [`margin-im.md`](margin-im.md) (PROC-MK-ODP-05) — IM margin calls are gated on `confirmedTerms: true`; this procedure is a prerequisite.
- [`client-categorisation.md`](client-categorisation.md) (PROC-MK-ODP-08) — counterparty categorisation determines the conduct protections applicable in the confirmation (e.g., risk-disclosure wording).
- [`fais-advice-record-capture.md`](fais-advice-record-capture.md) (PROC-CRM-FA-01) — FAIS advice records for any OTC trades that constitute regulated advice.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Kai (trading systems engineer) · Tomas (operations engineer) · Imani (legal-as-code engineer) | Initial STUB |
| v0.2 | 2026-05-16 | Kai (trading systems engineer) · Tomas (operations engineer) · Imani (legal-as-code engineer) | STUB → POPULATED: full 12-section procedure; ISO 20022 / FpML confirmation generation; ECTA dispatch; SLA tracking and escalation chain; daily EOD reconciliation; tamper-detection via BLAKE3 hash; manual step substrate gaps named. |

## 12. Audit / assurance

- **Vera daily:** `DailyConfirmationReconciliationSummary` completeness check — every business day has a record; every `OtcTradeExecuted` has a downstream `ConfirmationDispatched` within SLA; `materialTermsHash` tamper-detection sweep.
- **Vera monthly:** SLA breach trend analysis; escalation-chain disposition — every `ConfirmationSlaBreached` traced to resolution or open PROC-MK-ODP-07 dispute; report to Saskia (Head of Global Markets, governance) and Helena (Chief Risk Officer, governance).
- **Thandiwe (CAE, governance):** annual audit of the confirmation framework; sample testing of confirmation document integrity (BLAKE3 hash); ECTA compliance spot-check; CS 3/2018 §4 alignment; opinion reported to Audit Committee.
- **PA / FSCA supervisory:** confirmation completeness and SLA adherence may be reviewed in the SARB conduct examination; CS 3/2018 §4 findings are reportable; Helena manages supervisory engagement.
