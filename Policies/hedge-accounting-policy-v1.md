---
policy-id: HEDGE-ACCOUNTING-V1
title: Hedge Accounting Policy
version: "1"
status: IN FORCE
owner: Camille (CFO, governance)
effective-from: "2026-05-14"
next-review: "2027-05-14"
citations:
  - "IFRS 9 Financial Instruments: Chapter 6 (hedge accounting — §§6.1–6.8)"
  - "IAS 39 Financial Instruments — Recognition and Measurement: §§71–102 (hedge accounting — legacy option until IFRS 9 full adoption)"
  - "IFRS 7 Financial Instruments — Disclosures: §§22–24 (hedge accounting disclosures)"
  - "IAS 21 The Effects of Changes in Foreign Exchange Rates: §§20–22 (net investment hedges)"
  - "Banks Act 94 of 1990: s90 (accounting records)"
author: Mira (Compliance / RegTech engineer)
co-author: Camille (CFO, governance)
date: 2026-05-14
summary: >
  Hedge Accounting Policy covering designation of hedging relationships (fair value,
  cash flow, net investment), hedge documentation requirements, effectiveness testing
  (qualitative and quantitative), discontinuation, and disclosures under IFRS 9
  Chapter 6. Closes obligations ORG-CS3-006 (daily valuation — hedge instrument
  component) and ORG-AC-03 (IFRS hedge accounting compliance).
  Interaction with Accounting Policies — IFRS v1 (FIN-ACCT-01).
decision-required: false
riskTaxonomy:
  - RT-MR.GN
  - RT-LR.RC
---

# Hedge Accounting Policy

> **Authors.** Camille (CFO, governance) — lead; Mira (Compliance / RegTech engineer) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-CS3-006` (daily valuation methodology under FSCA CS 3/2018 §8 — hedge-instrument component), `ORG-AC-03` (IFRS hedge accounting — Accounting Policies register obligation), `ORG-MK-07` (hedge accounting policy — funding strategy hedge documentation).
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Purpose and Scope

This policy establishes the bank's approach to hedge accounting under IFRS 9 Chapter 6 (with IAS 39 as a transitional fallback for relationships designated before IFRS 9 hedge adoption). It defines which hedging relationships qualify for hedge accounting treatment, the documentation requirements, effectiveness-testing methodology, and disclosure obligations.

**In scope:**
- Fair value hedges: hedging exposure to changes in fair value of a recognised asset, liability, or firm commitment
- Cash flow hedges: hedging variability in cash flows of a recognised asset/liability, or highly probable forecast transaction
- Net investment hedges: hedging the bank's net investment in a foreign operation

**Out of scope:**
- Economic hedges that do not meet IFRS 9 Chapter 6 qualification criteria (these are recognised at fair value through profit or loss — "mark-to-market" treatment in the trading book)
- Internal hedges (intra-entity transactions are eliminated on consolidation; external hedging instrument must be used for hedge accounting)

---

## 2. Regulatory and Accounting Framework

| Instrument | Requirement |
|---|---|
| IFRS 9 Chapter 6 §§6.1–6.8 | Three hedge types; qualifying criteria; designation; documentation; effectiveness; discontinuation |
| IAS 39 §§71–102 | Legacy hedge accounting option for relationships designated pre-IFRS 9 adoption |
| IFRS 7 §§22–24 | Hedge accounting disclosures in financial statements |
| IAS 21 §§20–22 | Net investment hedges — functional currency treatment |

The bank adopts IFRS 9 hedge accounting (Chapter 6) from the first application of IFRS 9. The IAS 39 hedge accounting option is available only for existing relationships grandfathered through the transition.

---

## 3. Qualifying Criteria

A hedging relationship qualifies for hedge accounting under IFRS 9 §6.4.1 only if all of the following are met:

1. **Eligible hedge instrument:** a derivative (or, for FX risk only, a non-derivative financial asset or liability)
2. **Eligible hedged item:** a recognised asset or liability, an unrecognised firm commitment, a highly probable forecast transaction, or a net investment in a foreign operation
3. **Formal designation and documentation:** at the inception of the hedging relationship (see §4)
4. **Economic relationship:** the hedged item and hedging instrument share the same risk being hedged; no credit risk dominates the value change
5. **Hedge ratio:** the relationship uses the same hedge ratio as the economic hedge; no deliberate imbalancing to achieve accounting outcomes
6. **Ongoing rebalancing:** if the hedge ratio no longer reflects the risk management objective, the relationship is rebalanced per IFRS 9 §6.5.5

---

## 4. Designation and Documentation

At inception, a new hedge relationship must be documented. Documentation is prepared by Bea (Accounting & financial reporting engineer) and approved by Camille (CFO). Each designation document must include:

- Identification of the hedging instrument (ISDA trade reference; valuation source)
- Identification of the hedged item (asset/liability reference; notional; currency)
- Nature of the risk being hedged (interest rate risk, FX risk, credit spread risk)
- Hedge type (fair value, cash flow, or net investment)
- Hedge ratio and rationale
- How the bank will assess whether the hedging relationship meets the hedge-effectiveness requirements (qualitative method or quantitative method — see §5)

Documentation is stored in the BLAKE3 content-addressed document store (per `D-RMS-PHASE-1`, CEO-approved 2026-05-09).

---

## 5. Effectiveness Assessment

### 5.1 Qualitative Method

For simple hedging relationships (e.g. an interest rate swap hedging the interest-rate risk on a fixed-rate bond with matching terms), a qualitative critical-terms assessment is used:
- Notional amounts match
- Reference rates / indices match
- Maturities closely aligned
- No credit-risk concentration in the hedging instrument

If all critical terms match, the hedge is presumed highly effective without quantitative testing.

### 5.2 Quantitative Method — Dollar Offset / Regression

For complex relationships or where the qualitative method is not appropriate, the bank uses the dollar-offset method:
- Cumulative change in fair value of hedging instrument vs cumulative change in fair value of hedged item (attributable to hedged risk)
- Ratio must fall within 80%–125% (IAS 39 legacy) or demonstrate a high degree of offset (IFRS 9)
- Testing frequency: at each reporting date (monthly for management accounts; quarterly for formal test)

Rohan (Market risk engineer) runs the quantitative effectiveness model. Results are reviewed by Bea (Accounting engineer) before hedge accounting entries are posted.

### 5.3 Sources of Hedge Ineffectiveness

The bank identifies and recognises the following potential sources of ineffectiveness:
- Credit value adjustments (CVA) on the hedging derivative
- Basis risk (e.g. JIBAR vs prime rate)
- Timing mismatches in cash flows
- Changes in the fair value of the hedged item attributable to credit risk

Ineffectiveness is recognised immediately in profit or loss.

---

## 6. Hedge Accounting Entries

### 6.1 Fair Value Hedge

- **Hedging instrument:** recognised at fair value through profit or loss
- **Hedged item:** carrying amount adjusted for fair-value changes attributable to the hedged risk (basis adjustment); gain/loss in profit or loss
- **Net effect:** gain/loss on hedging instrument offsets gain/loss on hedged item in P&L

### 6.2 Cash Flow Hedge

- **Hedging instrument:** effective portion of gain/loss recognised in Other Comprehensive Income (OCI) — Cash Flow Hedge Reserve
- **Hedging instrument:** ineffective portion recognised in profit or loss
- **Reclassification:** when the hedged forecast transaction affects P&L, the related amount in OCI is reclassified to P&L (basis adjustment for non-financial items)

### 6.3 Net Investment Hedge

- Effective portion of gain/loss on hedging instrument recognised in OCI (Foreign Currency Translation Reserve)
- Ineffective portion in profit or loss
- On disposal of the foreign operation, cumulative OCI amount reclassified to P&L

---

## 7. Discontinuation

A hedging relationship is discontinued (prospectively) when:
- The hedging instrument expires, is sold, terminated, or exercised
- The hedge no longer meets the qualifying criteria (§3)
- The bank revokes the designation (voluntary discontinuation)

On discontinuation:
- **Fair value hedge:** any basis adjustment on the hedged item is amortised to P&L over the remaining term
- **Cash flow hedge:** the amount in OCI is retained until the forecast transaction affects P&L (or is recycled immediately if the forecast transaction is no longer expected)
- **Net investment hedge:** OCI retained until disposal of the foreign operation

---

## 8. Disclosures (IFRS 7 §§22–24)

The annual financial statements must disclose:
- Risk management strategy and how it relates to designated hedging relationships
- Description of each hedge type and its effect on future cash flows
- Effects of hedge accounting on financial position and performance
- Quantitative information about designated hedges: notional amounts; maturities; fair values of hedging instruments
- Amounts recognised in OCI and reclassified to P&L

Bea (Accounting engineer) prepares the IFRS 7 hedge accounting disclosures. Camille (CFO) reviews and approves before inclusion in the financial statements.

---

## 9. Governance

| Role | Accountability |
|---|---|
| Camille (CFO, governance) | Policy owner; hedge accounting programme governance; financial statement sign-off |
| Bea (Accounting & financial reporting engineer) | Technical implementation; documentation preparation; IFRS 7 disclosures |
| Rohan (Market risk engineer) | Quantitative effectiveness model; valuation inputs |
| Eitan (Treasurer, governance) | Hedging instrument identification; Treasury hedge strategy |
| Saskia (Head of Global Markets, governance) | Trading book hedge instruments — trading desk interface |
| Helena (Chief Risk Officer, governance) | Risk appetite for hedging programme; hedge-vs-trading book classification |

### 9.1 Review Cadence

- **Quarterly:** Bea reviews all active hedging relationships; effectiveness test results reviewed by Camille (CFO)
- **Annual:** Camille reviews and reaffirms the hedging strategy and this policy
- **Trigger:** new hedging instrument types; IFRS amendment; significant market disruption affecting hedge effectiveness

---

## 10. Relationship with Other Policies

| Policy | Interaction |
|---|---|
| Accounting Policies — IFRS (FIN-ACCT-01) | IFRS 9 classification and measurement; IFRS 7 disclosure framework |
| Market Risk Policy | Market-risk appetite; hedge ratio and effectiveness |
| Collateral Management Policy | CSA collateral for hedging derivatives; CVA impact |
| Trading Mandate (trading-mandate-v1.md) | Trading book vs banking book classification for hedging instruments |

---

## 11. Substrate Gaps

| Gap | Owner | Target |
|---|---|---|
| Hedge designation event type in event store | Bea (Accounting engineer) | Next accounting-substrate slice |
| IFRS 9 effectiveness-test engine | Rohan (Market risk engineer) | Pre-commencement gate |
| IFRS 7 disclosure automation | Bea (Accounting engineer) | Financial reporting substrate slice |

---

## 12. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1 | 2026-05-14 | Mira (Compliance / RegTech engineer) | Initial version — closes ORG-CS3-006, ORG-AC-03, ORG-MK-07 (hedge accounting component) |
