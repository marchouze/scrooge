---
title: Activity Taxonomy
description: Canonical set of ACT-* codes used to classify which bank activities each obligation applies to.
version: "1.0"
authored-by: Atlas (Core banking platform architect, engineering)
authored-date: 2026-05-13
canonical-source: prototype/platform/activities/taxonomy.ts
status: LIVE
---

# Activity Taxonomy

This register is the **markdown render** of the canonical activity taxonomy. The authoritative source is `prototype/platform/activities/taxonomy.ts`. Any discrepancy between this file and the TypeScript source is a Principle-2 violation — the TypeScript wins.

**32 codes across 8 groups.** The `Product scope` and `Activity scope` columns in `_obligations-register.md` reference these codes. `universal` is a special value meaning "applies to all activities / all products".

## Codes by Group

### Trading

| Code | Label | Description |
|------|-------|-------------|
| `ACT-TRADE-FX` | FX dealing | FX dealing — spot, forward, swap (vanilla and NDF) under D-FX-* sub-decisions |
| `ACT-TRADE-BOND` | Bond trading | Bond trading on JSE and OTC markets (fixed-coupon, FRN, inflation-linked) |
| `ACT-TRADE-EQUITY` | Equity trading (JSE) | Listed equity cash trading on the JSE primary market |
| `ACT-TRADE-OTC-IRD` | OTC interest rate derivatives | OTC IRD — vanilla IRS first; Bermudan/swaption later (M3) |
| `ACT-TRADE-OTC-CREDIT` | OTC credit derivatives | OTC credit derivatives (M5+, reserved) |

### Banking

| Code | Label | Description |
|------|-------|-------------|
| `ACT-BANK-DEPOSIT` | Deposit-taking | Deposit-taking under Banks Act §11 |
| `ACT-BANK-PAYMENT` | Payment processing | Payment processing via SAMOS / sponsor-bank channel (indirect participant posture) |
| `ACT-BANK-NOSTRO` | Nostro & correspondent management | Nostro account management and correspondent-bank relationships |

### Client

| Code | Label | Description |
|------|-------|-------------|
| `ACT-CLIENT-ONBOARD` | Client onboarding (KYC/CDD/EDD) | Counterparty/client onboarding — KYC, CDD, EDD per FIC Act and FATF standards |
| `ACT-CLIENT-ADVICE` | FAIS investment advice | FAIS-regulated investment advice (Category I/II FSP activities) |
| `ACT-CLIENT-CATEGORISE` | Client categorisation & suitability | Client categorisation (retail/professional/market-counterparty) and suitability |

### Reporting

| Code | Label | Description |
|------|-------|-------------|
| `ACT-REPORT-PRUDENTIAL` | Prudential regulatory reporting | Prudential reporting — BA returns, ICAAP, ILAAP, Pillar 3 disclosure |
| `ACT-REPORT-CONDUCT` | Conduct regulatory reporting | Conduct and market-abuse regulatory reporting (FSCA, FMA) |
| `ACT-REPORT-FINSURV` | FX / FinSurv reporting | FX and FinSurv reporting under Exchange Control Regulations (EXCON) |
| `ACT-REPORT-TRADE` | Trade reporting | Trade reporting to STRATE / Umoja / ODP post-trade |

### Risk

| Code | Label | Description |
|------|-------|-------------|
| `ACT-RISK-CAPITAL` | Capital management | Capital management and adequacy (Pillar 1 + 2, BA return lines) |
| `ACT-RISK-LIQUIDITY` | Liquidity management | Liquidity management — LCR, NSFR, ILAAP |
| `ACT-RISK-MARKET` | Market risk management | Market risk management — IMA / SA-MR, VaR, stress |
| `ACT-RISK-CREDIT` | Credit & counterparty risk | Credit and counterparty risk (CCR, CVA, SA-CCR) |
| `ACT-RISK-OPERATIONAL` | Operational risk management | Operational risk management — BIA/SA/IMA frameworks |
| `ACT-RISK-MODEL` | Model risk & validation | Model risk governance and independent validation (Nadia, Tier 1-3) |

### Governance

| Code | Label | Description |
|------|-------|-------------|
| `ACT-GOVERN-BOARD` | Board & committee governance | Board and committee governance (Thandiwe, Owen, King IV, Companies Act) |
| `ACT-GOVERN-AUDIT` | Internal audit | Internal audit programme (Vera, third-line independence) |
| `ACT-GOVERN-COMPLIANCE` | Compliance monitoring | Compliance programme, monitoring, and MLRO/FAIS-compliance functions |
| `ACT-GOVERN-REMUNER` | Remuneration governance | Remuneration governance (FSB/FSCA remuneration standards, Principle 5 BCBS) |

### Technology

| Code | Label | Description |
|------|-------|-------------|
| `ACT-TECH-IT` | IT systems management | IT systems management (Principle 3 cloud-native posture) |
| `ACT-TECH-CYBER` | Cybersecurity | Cybersecurity and cyber resilience (Joint Standard 2 of 2024, Rashida) |
| `ACT-TECH-DATA` | Data management | Data management and governance (BCBS 239, POPIA, Principle 4) |
| `ACT-TECH-KEY-MGMT` | Cryptographic key management | Cryptographic key management (FIPS Level 3, Azure Key Vault Managed HSM) |

### Corporate

| Code | Label | Description |
|------|-------|-------------|
| `ACT-CORP-ENTITY` | Legal entity management | Legal entity management — company secretarial, CIPC filings (Owen) |
| `ACT-CORP-EMPLOYEE` | Employment & HR | Employment and HR (BCEA, LRA — activates at licence-day) |
| `ACT-CORP-LEGAL` | Legal & contracting | Legal and contracting — ISDA/GMRA clause library, ECTA (Imani) |

## Special Values

| Value | Meaning |
|-------|---------|
| `universal` | Obligation applies to all activities (bank-wide) |
| `[TBD]` | Activity scope not yet assessed — treated as `universal` by the parser |

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-13 | Atlas | v1.0 — initial 32-code taxonomy, 8 groups; mirrors prototype/platform/activities/taxonomy.ts |
