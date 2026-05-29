---
agent: Iris
trigger: popia-controls-snapshot
asOf: 2026-05-29T10:20:54.643Z
decision-required: false
---

# Iris — POPIA controls snapshot, 2026-05-29

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

Prior `POPIAControlsSnapshot` runs (last 30 days): 0. The cadence accumulates as a heartbeat for Vera's continuous-controls coverage on Iris's surface.

## Iris's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own._

## Provenance

Read `Regulations/_obligations-register.md` for `ORG-PR(IV)-*` rows. Replayed `DSARReceived`, `DSARClosed`, `ConsentWithdrawn`, `ProcessingPurposeApproved`, `ProcessingPurposeRejected`, `CrossBorderTransferApproved`, `BreachNotificationDispatched`, `PersonalInformationCompromiseSuspected`, `InformationRegulatorInquiry`, `POPIAControlsSnapshot` from the host event store.
