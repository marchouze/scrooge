# Role brief — Internal audit / continuous-assurance engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Internal audit / continuous-assurance engineer** — designs and runs the third-line-of-defence assurance platform: continuous controls monitoring, automated evidence, exception reporting, and board/audit-committee output.

## 2. Why this role exists

Internal audit at a regulated bank is not optional and not annual. The Prudential Authority and the IIA standards both expect an independent, risk-based, evidence-driven function. In a bank where every control is coded, internal audit's natural form is continuous: every control tested every day, exceptions investigated, trend lines surfaced. This role builds that function as a system, not a binder.

## 3. Scope of work (priority order)

1. Three-lines-of-defence model — clear separation of first-line ownership, second-line oversight (compliance, risk), third-line independent assurance.
2. Risk-based audit universe — every process, control, and system mapped, scored, and scheduled.
3. Continuous controls monitoring — automated tests over the full control inventory, every cycle.
4. Audit-evidence collection — immutable, time-stamped, queryable; never reconstructed after the fact.
5. Issues, actions, and tracking — with severity, owner, target date, escalation, and verification of closure.
6. Audit-committee and board reporting — automated packs, drill-through to source evidence.
7. Co-source and external-auditor liaison — providing structured working-paper handoffs.
8. Independence safeguards — engineering and process measures that prove independence to the regulator.
9. Whistle-blower channel and protected-disclosure handling (under the Protected Disclosures Act).

## 4. Required expertise

- Internal-audit methodology to IIA International Professional Practices Framework standards.
- Banking control taxonomy — what to test, where, and how often.
- Continuous controls monitoring / continuous auditing — design and delivery.
- Data analytics and audit-analytics tooling.
- Evidence and audit-trail engineering — logs, hashes, retention, legal hold.

## 5. Desirable expertise

- CIA (Certified Internal Auditor) or CISA, with banking experience.
- COBIT 2019, COSO Internal Control – Integrated Framework familiarity.
- Prior experience with King IV governance reporting.
- Experience with audit platforms (TeamMate+, AuditBoard, Workiva) — pattern reference even if building in-house.

## 6. Regulatory / certification requirements

- IIA IPPF — Standards and Code of Ethics.
- SARB Prudential Authority directives and guidance on internal audit.
- Banks Act 94 of 1990 — internal audit obligations.
- Companies Act 71 of 2008 — audit committee provisions.
- King IV Report on Corporate Governance.
- Auditing Profession Act 26 of 2005 — for external-audit interface.
- Protected Disclosures Act 26 of 2000.
- IIA Three Lines Model (2020 update).

## 7. Interfaces

- **Every other engineer** — internal audit is the only role with explicit independent reach across the entire bank.
- **Risk engineer** — model validation, limit-framework testing.
- **Compliance engineer** — regulatory-control testing without becoming compliance.
- **Accounting engineer** — controls over financial reporting.
- **Core platform architect** — immutable-log and evidence design at source.
- **Audit committee / board** — reporting line.

## 8. Success criteria — first 90 days

- Audit universe documented and risk-scored.
- Continuous-controls-monitoring framework designed and live for at least one process end-to-end.
- Issues-and-actions register live with at least one closed-loop cycle.
- Independence safeguards documented and reviewed.
- First audit-committee pack producible from the system, not assembled.

## 9. Principle alignment

**P1 — Events as source of truth.** Continuous controls monitoring runs as projections over the event log. Audit evidence *is* the event log; nothing is reconstructed after the fact. Sample selection, control testing, and exception trending are all queries.

**P2 — Traceability.** Internal audit's primary independent test is that *the obligations-register link still holds and is correct* — the right citation, the right version, applied to the right control. Tests assert citation integrity alongside control execution. Audit findings are themselves register-linked back to the obligation breached.

**P3 — Cloud-native, no manual.** Audit work is continuous and in-system. No fieldwork in the traditional sense — evidence is queried directly from the event log. Audit-committee packs are auto-generated. Where an external party (such as the external auditor) requires a manual interaction, the interaction is itself captured as an event in the audit case file.

**P4 — Security by design.** Audit independence is reinforced cryptographically: auditors hold read-only keys across the full event log and append-only finding logs no other role can rewrite. Audit findings are themselves signed and timestamped. Independence safeguards are testable, not declared.

**P5 — Multi-everything.** Audit universe is organised by entity and jurisdiction. Group audit consolidates entity-level assurance. Jurisdictional regulators (PA, FSCA, FIC today; host regulators on expansion) are register entries, not hardcoded; testing dispatches on jurisdiction.

## 10. Sources consulted

- Institute of Internal Auditors — International Professional Practices Framework; IIA Three Lines Model (2020).
- South African Reserve Bank Prudential Authority — directives and guidance on internal audit, governance, and risk.
- Banks Act 94 of 1990.
- Companies Act 71 of 2008.
- King IV Report on Corporate Governance for South Africa, 2016.
- COSO — Internal Control – Integrated Framework (2013).
- ISACA — COBIT 2019.
- Auditing Profession Act 26 of 2005.
- Protected Disclosures Act 26 of 2000.
