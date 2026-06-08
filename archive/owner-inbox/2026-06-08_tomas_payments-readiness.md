---
agent: Tomas
trigger: payments-readiness
asOf: 2026-06-08T04:22:00.052Z
decision-required: false
---

# Tomas — daily payments-readiness, 2026-06-08

Autonomous run of Tomas's daily payments-readiness attestation per `Team/Tomas.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Thirteenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Engineer-side counterpart to Devon's `OperationalResilienceSnapshot`.

**Headline:** 8 payments capabilities tracked · readiness 0 ready / 2 drafting / 5 specified / 1 not-yet-specified · 0 payments-domain events (last 7d) · 9 obligation lines on Tomas's mandate surface · indirect-participant posture (no direct SAMOS / CLS membership in build phase).

## Devon's latest snapshot

Latest `OperationalResilienceSnapshot` event: 2026-06-01T05:23:40.479Z
Engineering bench: 6 seats; 0 without runtime handler.

Tomas's daily run pairs with Devon's weekly run: Devon reports the bench coverage; Tomas reports the payments-substrate state. Together they close the resilience-side ↔ rails-side loop on the operations substrate.

## Tomas-owned obligations

| Obligation | Source | Status | Note |
|---|---|---|---|
| `obligation:nps-act:samos-access` | National Payment System Act 78 of 1998 + SARB NPSD directives | planned | Indirect-participant model: access via sponsor / correspondent bank; direct SAMOS membership not pursued in build phase. Sponsor-bank contract is the binding artefact. |
| `obligation:bankserv:scheme-rules` | BankservAfrica scheme rulebooks; PASA settlement standards | planned | Indirect via sponsor; full participant onboarding deferred. Scheme rulebooks ingested for impact-tracking. |
| `obligation:swift:mt-mx` | SWIFT MT/MX rulebooks + CBPR+ migration timeline | drafting | BIC application not yet lodged; CSP attestation cycle starts at first BIC. Synthetic generators in flight. |
| `obligation:swift:csp` | SWIFT CSP 2024 control framework | planned | Annual attestation cycle activates at first BIC; co-owner with Senna (CSP). |
| `obligation:iso-20022:schemas` | ISO 20022 schema repository + scheme-published versions | drafting | Schema-version lock-step to scheme-published cadence. Synthetic generators target current scheme version. |
| `obligation:pasa:settlement` | PASA settlement standards + scheme service-definition documents | planned | Calendar engine ingests PASA windows; finality semantics encoded in cut-off engine. |
| `obligation:strate:settlement` | Strate participant rules; JSE listings rules | planned | Settlement-side connectivity must land by 1 March 2027 cutover under Joint Notice 2 of 2024 (paired to Kai's reportable-trades feed). |
| `obligation:cls:fx-settlement` | CLS Settlement service rules | n/a-yet | Indirect-participant model: access via CLS member bank; direct CLS membership not pursued. Onboarding deferred to first FX position. |
| `obligation:samos:cut-off-windows` | SARB NPSD circulars on SAMOS operating hours | drafting | Cut-off engine encodes 06:00 / 16:00 SAST windows; tolerance ± 15 min per spec § 9. |

_Source: curated from Tomas's mandate surface in `Team/Tomas.md` § 4 (Areas of expertise) cross-referenced to NPS Act 78 of 1998, scheme rulebooks, SWIFT CSP 2024, ISO 20022 schema repository, and PASA settlement standards. Folds into the obligations register once Mira lands the structured payments-domain rows._

## Payments-domain events (last 7 days)

| Event | Count |
|---|---|
| `PaymentInitiated` | 0 |
| `PaymentSettled` | 0 |
| `ReconciliationCompleted` | 0 |
| `CutoffMissed` | 0 |
| `SettlementWindowEntered` | 0 |
| `SWIFTMessageProcessed` | 0 |

_Build-phase posture: zero payments-domain events. The rails are not yet wired — synthetic generators are the load-bearing build work. The bank's indirect-participant model means NPS RTGS / BankservAfrica / CLS access lands via sponsor banks, not direct membership; live event flow activates at licence-day under Saskia's go-live readiness gate._

## Capability readiness

| Capability | Engineer-side state | Substrate required | Next engineering step |
|---|---|---|---|
| `capability:samos-rtl-gateway` (SAMOS-RTL gateway (RTGS message exchange)) | specified | @platform/payments/correspondent-connector — synthetic pacs.009 / pacs.002 round-trip against correspondent-rehearsal endpoint. The correspondent-bank API seam; no direct NPS connection. | Draft synthetic SAMOS gateway with pacs.009 envelope shape; pair to cut-off engine 06:00 / 16:00 SAST windows. |
| `capability:bankserv-eft` (BankservAfrica EFT / RTC / PayShap connector) | specified | @platform/payments/bankserv-connector — scheme-cycle harness for credit / debit / RTC / PayShap message families. Sponsor-bank seam for indirect access. | Specify scheme-cycle table (credit, debit, RTC, PayShap) per current BankservAfrica rulebook; first synthetic cycle drives the calendar engine. |
| `capability:swift-mt-mx` (SWIFT MT / MX connector (gpi, CBPR+)) | drafting | @platform/payments/swift-connector — MT 103 / MT 202 + MX pacs.008 / pacs.009 generators; gpi tracker; CBPR+ migration tracking. | Synthetic generator covers MT/MX pair-up; BIC application is the unblock for live; CSP attestation cycle cadence specified. |
| `capability:iso-20022-pacs-camt` (ISO 20022 message families (pacs / camt)) | drafting | Schema-version-locked envelope library — pacs.008, pacs.009, pacs.002, camt.052, camt.053, camt.054. Lock-step to scheme version cycles. | Pin envelope schemas to current scheme version; reconciler reads camt.053 / camt.054 statements as the recon source-of-truth. |
| `capability:gl-ledger-reconciliation` (GL ↔ ledger reconciliation (trade-leg ↔ payment-leg ↔ ledger-leg)) | specified | @platform/payments/reconciliation — three-way recon harness consuming Kai's trade events, Tomas's payment events, and Bea's posting events. Owner: Tomas + Bea + Anya. | Specify three-way recon contract first; first reconciler runs against synthetic flows alongside the SAMOS gateway draft. |
| `capability:cut-off-engine` (Intra-day cut-off engine (calendars, holidays, scheme cycles)) | specified | @platform/payments/calendar-engine — single-SA-calendar today; P5 multi-jurisdiction extension is design-only. | Draft single-SA calendar with SAMOS / BankservAfrica / SWIFT / Strate cut-offs; multi-jurisdiction defers to second-jurisdiction onboarding. |
| `capability:strate-connector` (Strate CSD settlement connector) | specified | @platform/payments/strate-connector — settlement-side hand-off paired to Kai's reportable-trades feed (Joint Notice 2 of 2024 1 March 2027 cutover). | Specify settlement-side procedure now; participant onboarding pre-licence under Saskia's go-live readiness gate. |
| `capability:cls-connector` (CLS PvP connector (FX settlement)) | not-yet-specified | @platform/payments/cls-connector — indirect-participant via CLS member bank. No spec until first FX position activates. | Defer to first FX position (Saskia / Eitan); spec emerges with CLS member-bank contract. |

## Substrate gaps surfaced this run

- **Synthetic SAMOS gateway** — pacs.009 / pacs.002 round-trip against a SAMOS-rehearsal endpoint is the load-bearing first ticket. Sponsor-bank seam collapses some onboarding cost; the message-shape work is unchanged.
- **Three-way reconciliation harness (Tomas + Bea + Anya)** — trade-leg ↔ payment-leg ↔ ledger-leg recon designed, not deployed. Pre-condition for Bea's first cash-leg posting against synthetic flow.
- **SWIFT BIC application + CSP onboarding** — pre-licence deliverable; co-owned with Senna. CSP attestation cycle cannot start until the BIC lands.
- **Strate participant onboarding** — settlement-side connectivity must be live by 1 March 2027 (Joint Notice 2 of 2024 cutover). Paired to Kai's reportable-trades feed; co-owned with Saskia (markets seam).
- **Cut-off engine — multi-jurisdictional calendar** — single-SA calendar today; P5 multi-jurisdiction extension is design-only. Defers to second-jurisdiction onboarding.
- **Sponsor-bank contract template (indirect-participant model)** — Imani co-ownership; binding artefact for SAMOS / BankservAfrica / CLS access. Substrate gap: contract template not yet drafted.
- **Structured obligations-register rows for payments domain** — Tomas's obligation shadow mirrored in this handler; folds into the obligations register when Mira lands the payments-domain entries.

## Tomas's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cbq9qeSi4QTEigmxHB89m"})._

## Provenance

Devon's latest `OperationalResilienceSnapshot` via `eventStore.replay({type:"OperationalResilienceSnapshot"})` (max as_of); obligation shadow curated from `Team/Tomas.md` cross-referenced to NPS Act 78 of 1998, scheme rulebooks, SWIFT CSP 2024, ISO 20022, and PASA standards; capability-readiness map curated by Tomas; payments-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days (`PaymentInitiated`, `PaymentSettled`, `ReconciliationCompleted`, `CutoffMissed`, `SettlementWindowEntered`, `SWIFTMessageProcessed`).
