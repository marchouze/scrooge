---
policy-parent: hedge-accounting-policy-v1
last-reviewed: 2026-06-11
procedureId: PROC-ALM-HDT-01
title: IFRS 9 hedge designation and effectiveness test
author: Eitan (Treasurer, governance) · Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-16
owner: Eitan (Treasurer, governance) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
policy-cited: hedge-accounting-policy-v1
system-capability: "@platform/alm/hedge-accounting-engine (PLANNED — gated on first hedge designation, post-licence per Team/Ravi.md §16)"
---

# Procedure — IFRS 9 hedge designation and effectiveness test

**Procedure ID:** PROC-ALM-HDT-01
**Owner:** Eitan (Treasurer) · Bea (financial-reporting engineer)
**Approval:** ALCO (hedge strategy); CFO (Hedge Accounting Policy); external auditor (hedge documentation review at period-end)
**Cadence:** Per-designation (prospective test at inception); daily (ongoing effectiveness monitoring); period-end (retrospective effectiveness assessment and de-designation review); annual (methodology review)
**Version:** v0.2 — 2026-06-11
**Status:** POPULATED

---

## 1. Source policy

- [`Policies/hedge-accounting-policy-v1.md`](../../Policies/hedge-accounting-policy-v1.md) — Hedge Accounting Policy (IN FORCE; owner: Camille (Chief Financial Officer, governance); Eitan (Treasurer, governance) consumer on the designation/effectiveness side per `Team/Ravi.md` §15 — Ravi (Treasury/ALM engineer, engineering) owns designation + effectiveness, Bea (Accounting & financial reporting engineer, engineering) owns posting).
- IFRS 9 Financial Instruments (as adopted in South Africa via IFRS for South Africa, effective 1 January 2018) — Chapter 6 (Hedge Accounting).
- [`archive/owner-inbox/2026-05-06_risk-appetite-statement-and-framework.md`](../../archive/owner-inbox/2026-05-06_risk-appetite-statement-and-framework.md) §B3 — interest-rate risk appetite; the RAS frames the hedge programme as the primary control for IRRBB within appetite (structured successor register: `prototype/platform/risk/ras-appetite-register.ts`, line `appetite:irrbb:delta-eve-outlier`).

The obligation chain (Principle 2):

```
Regulation (Banks Act s.71 — fair value and IFRS adoption requirement; Reg 26/27 IRRBB)
  → Policy: hedge-accounting-policy-v1 (IN FORCE)
    → PROC-ALM-HDT-01 (this procedure)
      → @platform/alm/hedge-accounting-engine (PLANNED — gated on first hedge
        designation; today only HedgeIneffective is registered, in
        prototype/platform/event-store/event-types/markets-trading-extended.ts)
      → @platform/events/hedge-designated (PLANNED)
```

The bank uses IFRS 9 hedge accounting to reduce P&L volatility arising from fair-value changes on its fixed-rate bond portfolio and OTC IRD positions. Without qualifying hedge accounting, MTM movements on the hedging instrument (e.g. a receive-fixed IRS) flow directly to P&L while the hedged item (e.g. a fixed-rate bond held at amortised cost) does not — creating an accounting mismatch. IFRS 9 hedge accounting aligns the timing of gain/loss recognition when the economic relationship qualifies.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| IFRS 9 §6.1.1–6.1.3 | Hedge accounting objectives; three types: fair value, cash flow, net investment |
| IFRS 9 §6.4.1 | Qualifying criteria: formal designation and documentation; economic relationship; credit risk not dominant; hedge ratio designation |
| IFRS 9 §6.5.11–6.5.15 | Ongoing effectiveness requirements; rebalancing; de-designation |
| IFRS 9 §6.5.2 | Fair value hedge: adjustments to carrying amount of hedged item |
| IFRS 9 §6.5.4 | Cash-flow hedge: OCI reclassification mechanics |
| Banks Act 94 of 1990 s.71 | Fair value accounting; IFRS adoption |
| Regulations Relating to Banks Reg 39 (IRRBB) | IRRBB measurement; hedge effectiveness as a risk-mitigation control |
| PA Guidance Note 7/2022 (IRRBB) | Alignment of internal IRRBB measurement with hedge programme |
| IFRS 7 §22–24 | Hedge accounting disclosures (nature and extent; effect on financial statements) |

---

## 3. Purpose

This procedure governs the full lifecycle of a hedge accounting relationship under IFRS 9:

1. **Designation** — formally electing hedge accounting for a specific hedging instrument / hedged item pair at inception.
2. **Prospective effectiveness test** — demonstrating at designation that the hedging relationship is expected to be highly effective.
3. **Ongoing retrospective effectiveness testing** — assessing at each reporting date and continuously that the economic relationship persists.
4. **Rebalancing** — adjusting the hedge ratio to restore effectiveness without de-designating.
5. **De-designation** — formally terminating the hedge relationship when criteria are no longer met.
6. **Documentation** — maintaining the contemporaneous hedge documentation required by IFRS 9 §6.4.1(b).

Without this procedure, the bank cannot apply IFRS 9 hedge accounting and must recognise all MTM volatility on hedging instruments in P&L.

---

## 4. Trigger

This procedure is triggered by any of the following events:

| Trigger | Action |
|---|---|
| ALCO approves a new hedging strategy (e.g. hedge a proportion of the fixed-rate bond portfolio with receive-fixed IRS) | Designation — Steps 1–6 |
| Daily effectiveness monitoring detects effectiveness ratio outside 80–125% corridor | Rebalancing assessment — Steps 7–8 |
| Period-end (month-end, quarter-end, year-end) | Retrospective effectiveness test and documentation — Steps 7–9 |
| Hedging instrument matured, terminated, or novated | De-designation — Steps 10–11 |
| Hedged item is derecognised or modified | De-designation — Steps 10–11 |
| ALCO instructs voluntary de-designation | De-designation — Steps 10–11 |

---

## 5. Steps

Default actor is the hedge accounting engine agent (`@platform/alm/hedge-accounting-engine`) unless a human-approval step is explicitly marked.

### Designation (Steps 1–6)

**Step 1 — Hedge relationship specification (Eitan, human)**

Eitan (Treasurer) defines the hedge relationship in writing before or at the date of designation:

- **Hedge type:** fair value hedge or cash-flow hedge.
- **Hedged item:** the specific bond ISIN(s) or a proportion of the bond portfolio; or the specific OTC IRD position; or a forecast transaction (cash-flow hedge only).
- **Risk being hedged:** benchmark interest-rate risk (ZARONIA-equivalent or prime-rate linked); for OTC IRD: interest-rate risk in the hedging instrument.
- **Hedging instrument:** the specific OTC IRS (or bond futures position) identified by trade-ID, with the portion of the notional being designated.
- **Hedge ratio:** the ratio of the notional of the hedging instrument to the notional of the hedged item; must reflect the actual quantities used.
- **Effectiveness assessment method:** regression analysis or dollar-offset method (see Step 3).

This specification is submitted to the hedge accounting engine as a `HedgeDesignationRequest` event.

**Step 2 — Eligibility check (agent)**

The hedge accounting engine verifies:

1. Hedging instrument is an eligible instrument under IFRS 9 §6.2 (derivatives or, for fair value hedges only, non-derivative financial instruments).
2. Hedged item is an eligible item under IFRS 9 §6.3 (recognised asset/liability; firm commitment; forecast transaction for cash-flow hedge).
3. The designated portion is clearly identifiable and measurable.
4. The hedging instrument is not a written option designated as hedging instrument for a net position (prohibited).

If any check fails, the engine raises a `HedgeEligibilityFailed` event and escalates to Eitan (Treasurer) and Bea (financial-reporting engineer) for resolution.

**Step 3 — Prospective effectiveness test (agent)**

The agent runs a prospective effectiveness test using regression analysis over the most recent 24 months of relevant market data (or, if fewer than 24 months are available, all available history with a documented basis for use):

1. Regress changes in fair value (or cash flows) of the hedging instrument on changes in fair value (or cash flows) of the hedged item, for the designated risk only.
2. The relationship passes prospective effectiveness if:
   - R² ≥ 0.80 (regression fit); and
   - The slope coefficient is between –0.80 and –1.25 (economic relationship; opposite-direction movements); and
   - Credit risk (own credit spread or counterparty credit spread) is not the dominant source of fair value change.
3. If the regression method is inapplicable (e.g. insufficient history for a new product), the agent falls back to a qualitative critical-terms-match assessment: if the hedged item and hedging instrument have the same notional, currency, maturity, and rate basis, effectiveness is presumed.

**Step 4 — Hedge ratio determination (agent)**

The agent confirms the hedge ratio as the ratio of the notional of the hedging instrument to the notional of the hedged item. If the hedge ratio is not 1:1, the agent documents the reason (e.g. partial hedge of a bond portfolio; basis mismatch requiring a ratio different from 1:1 to optimise effectiveness).

**Step 5 — Formal documentation (Bea, human — final sign-off)**

Bea (financial-reporting engineer) generates and countersigns the IFRS 9 hedge designation documentation package:

- Hedge designation form (hedge type; hedged item; hedging instrument; risk component; hedge ratio; effectiveness method).
- Prospective effectiveness test results from Step 3.
- Risk management objective and strategy narrative (must reflect the ALCO-approved hedge strategy).
- Reference to source trade IDs and event IDs.

The documentation package is submitted to the RMS document store (BLAKE3 content-addressed). A `HedgeDesignated` event is emitted to the event store with the document hash. **Hedge accounting may only commence from the date on which all documentation is complete and the `HedgeDesignated` event is emitted — it may not be backdated.**

**Step 6 — Position register update (agent)**

The hedge accounting engine updates the hedge register:

- Adds the new hedge relationship with status `Active`.
- Links the hedging instrument trade-ID and hedged item identifier.
- Sets the designation date, effectiveness method, and hedge ratio.
- Notifies the FTP engine to cross-reference (per PROC-ALM-FTP-01) for internal benchmark rate documentation.

---

### Ongoing effectiveness testing (Steps 7–9)

**Step 7 — Daily effectiveness monitoring (agent)**

Each business day at 17:30 SAST, the hedge accounting engine:

1. Retrieves the fair-value change of the hedging instrument for the day (from the OTC mark-to-market feed; per PROC-MK-ODP-03 for IRS positions).
2. Retrieves the fair-value change of the hedged item for the designated risk component (from the bond pricing feed; isolating the benchmark rate component via duration × rate-change attribution).
3. Computes the dollar-offset ratio: Δ(hedging instrument) / Δ(hedged item).
4. If the ratio is within the 80–125% corridor, no action required.
5. If the ratio breaches the corridor, a `HedgeEffectivenessBreached` event is emitted and Eitan (Treasurer) is notified within 30 minutes (§7).

**Step 8 — Rebalancing assessment (Eitan, human — if Step 7 triggers)**

On receipt of a `HedgeEffectivenessBreached` event, Eitan (Treasurer):

1. Determines whether the breach is due to a systematic drift in the hedge ratio (requiring rebalancing) or a temporary basis movement (which may resolve without action).
2. If rebalancing is required: adjusts the notional of the hedging instrument designated in the relationship (partial termination or additional designation) to restore the hedge ratio. The hedge relationship is not de-designated — IFRS 9 permits rebalancing without de-designation.
3. Emits a `HedgeRebalanced` event with the old ratio, new ratio, and effective date.
4. Updated documentation is filed per Step 5 (Bea (financial-reporting engineer) countersigns within 1 business day).

**Step 9 — Period-end retrospective effectiveness assessment (agent + Bea, human)**

At each period-end (month-end as a minimum; quarter-end and year-end for external reporting):

1. The hedge accounting engine runs a full retrospective effectiveness test using the regression method (same as Step 3) over the period of the hedge relationship.
2. The R² and slope coefficient are documented.
3. If the IFRS 9 economic relationship test is met (economic offset; credit risk not dominant; hedge ratio still appropriate), the hedge relationship continues.
4. Bea (financial-reporting engineer) reviews the output and signs off the period-end effectiveness assessment in the RMS. A `HedgeEffectivenessConfirmed` event is emitted.
5. If the retrospective test reveals the economic relationship no longer exists, de-designation is mandatory (Step 10).

---

### De-designation (Steps 10–11)

**Step 10 — De-designation trigger and documentation (Eitan + Bea, human)**

De-designation is mandatory when:

- The hedging instrument expires, is sold, terminated, or exercised.
- The hedged item is derecognised or the designated component is no longer separately identifiable.
- The hedge no longer meets the qualifying criteria (economic relationship failed per Step 9; or credit risk has become dominant).
- ALCO instructs voluntary de-designation (documented in ALCO minutes).

Eitan (Treasurer) and Bea (financial-reporting engineer) complete a de-designation form specifying the de-designation date and reason. A `HedgeDessignated` (de-designated) event is emitted.

**Step 11 — Accounting treatment on de-designation (Bea, human)**

Bea (financial-reporting engineer) applies the correct accounting treatment:

- **Fair value hedge de-designation:** the cumulative fair-value adjustment to the carrying amount of the hedged item is amortised to P&L using the effective interest rate from the de-designation date.
- **Cash-flow hedge de-designation (if the hedged forecast transaction is still expected to occur):** the cumulative OCI balance remains in OCI and is reclassified to P&L when the forecast transaction affects P&L.
- **Cash-flow hedge de-designation (if the hedged forecast transaction is no longer expected to occur):** the cumulative OCI balance is reclassified to P&L immediately.

Bea (financial-reporting engineer) posts the required journal entries and updates the hedge register (status set to `Closed`). The journal entries are filed in the RMS.

---

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Eitan (Treasurer) | Hedge relationship design; hedge ratio determination; rebalancing decisions; de-designation sign-off |
| Bea (financial-reporting engineer) | IFRS 9 documentation sign-off; period-end effectiveness assessment review; accounting treatment on de-designation; auditor liaison |
| Ravi (ALM quant engineer) | Regression model for effectiveness testing; fair-value attribution of the benchmark rate component |
| Camille (CFO, governance) | Hedge Accounting Policy approval; auditor liaison at year-end |
| Helena (Chief Risk Officer, governance) | Oversight of IRRBB hedge programme; RAS alignment |
| ALCO | Approve hedge strategies; review monthly effectiveness summary |
| External auditor | Review hedge documentation at year-end; sign off accounting treatment |

---

## 7. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| **HedgeEligibilityFailed:** designated relationship does not meet IFRS 9 criteria | Eitan (Treasurer) and Bea (financial-reporting engineer) assess; ALCO informed; hedge is not designated until criteria are met | Resolution within 2 business days; ALCO at next scheduled meeting |
| **HedgeEffectivenessBreached (daily monitoring)** | Eitan (Treasurer) notified within 30 minutes; rebalancing decision within 1 business day; if rebalancing not feasible, mandatory de-designation | 1 business day for rebalancing decision |
| **Retrospective test failure at period-end** | Mandatory de-designation; Camille (CFO, governance) notified; disclosure implications assessed by Bea (financial-reporting engineer); Helena (Chief Risk Officer, governance) notified for RAS reporting | De-designation effective as of period-end date; disclosure prepared within 5 business days |
| **Documentation not complete before hedge start date attempted** | Agent blocks hedge accounting flag on the position; Bea (financial-reporting engineer) escalates to Camille (CFO, governance) | No backdating permitted; hedge accounting only from documentation-complete date |

---

## 8. System capabilities

| Capability | Status | Description |
|---|---|---|
| `@platform/alm/hedge-accounting-engine` | PLANNED | Designation, effectiveness testing, rebalancing, de-designation agent; hedge register |
| `@platform/events/hedge-designated` | PLANNED | Typed event schema: `HedgeDesignated`, `HedgeRebalanced`, `HedgeEffectivenessBreached`, `HedgeEffectivenessConfirmed`, `HedgeDessignated` |
| `@platform/alm/hedge-register` | PLANNED | Active and closed hedge relationships; hedge-ratio history; documentation cross-references |
| `@platform/alm/ftp-engine` | PLANNED | Cross-referenced for internal benchmark rate (per PROC-ALM-FTP-01) |
| `@platform/risk/bond-pricer` | PLANNED | Fair-value attribution of benchmark rate component for hedged items |
| `@risk/otc-mtm` | PLANNED | Mark-to-market of OTC IRD hedging instruments (per PROC-MK-ODP-03) |
| `@platform/rms/document-store` | PLANNED | BLAKE3 content-addressed storage of hedge designation documentation packages |

---

## 9. Quality controls

| Control | Frequency | Owner |
|---|---|---|
| Prospective effectiveness test documented before designation date | Per designation | Bea (financial-reporting engineer) |
| Daily dollar-offset ratio within 80–125% corridor | Daily | Hedge accounting engine agent |
| Period-end retrospective effectiveness test completed and signed off | Monthly / quarterly / annually | Bea (financial-reporting engineer) |
| Hedge register completeness — every designated relationship has current documentation | Monthly | Bea (financial-reporting engineer) |
| ALCO review of hedge effectiveness summary | Monthly | Eitan (Treasurer) |
| IFRS 7 disclosure adequacy review | Quarterly (for quarterly reporting) / annually (for annual financial statements) | Camille (CFO, governance) · Bea (financial-reporting engineer) |
| Independent model validation of regression effectiveness test | Annual | Rohan (market risk quant engineer) |

---

## 10. Evidence / audit trail

| Artefact | Retention | Location |
|---|---|---|
| Hedge designation documentation package (per relationship) | 7 years post de-designation | RMS document store (BLAKE3 hash in `HedgeDesignated` event) |
| `HedgeDesignated` event | 7 years | Event store (immutable) |
| `HedgeEffectivenessBreached` event | 7 years | Event store |
| `HedgeEffectivenessConfirmed` event (period-end) | 7 years | Event store |
| `HedgeRebalanced` event | 7 years | Event store |
| `HedgeDessignated` event | 7 years | Event store |
| Daily dollar-offset ratio log | 7 years | `@platform/alm/hedge-register` |
| Period-end retrospective test workpapers (regression output) | 7 years | RMS document store |
| ALCO hedge strategy approval minutes | 7 years | RMS |
| Journal entries on de-designation | 7 years | RMS (per PROC-FIN-MC-01 audit trail) |

All retention periods align with Banks Act requirements and SARS five-year minimum, with the longer period applied.

---

## 11. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-05-16 | Eitan (Treasurer, governance) · Bea (Accounting & financial reporting engineer, engineering) | Initial population (design-era anchors). |
| v0.2 | 2026-06-11 | Ravi (Treasury/ALM engineer, engineering) | Anchor reconciliation under `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11` (W1.3): policy-parent `Hedge Accounting Policy (planned)` → in-force `hedge-accounting-policy-v1`; archived RAS path re-anchored to `archive/owner-inbox/` + structured RAS register; hedge-accounting engine stays PLANNED (true state — gated on first hedge designation, W3.1; only `HedgeIneffective` is registered today). No substance change. |
