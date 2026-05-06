# Role brief — Operations & payments engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Operations & payments engineer** — builds and runs the payment, settlement, custody, and reconciliation rails: SAMOS, BankservAfrica (RTC, EFT, PayShap), SWIFT, card schemes, CLS, and CSDP/Strate hooks.

## 2. Why this role exists

A bank that cannot move money on time, with the right reference data, and reconciled to the cent, will not survive its first month. South Africa's payment landscape is also actively modernising — PayShap, the Vision 2025 programme, ISO 20022 migration on SAMOS — and a fully online bank should be born native to the new world, not retrofitting it.

## 3. Scope of work (priority order)

1. Domestic high-value payments via SAMOS (RTGS) — ISO 20022 native.
2. Domestic low-value and instant payments via BankservAfrica — EFT/AC, RTC, PayShap (rapid payments programme).
3. SWIFT — gpi tracking, MT-to-MX (ISO 20022 CBPR+) migration, sanctions-aware messaging.
4. Card schemes — Visa, Mastercard issuing and acquiring rails as the strategy demands.
5. Settlement and CLS for FX.
6. Custody and securities settlement — Strate as CSD, SWIFT for global custodian links, JSE clearing.
7. Nostro and vostro management, intraday liquidity monitoring (with the risk engineer).
8. Reconciliation — payment vs ledger vs counterparty statements, with break management.
9. Cut-off and calendar engine — every market, every scheme, every holiday.
10. Exception, repair, and investigation workflows.

## 4. Required expertise

- South African payments stack: SAMOS, BankservAfrica services (EFT, AC, RTC, PayShap), Strate.
- SWIFT — Alliance Access or cloud, gpi, MT/MX, CBPR+ migration realities.
- ISO 20022 — pacs, pain, camt message families.
- Reconciliation system design at scale.
- Sanctions-aware payment screening integration with the compliance engineer.

## 5. Desirable expertise

- Card issuing/acquiring (Visa VisaNet, Mastercard MIP), 3DS, tokenisation.
- Cross-border correspondent banking and FX settlement risk management.
- Direct experience of the SARB Vision 2025 programme work.
- Open banking / Stitch / TrueID ecosystem familiarity.

## 6. Regulatory / certification requirements

- National Payment System Act 78 of 1998 and SARB NPSD (National Payment System Department) directives.
- SARB Position Papers and Directives for the NPS.
- PASA / PaymentsSA participant rules and clearing scheme rules.
- Strate CSD rules and JSE settlement rules.
- SARB Currency and Exchanges Manual for Authorised Dealers.
- SWIFT Customer Security Programme (CSP) attestation requirements.
- FIC Act payment-screening obligations (interface with compliance).

## 7. Interfaces

- **Core platform architect** — settlement and posting events.
- **Compliance engineer** — payment screening at message construction time.
- **Trading systems engineer** — settlement instructions for executed trades.
- **Risk engineer** — intraday liquidity and settlement-risk inputs.
- **Accounting engineer** — nostro reconciliation feeds the GL.

## 8. Success criteria — first 90 days

- Documented payment-rail roadmap and scheme-by-scheme onboarding plan.
- A working ISO 20022 message factory and validator.
- Reconciliation framework live for at least one rail end-to-end.
- Cut-off and calendar engine driving downstream timing logic.
- A documented operational-resilience plan aligned with SARB expectations.

## 9. Principle alignment

**P1 — Events as source of truth.** Payment status, nostro positions, settlement state, intraday liquidity, and reconciliation outcomes are projections of payment, settlement, and statement events. Reconciliation is a query equality test against external statements (themselves ingested as events), not a periodic batch.

**P2 — Traceability.** Cut-offs, scheme rules, sanctions screening reasons, payment-instrument validations, and exception-handling steps each cite source: NPS Act, scheme rulebook, SARB directive, OFAC list version, or internal procedure. Sanctions list versions are themselves register-managed.

**P3 — Cloud-native, no manual.** All payments are message-based; no paper instructions or hand-keyed entries. Cash and physical securities are out of the default operating model. Where physical settlement is unavoidable (rare custody edge cases), the physical step is digitised at the earliest moment and registered as a P3 exception.

**P4 — Security by design.** Payment integrity (sender authentication, message signing where the scheme supports), nostro reconciliation tamper-evident, sanctions-list ingestion attested, fraud monitoring on the live message stream. SWIFT CSP attestation is treated as a minimum, not a target.

**P5 — Multi-everything.** Multi-rail across jurisdictions: SAMOS, BankservAfrica, SWIFT today; CHAPS / Fedwire / TARGET2 / regional rails as the bank expands. Nostros per currency per correspondent. Settlement calendars per market. ISO 20022 native everywhere a scheme supports it.

## 10. Sources consulted

- South African Reserve Bank — National Payment System Department directives, position papers, Vision 2025 publications.
- National Payment System Act 78 of 1998.
- BankservAfrica — scheme rules for EFT, AC, RTC, PayShap.
- PASA / PaymentsSA participant agreements and rules.
- Strate — CSD operating rules.
- SWIFT — CBPR+ guidelines, gpi rulebook, CSP.
- ISO 20022 message catalogue.
- SARB Currency and Exchanges Manual for Authorised Dealers.
