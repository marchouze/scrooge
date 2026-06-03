---
agent: Iris
trigger: popia-controls-snapshot
asOf: 2026-06-03T07:51:36.522Z
decision-required: false
---

# Iris — POPIA controls snapshot, 2026-06-03

Autonomous run of Iris's weekly POPIA-controls snapshot per `Team/Iris.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Standing-duty digest under POPIA s.56; informs the quarterly s.19–22 joint review with Rashida + Senna.

**Headline:** 18 POPIA / PAIA obligations indexed (1 PARTIAL / deferred) · 0 DSAR received / 0 closed in the last 7 days · 0 `PersonalInformationCompromiseSuspected` events · 0 s.22 notifications dispatched.

## POPIA / PAIA obligations slice

| Obligation | Citation | Owner | Status |
|---|---|---|---|
| ORG-PR(IV)-01 | [TBD] | POPIA / Privacy Policy | Iris |
| ORG-PR(IV)-02 | [TBD] | POPIA / Privacy Policy; Lawful-Processing Register | Iris |
| ORG-PR(IV)-03 | [TBD] | Data Retention & Disposal Policy; Records Management Policy | Iris + Owen |
| ORG-PR(IV)-04 | [TBD] | POPIA / Privacy Policy | Iris |
| ORG-PR(IV)-05 | [TBD] | POPIA / Privacy Policy; Consent & Notice Policy | Iris + Niko |
| ORG-PR(IV)-06 | [TBD] | Information Security Policy; POPIA / Privacy Policy | Iris + Senna |
| ORG-PR(IV)-07 | [TBD] | Incident Response Policy; POPIA / Privacy Policy | Iris (with Senna) |
| ORG-PR(IV)-08 | [TBD] | POPIA / Privacy Policy; Data Subject Rights workflow | Iris |
| ORG-PR(IV)-09 | [TBD] | POPIA / Privacy Policy; Data Subject Rights workflow | Iris |
| ORG-PR(IV)-10 | [TBD] | POPIA / Privacy Policy; Model Risk Policy | Iris (with Helena) |
| ORG-PR(IV)-11 | [TBD] | POPIA / Privacy Policy | Iris |
| ORG-PR(IV)-12 | [TBD] | POPIA / Privacy Policy | Iris |
| ORG-PR(IV)-13 | [TBD] | POPIA / Privacy Policy; Governance Framework | Iris (designation lodgment **deferred** — Round 1 E1) |
| ORG-PR(IV)-14 | [TBD] | POPIA / Privacy Policy | Iris |
| ORG-PR(IV)-15 | [TBD] | Cross-Border Transfer Policy; POPIA / Privacy Policy | Iris (with Devon) |
| ORG-PR(IV)-16 | [TBD] | PAIA Manual; POPIA / Privacy Policy | Iris + Owen |
| ORG-PR(IV)-17 | [TBD] | PAIA Manual | Iris (case-managed) |
| ORG-PR(IV)-13-GLOSS-DEPUTY-IO | [TBD] | POPIA / Privacy Policy; Governance Framework | Iris (with Owen for CoSec lodgment substrate) |

## POPIA events (last 7 days)

| Event | Count |
|---|---|
| `DSARReceived` | 0 |
| `DSARClosed` | 0 |
| `ConsentWithdrawn` | 0 |
| `ProcessingPurposeApproved` | 0 |
| `ProcessingPurposeRejected` | 0 |
| `CrossBorderTransferApproved` (s.72) | 0 |
| `BreachNotificationDispatched` (s.22) | 0 |
| `PersonalInformationCompromiseSuspected` | 0 |
| `InformationRegulatorInquiry` | 0 |

_Build-only context: no live customers and no live processing flows. Zero counts on DSAR / breach / consent are expected and not a substrate alarm. The s.22 breach-notification clock is on standby; absence of trigger is the design._

## Standing-duty readiness

- **Lawful-processing register** — co-located today with `Regulations/_obligations-register.md` POPIA entries. Dedicated substrate is a tracked gap (`Team/Iris.md` § 16).
- **DSAR pipeline** — partial; identity-verification step and downstream-projection-walk scripted, not productised (§ 16). Queue surfaces here.
- **Automated breach-notification workflow** — Senna's IR pipeline emits the trigger; s.22 statutory clock and notification dispatch is not yet productised (§ 16). Clock-management is manual until then.
- **Consent-withdrawal-propagation projection** — Anya-spec'd; not yet built (§ 16). Withdrawals propagate via manual ticket today.
- **Cross-border-transfer gate** — vendor / outsourcing pipeline (Imani) does not yet pause for Iris's adequacy sign-off as a typed gate (§ 16).
- **PAIA-manual generator** — current PAIA manual is authored, not generated (§ 16). Joint with Owen.
- **POPIA s.56 designation lodgment** — deferred per Round 1 E1 (`ORG-PR(IV)-13`); standing duty will activate at lodgment.

Prior `POPIAControlsSnapshot` runs (last 30 days): 1. The cadence accumulates as a heartbeat for Vera's continuous-controls coverage on Iris's surface.

## Iris's narrative

Control surface is 17 of 18 obligations registered with lawful basis logged; one entry — `ORG-PR(IV)-13`, the s.56 Information Officer designation lodgment with the Information Regulator — remains deferred from Round 1 E1 and is the single standing gap. Nothing cleared in the last 7 days: zero DSARs received or closed under s.23–24, zero s.22 breach notifications dispatched, zero s.72 cross-border approvals, zero consent withdrawals under s.11(2)(b), and no Regulator inquiry. The s.22 standby is correctly silent — no `PersonalInformationCompromiseSuspected` event upstream — rather than substrate-silent; the DSAR queue is empty, so Reg 4 response windows are not yet under test.

The consequential observation is that `ORG-PR(IV)-13` is a s.56 *personal* designation duty on me, not a processing control — it does not wait on a data-subject event to bind. Until lodgment is filed, every other obligation in the register is registered against an Information Officer whose designation is not yet on the Regulator's record, which weakens the evidentiary posture of the entire s.11/s.13/s.18 stack if challenged. This ranks above any s.19–22 or s.72 concern this week purely because those surfaces have no live events and `ORG-PR(IV)-13` has a continuous standing breach.

Next action: lodge the s.56 designation with the Information Regulator this cycle and close `ORG-PR(IV)-13` to REGISTERED, with the lodgment acknowledgment cited as the fulfilment-policy reference. No DSAR escalation or s.22 dispatch is owed; the lawful-processing register needs no new substance from me until a processing-purpose or transfer event arrives.

## Provenance

Read `Regulations/_obligations-register.md` for `ORG-PR(IV)-*` rows. Replayed `DSARReceived`, `DSARClosed`, `ConsentWithdrawn`, `ProcessingPurposeApproved`, `ProcessingPurposeRejected`, `CrossBorderTransferApproved`, `BreachNotificationDispatched`, `PersonalInformationCompromiseSuspected`, `InformationRegulatorInquiry`, `POPIAControlsSnapshot` from the host event store.
