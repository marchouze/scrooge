# Role brief — Risk engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Risk engineer** — designs and operates the market-, credit-, liquidity-, and operational-risk computation, limit, and reporting stack, with ICAAP/ILAAP and stress testing as automated processes rather than annual exercises.

## 2. Why this role exists

Risk in a bank is not a quarterly slide deck — it is a live, constantly recomputed view of capital adequacy, liquidity adequacy, and exposure. The Prudential Authority expects boards to demonstrate risk understanding at any moment. This role builds the system that makes that demonstration trivial.

## 3. Scope of work (priority order)

1. Market risk — sensitivities (DV01, delta, gamma, vega), VaR (historical, parametric), expected shortfall, FRTB-aligned where the bank elects to be.
2. Credit risk — PD/LGD/EAD models, counterparty credit risk (CVA/DVA basics, SA-CCR), IFRS 9 ECL stages and computation.
3. Liquidity risk — LCR, NSFR, intraday liquidity monitoring, contractual and behavioural cash-flow ladders.
4. Operational risk — loss-event capture, key-risk indicators, scenario library, capital under standardised approach.
5. Limits framework — board limits → desk limits → trader limits, hierarchical, with pre-trade enforcement via the trading stack.
6. ICAAP and ILAAP — as continuously updated documents driven from live data, not as annual Word files.
7. Stress testing — scenario library, run engine, results capture, board reporting.
8. Risk-return analytics — RAROC, capital allocation, FTP inputs.
9. SARB risk-related BA returns: BA200, BA300 (capital), BA320 (credit), BA325 (market risk), BA330 (equity risk), BA340 (operational risk), BA350 (interest-rate risk in the banking book), BA610 (liquidity).

## 4. Required expertise

- Quantitative finance: pricing, sensitivities, VaR, ECL, IRRBB.
- Basel III/IV framework and the SARB Regulations Relating to Banks.
- Risk-data architecture — BCBS 239 in spirit and substance.
- Numerical libraries and reproducible quant pipelines.
- Model governance — development, validation, monitoring, versioning.

## 5. Desirable expertise

- FRM or CFA charterholder.
- Experience implementing FRTB, SA-CCR, or IFRS 9 ECL at a bank.
- Stress-testing frameworks (EBA/PRA-style or SARB CCAR-equivalent).
- Tooling: Numerix, MX.3, RiskMetrics, OpenGamma — or in-house quants.

## 6. Regulatory / certification requirements

- SARB Regulations Relating to Banks — the capital, liquidity, and reporting chapters.
- BCBS standards — Basel III post-crisis reforms (Basel IV), FRTB, SA-CCR, IRRBB, NSFR, LCR.
- Prudential Standards and directives issued by the Prudential Authority.
- Internal model governance aligned with SARB Directive on model risk where applicable.
- IFRS 9 ECL methodology in lock-step with the accounting engineer.

## 7. Interfaces

- **Core platform architect** — positions, balances, cash-flow events.
- **Trading systems engineer** — sensitivities, intraday limits, pre-trade gateway.
- **Accounting engineer** — IFRS 9 ECL and capital BA returns.
- **Compliance engineer** — concentration limits, large-exposure reporting (BA700).
- **Operations engineer** — settlement and intraday liquidity inputs.
- **Internal audit engineer** — independent model validation evidence.

## 8. Success criteria — first 90 days

- A documented risk taxonomy and metric inventory mapped to BA returns and IFRS disclosures.
- A working VaR and sensitivity computation on the trading engineer's first asset class.
- An IFRS 9 ECL methodology agreed with accounting and a working stage-allocation routine.
- A first-cut LCR computation from live cash-flow ladders.
- A live ICAAP/ILAAP scaffold — not annual, continuously updated.

## 9. Principle alignment

**P1 — Events as source of truth.** VaR, expected shortfall, sensitivities, IFRS 9 ECL, LCR, NSFR, RWA, and operational-risk capital are queries over the event log and reference data. ICAAP and ILAAP documents pull values live, not from snapshots. Stress tests are alternate event streams replayed through the same projection engine. Limit utilisation is a projection, not a stored counter.

**P2 — Traceability.** Every metric, every limit, every model, every parameter cites the BCBS standard, SARB regulation, IFRS paragraph, or internal model-governance document that justifies it. Model versions are register entries; their citations are part of the model card.

**P3 — Cloud-native, no manual.** Risk computation runs on managed elastic compute. Limit overrides are event-driven coded workflows with explicit approver and citation. No manual market-data adjustments — corrections are themselves events, registered and reviewable.

**P4 — Security by design.** Model artefacts are signed and version-controlled. Parameter changes are registered events with approver attribution. Limit-override approvals are cryptographically signed. Risk-data confidentiality is enforced at the projection layer.

**P5 — Multi-everything.** Capital and liquidity computed per legal entity and consolidated. FX and translation risk are first-class. Jurisdiction-specific stress scenarios layer over global ones (SARB, plus host regulators on expansion). Limits framework is hierarchical across entity, country, desk, and trader.

## 10. Sources consulted

- South African Reserve Bank — Regulations Relating to Banks; PA directives and guidance notes; BA return suite.
- Basel Committee on Banking Supervision — Basel III post-crisis reforms; FRTB; SA-CCR; IRRBB; LCR; NSFR; principles for sound stress testing.
- BCBS 239 — risk-data aggregation and reporting.
- IFRS 9 — financial instruments.
- Global Association of Risk Professionals (GARP) FRM body of knowledge.
