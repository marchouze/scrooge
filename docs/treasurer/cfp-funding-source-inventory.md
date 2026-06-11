---
document-id: cfp-funding-source-inventory-v1
title: CFP Funding-Source Inventory — Hoz Bank Limited
version: "1.0"
status: ACTIVE
owner: Eitan (Treasurer, governance)
effective-from: "2026-06-11"
next-review: "2027-06-11"
policy-parent: Policies/liquidity-risk-management-policy-v1.md §5.3
citations:
  - Policies/liquidity-risk-management-policy-v1.md §5.3
  - BCBS 144 Principle 11
  - Regulations/Banks/banks-act-94-1990 Reg 26
  - D-TREASURER-WAVE2-SUBSTRATE
author: Eitan (Treasurer, governance)
date: 2026-06-11
---

# CFP Funding-Source Inventory — Hoz Bank Limited

> **Owner:** Eitan (Treasurer, governance) — plan maintenance.
> **Effective date:** 2026-06-11.
> **Policy parent:** `Policies/liquidity-risk-management-policy-v1.md` §5.3 — Funding-source hierarchy under CFP activation.
> **Authority:** `D-TREASURER-WAVE2-SUBSTRATE` (CEO-approved 2026-06-11).
> **Regulatory basis:** BCBS 144 Principle 11 (Contingency Funding Plan) + `ORG-PR-15` + Banks Act 94 of 1990 Reg 26 (liquidity-risk management).

The Contingency Funding Plan requires a **documented, tested, and annually rehearsed** inventory of funding sources across the three CFP activation tiers (LRM Policy v1 §5.3). This register is the canonical, operationally-ready form of that inventory. It identifies every source, its activation mechanism, its realistic capacity as at the register date, its time-to-drawdown, and any material preconditions or blockers that limit its operational availability.

Each source is indexed by `Tier.Seq` (e.g. `T1.1`) matching the hierarchy in LRM Policy v1 §5.3.

---

## Tier 1 — Intraday / Same-day Measures

**Activation trigger:** `IntradayStressDetected { severity: "persistent" }` or `CriticalSettlementObligationAtRisk {}` — automatic, no governance decision required for Tier 1 activation. Eitan notified within 1 hour; ALCO briefed within 2 hours.

**Purpose:** Generate same-day ZAR liquidity to cover an intraday funding gap or at-risk time-specific settlement obligation.

### T1.1 — HQLA Buffer Liquidation (Level 1 SAGB Repo)

| Field | Value |
|---|---|
| Source type | HQLA buffer — Level 1 South African Government Bonds (SAGBs) |
| Activation mechanism | Eitan initiates intraday repo of SAGBs through BondservAfrica-clearing counterparties or directly via the SARB intraday repo window (see T1.2). |
| Realistic capacity (build-phase) | Build-phase: zero HQLA stock (no positions). At licence-day: sized at ≥ 120% of the 99th-percentile peak intraday net payment obligation per LRM Policy v1 §4.3. |
| Time-to-drawdown | Same-business-day; BondservAfrica cut-off before 14:30. |
| Pre-conditions | HQLA stock unencumbered; SAGBs rated ≥ sovereign minimum; BondservAfrica settlement connectivity operational. |
| Primary operator | Eitan (Treasurer, governance) — activates; Saskia (Head of Global Markets, governance) — executes repo transaction; Atlas (Core banking platform architect, engineering) — settlement routing. |
| Monitoring event | `IntradayLiquidityReported { tool: "1" }` (BCBS 248 Tool 1 peak-usage) + `IntradayHQLAStressProjection` per settlement window. |
| Status | **Operational at licence-day** — subject to HQLA stock being funded at commencement of trading. Build-phase: zero stock, no drawdown capacity. |
| LRM citation | LRM Policy v1 §5.3 Tier 1 item 1 (HQLA repo). |

### T1.2 — SARB Intraday Repo Standing Facility

| Field | Value |
|---|---|
| Source type | SARB intraday repo standing facility — the SARB's real-time-gross-settlement (RTGS) intraday liquidity provision mechanism for SAMOS participants and their correspondents. |
| Activation mechanism | As an **indirect NPS participant** (per `D-SAMOS-NON-CLEARING`), Hoz Bank Limited accesses the SARB intraday repo facility **through its ZAR correspondent bank**. Eitan requests the correspondent bank to draw on the SARB intraday facility on Hoz Bank's behalf, collateralised against Hoz Bank SAGBs transferred to the correspondent for this purpose. |
| Realistic capacity | Limited by the ZAR SAGB collateral Hoz Bank has pre-positioned with its correspondent bank for this purpose. Eitan sets the pre-positioned collateral limit at ALCO monthly. |
| Time-to-drawdown | Same-business-day; SARB RTGS windows apply. Correspondent bank instruction cut-off: aligned to NPS settlement window 3 (approximately 14:00). |
| Pre-conditions | (1) Approved, operational ZAR correspondent bank in place (see Policies/nostro-correspondent-banking-policy-v1.md §2). **(W2.1 externally blocked: ZAR correspondent/sponsor bank not yet selected — see §Blockers.)** (2) SAGB collateral pre-positioned at correspondent bank under a repo-collateral agreement. (3) SARB intraday facility participation confirmed through the correspondent's SAMOS membership. |
| Primary operator | Eitan (Treasurer, governance) — instructs; correspondent bank treasury desk — executes SARB facility drawdown. |
| Monitoring event | Same BCBS 248 Tool 1 / Tool 2 stream as T1.1. |
| Status | **W2.1 externally blocked — counterparty TBD.** SARB facility access requires an operational ZAR correspondent bank. Correspondent/sponsor bank selection is a pre-licence mandatory deliverable (see §Blockers). |
| LRM citation | LRM Policy v1 §5.3 Tier 1 item 2 (intraday credit line drawdown — via correspondent). |

### T1.3 — Payment-Flow Optimisation

| Field | Value |
|---|---|
| Source type | Operational measure — rescheduling non-time-critical outgoing ZAR payments to maximise incoming funds arriving before critical cut-offs. |
| Activation mechanism | Tomas (Operations & payments engineer, engineering) holds back non-time-critical outgoing payment instructions pending clearance of incoming MT202/MT103 flows. Eitan approves the deferral list. |
| Capacity | Not a liquidity source per se; reduces net intraday outflows. Effective liquidity impact depends on the payment flow profile on the day. |
| Time-to-implement | Immediate — no counterparty dependency. |
| Pre-conditions | Time-critical payments (BondservAfrica cut-offs, JSE settlement cycles, SWIFT MT202COV cut-offs per LRM Policy v1 §4.2 Tool 4) are **never deferred**. |
| Primary operator | Tomas (Operations & payments engineer, engineering); Eitan (governance approval). |
| Status | **Operational** — executable with current technology stack. |
| LRM citation | LRM Policy v1 §5.3 Tier 1 item 3 (payment-flow optimisation). |

---

## Tier 2 — 24-hour to 30-day Measures

**Activation trigger:** `LcrRatioBreach { severity: "warning" }` (LCR below 120% internal floor but ≥ 100%) or `FundingConcentrationAlertTriggered {}` (single-counterparty ≥ 15% of total liabilities) or `ExternalCreditEventDetected { impact: "material" }`.

**Governance:** Eitan convenes ALCO (Helena (Chief Risk Officer, governance), Camille (Chief Financial Officer, governance), Devon (Chief Operating Officer, governance), Saskia (Head of Global Markets, governance)) within 4 hours of trigger. Tier 2 plan activated on ALCO quorum. CEO informed same day.

### T2.1 — Asset-Sale or HQLA Repo (Short-Term)

| Field | Value |
|---|---|
| Source type | Monetisation of the HQLA buffer — outright sale or term repo (overnight to 7-day) of Level 1 and Level 2A HQLA assets. |
| Activation mechanism | Eitan instructs Saskia to execute repo or outright sale through BondservAfrica-clearing counterparties or JSE-approved repo dealers. ALCO pre-approval required at Tier 2 activation. |
| Drawdown order | Level 1 (SAGBs, overnight repo) first; Level 2A second; Level 2B only if Level 1/2A insufficient per LRM Policy v1 §5.3 Tier 2 item 1. |
| Realistic capacity | Build-phase: zero. At licence-day: HQLA buffer less any Tier 1 drawdowns; minimum ZAR 50m intraday floor (RAS `appetite:liquidity:intraday` — `floorZar: 50_000_000`). |
| Time-to-drawdown | Same-day for overnight repo (BondservAfrica cut-off); T+1 for outright sale settlement. |
| Pre-conditions | HQLA unencumbered; BondservAfrica connectivity; approved repo counterparty panel. |
| Primary operator | Eitan (governance); Saskia (execution). |
| Status | **Operational at licence-day.** Build-phase: no HQLA stock. |
| LRM citation | LRM Policy v1 §5.3 Tier 2 item 1. |

### T2.2 — Correspondent Facility Drawdown

| Field | Value |
|---|---|
| Source type | Pre-arranged credit or liquidity facility with the ZAR correspondent/sponsor bank — either an uncommitted overdraft line, a committed revolving credit facility, or a repo facility against bank-eligible collateral. |
| Activation mechanism | Eitan sends drawdown instruction to the correspondent bank treasury desk under the agreed facility agreement. |
| Realistic capacity | **TBD** — facility type, limit, tenor, and pricing are subject to the correspondent/sponsor bank selection (W2.1). No committed facility currently exists. |
| Time-to-drawdown | Same-day to T+1 (depends on facility agreement); overnight borrowing typically available before 16:00. |
| Pre-conditions | **(W2.1 externally blocked.)** Operational correspondent/sponsor bank + signed facility agreement + approved counterparty credit limit (Helena). |
| Primary operator | Eitan (Treasurer, governance). |
| Status | **W2.1 externally blocked — counterparty TBD.** Hoz Bank has not yet selected its ZAR correspondent/sponsor bank. This source is unavailable until correspondent bank selection and facility negotiation complete. The W2.1 gap is recorded as an open finding in the annual rehearsal evidence pack pending correspondent selection at the licence-application milestone. |
| LRM citation | LRM Policy v1 §5.3 Tier 2 item 2 (interbank borrowing / wholesale funding). Nostro and Correspondent Banking Policy v1 §2 (approved correspondent bank list and facility governance). |

### T2.3 — Withdrawal of Interbank Placements

| Field | Value |
|---|---|
| Source type | Early recall of interbank deposits placed with other banks (overnight or call money). |
| Activation mechanism | Eitan calls back overnight/call deposits in order of tenor — shortest first (overnight before weekly before monthly). ALCO notification before acting on any placement ≥ ZAR 10m. |
| Realistic capacity | Build-phase: zero placements. At licence-day: par value of outstanding call/overnight deposits minus any locked-term placements. |
| Time-to-drawdown | Overnight deposits: same-day recall (before cut-off). Call deposits: T+0 or T+1 per bilateral agreement. |
| Pre-conditions | No ISDA early-termination fee for call facilities; bilateral agreement terms permit recall. |
| Primary operator | Eitan (Treasurer, governance); Saskia (execution of money-market trades). |
| Status | **Operational at licence-day.** No placements in build phase. |
| LRM citation | LRM Policy v1 §5.3 Tier 2 item 2 (withdrawal of interbank placements). |

### T2.4 — Term Repo Against Bond Collateral (Overnight)

| Field | Value |
|---|---|
| Source type | Overnight repo secured against bond collateral — SAGBs or other LCR-eligible bonds held in the trading book or HQLA buffer. |
| Activation mechanism | Eitan instructs Saskia to execute overnight repo with ALCO-approved repo counterparties (JSE-registered repo dealers; BondservAfrica-clearing). |
| Realistic capacity | Bond inventory haircut-adjusted market value, less any bonds already pledged as collateral. |
| Time-to-drawdown | Same-day (BondservAfrica cut-off). Overnight tenor (T to T+1); rollable. |
| Pre-conditions | Unencumbered bond inventory; approved repo-counterparty panel (Eitan / ALCO); no over-concentration in repo book (RAS). |
| Primary operator | Eitan (governance); Saskia (Head of Global Markets, governance — execution). |
| Status | **Operational at licence-day** when bond inventory is established. Build-phase: zero bond inventory. |
| LRM citation | LRM Policy v1 §5.3 Tier 2 item 1 (asset-sale or repo). |

### T2.5 — Curtailment of New Lending and Investment

| Field | Value |
|---|---|
| Source type | Liquidity preservation — suspension of new commitments that reduce the buffer (new repo positions, new bond purchases, new interbank loans) except those required to manage market-making positions within existing approved limits. |
| Activation mechanism | Eitan issues a curtailment instruction to Saskia (markets) and the relevant product desks at ALCO Tier 2 activation. Existing approved-limit trading continues; no new limit increases. |
| Liquidity impact | Frees up committed-but-undrawn deployment capacity; prevents net liquidity reduction while the Tier 2 stress is active. |
| Time-to-implement | Immediate — no counterparty dependency. |
| Pre-conditions | None beyond ALCO quorum. |
| Primary operator | Eitan (governance); Saskia (markets); Devon (COO — operational execution). |
| Status | **Operational** — procedural measure. |
| LRM citation | LRM Policy v1 §5.3 Tier 2 item 3 (curtailment of new lending and investment). |

---

## Tier 3 — Multi-day / Strategic / Survival Measures

**Activation trigger:** `LcrRatioBreach { severity: "critical" }` (LCR ≤ 100%) or `NsfrRatioBreach { severity: "critical" }` (NSFR ≤ 100%) or `RecoveryEarlyWarningTriggered {}`.

**Governance:** CEO activated immediately. Board notification within 24 hours. SARB (PA) notification if LCR/NSFR below regulatory minimum per Reg 26 and LRM Policy v1 §9.1 (Critical tier) and §9.4 (written notification per PA D1/2022 §4.1.6). Helena activates the Recovery Plan assessment per the ICAAP/ILAAP/Recovery framework §3.3.5.

> **Note:** All Tier 1 and Tier 2 measures activate at maximum scale alongside Tier 3 sources.

### T3.1 — Emergency SARB Liquidity Support

| Field | Value |
|---|---|
| Source type | Last-resort liquidity support from the South African Reserve Bank — either through the SARB's emergency liquidity assistance (ELA) facility or through an extended access to the SARB's Marginal Lending Facility (via the ZAR correspondent bank). |
| Activation mechanism | CEO engages the PA directly; Eitan coordinates with the ZAR correspondent bank for the mechanics of SARB facility access. Owen (Company Secretary, governance) manages the regulatory engagement under the recovery-plan notification protocol. |
| Realistic capacity | Determined by the SARB on a case-by-case basis; typically collateral-constrained (requires government-securities or other SARB-eligible collateral). |
| Time-to-drawdown | 24–72 hours for ELA (SARB Board approval required for substantial amounts). Marginal Lending Facility: overnight (via correspondent's SAMOS access). |
| Pre-conditions | (1) CEO-level engagement with the PA. (2) Adequate unencumbered SARB-eligible collateral. (3) Recovery Plan formally activated (Helena). **(W2.1 externally blocked for SARB ML Facility — correspondent bank required.)** |
| Primary operator | CEO (Marc); Eitan (Treasurer, governance); Owen (Company Secretary, governance — regulatory liaison). |
| Status | **Structurally available at licence-day.** SARB has the legal mandate to provide emergency liquidity support to licensed banks. No pre-arranged facility exists; activation is a supervisory / regulatory engagement. |
| LRM citation | LRM Policy v1 §5.3 Tier 3 item 3 (regulatory engagement). BCBS 144 Principle 11 (contingency plans include central-bank access). |

### T3.2 — Capital Raise / Subordinated Debt Issuance

| Field | Value |
|---|---|
| Source type | Emergency capital injection by major shareholder(s) or subordinated-debt issuance — converts a liquidity event into a capital / funding-base event. |
| Activation mechanism | **Board authority required.** CEO and Camille (CFO) present the capital-injection proposal to the Board under the Recovery Plan options inventory. Owen manages the legal execution of the issuance or shareholder-loan agreement. |
| Realistic capacity | Depends on shareholder capacity and market conditions. For the build-phase / early post-licence period: shareholder (Marc / founding entity) is the primary source. ISDA/GMRA-governed subordinated note issuance (Imani (Legal-as-code engineer, engineering) — contract execution). |
| Time-to-drawdown | Shareholder injection: 1–5 business days (legal documentation and transfer). Subordinated-debt issuance: 5–20 business days (documentation + settlement). |
| Pre-conditions | Board resolution. Helena assessment of capital/recovery plan viability. Owen legal execution. |
| Primary operator | CEO (Marc); Camille (CFO); Owen (Company Secretary); Imani (legal documentation). |
| Status | **Board-authority-gated.** No pre-arranged commitment. Activation is a Board-reserved decision per LRM Policy v1 §8.3 and the Capital Management Policy. |
| LRM citation | LRM Policy v1 §5.3 Tier 3 item 2 (Recovery Plan activation) and Tier 3 item 4 (balance-sheet restructuring — capital dimension). BCBS 144 Principle 11. |

### T3.3 — Balance-Sheet Restructuring (Accelerated Wind-down)

| Field | Value |
|---|---|
| Source type | Accelerated reduction of the balance sheet — trading-book wind-down, loan sales, repo-book contraction — to reduce RSF requirements and generate liquidity from asset sales. |
| Activation mechanism | CEO approves; Eitan and Saskia execute the wind-down sequence (Saskia governs market-making book exit; Eitan governs treasury-book contraction). Helena sets the pace consistent with the Recovery Plan survival horizon. |
| Realistic capacity | Full fair-value realisation of the trading book (mark-to-market less market-impact discounts for forced sale). Build-phase: zero balance sheet; not applicable. |
| Time-to-drawdown | 1–5 business days per asset class (SAGBs / FX / bonds). Illiquid positions (loans, long-dated bonds) may require 10–20 business days. |
| Pre-conditions | CEO + Board approval (if restructuring materially changes the business model). ALCO sign-off on execution sequencing. |
| Primary operator | CEO (Marc); Eitan (treasury-book); Saskia (trading-book). |
| Status | **Operational at licence-day** when positions exist. Build-phase: zero. |
| LRM citation | LRM Policy v1 §5.3 Tier 3 item 4 (balance-sheet restructuring). |

---

## Blockers and Open Findings

### W2.1 — ZAR Correspondent / Sponsor Bank Selection (Externally Blocked)

The following Tier 2 and Tier 3 sources depend on an operational ZAR correspondent/sponsor bank being in place:

- **T1.2** — SARB Intraday Repo (via correspondent): **blocked**
- **T2.2** — Correspondent Facility Drawdown: **blocked** (TBD — counterparty, facility terms, and limit not yet established)
- **T3.1** — SARB Marginal Lending Facility (via correspondent): **partially blocked**

The correspondent/sponsor bank selection is a pre-licence mandatory deliverable (per the Regulatory Readiness Gate Plan `D-REGULATORY-READINESS-GATE-PLAN`). Until selection is confirmed and a facility agreement is signed, T2.2 carries zero operative capacity. This limitation is recorded as an **open finding** in every annual CFP rehearsal evidence pack until resolved.

**Owner:** Devon (Chief Operating Officer, governance) — selection process; Eitan (Treasurer, governance) — facility terms and treasury requirements; Zara (Chief Compliance Officer, governance) — AML/CFT due diligence.

---

## Annual Inventory Attestation

Per LRM Policy v1 §5.4 (rehearsal evidence standard), the CFP rehearsal evidence pack includes an attestation from Eitan that:

1. All sources in this inventory have been reviewed and contacts/agreements are current.
2. The W2.1 blocker has been assessed and its status updated (resolved / still open).
3. The realistic capacity estimates are consistent with the current balance-sheet position and HQLA buffer.
4. Any new sources identified in the past year have been added.

The attestation is emitted as a `RehearsalEvidenceCollected` event by the CFP rehearsal harness (`prototype/platform/alm/cfp-rehearsal-harness.ts`), with `inventoryCoveragePct` and `openFindings` fields.

---

## Change Log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-06-11 | Eitan (Treasurer, governance) | Initial inventory. Three tiers, seven sources (T1.1–T1.3, T2.1–T2.5, T3.1–T3.3). W2.1 blocker (correspondent/sponsor bank TBD) recorded on T1.2, T2.2, T3.1. Annual attestation standard defined. Authority: D-TREASURER-WAVE2-SUBSTRATE. |
