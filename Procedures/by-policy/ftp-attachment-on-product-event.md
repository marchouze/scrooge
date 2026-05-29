---
policy-parent: FTP Methodology (planned)
last-reviewed: 2026-05-16
procedureId: PROC-ALM-FTP-01
title: Funds transfer pricing rate attachment on product lifecycle events
author: Eitan (Treasurer) · Anya (platform & data engineer)
date: 2026-05-16
owner: Eitan (Treasurer) · Anya (platform & data engineer)
status: POPULATED
policy-cited: FTP Methodology (planned)
system-capability: "@platform/alm/ftp-engine (PLANNED)"
---

# Procedure — Funds transfer pricing rate attachment on product lifecycle events

**Procedure ID:** PROC-ALM-FTP-01
**Owner:** Eitan (Treasurer) · Anya (platform & data engineer)
**Approval:** ALCO (FTP curve parameters and methodology); CFO (policy approval)
**Cadence:** Event-driven (fires on every qualifying product lifecycle event); monthly ALCO review of FTP curve calibration; annual methodology review
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

---

## 1. Source policy

- FTP Methodology Policy (planned; to be authored by Eitan with Camille (CFO, governance) approval; required before commencement-of-trading).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B — the RAS frames internal profit attribution as a risk-management control; FTP is the mechanism that enforces it.
- Basel III / BCBS guidance on internal funds transfer pricing for banks (2016) — informs curve construction and liquidity premium components.

The obligation chain:

```
Regulation (Banks Act s.71 — fair value and internal pricing transparency)
  → FTP Methodology Policy (PLANNED)
    → PROC-ALM-FTP-01 (this procedure)
      → @platform/alm/ftp-engine (PLANNED)
      → @platform/events/ftp-rate-attached (PLANNED)
```

FTP is the mechanism by which treasury charges the cost of funding (and credits the benefit of deposits) to individual business lines at the point of product inception. Without an FTP rate attached at origination, internal profit attribution is meaningless — a new bond trade or OTC IRD must carry an FTP rate from trade date, not retrospectively.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94 of 1990 s.71 | Fair value accounting and internal valuation discipline |
| PA Directive 3/2023 (ILAAP) | Internal liquidity allocation must be reflected in product pricing via a liquidity transfer price |
| BCBS 2016 — Supervisory guidance on FTP | Three-component FTP: base rate + liquidity premium + term premium; documented methodology; ALCO oversight |
| IFRS 9 (as adopted in SA) | FTP rates feed hedge-item fair value attribution and internal benchmark rate documentation |
| Regulations Relating to Banks Reg 39 | Liquidity risk — ALCO must oversee the internal pricing of liquidity risk |

---

## 3. Purpose

This procedure ensures that every new financial product originated by the bank — and every structural change to an existing product — receives an FTP rate at inception. The FTP rate is the internal price of funding: it represents the transfer of interest-rate risk and liquidity risk from the business line to treasury. It enables:

1. Accurate business-line P&L attribution (each desk sees the true cost of the funding it consumes or the benefit of the deposits it generates).
2. ALM risk isolation in treasury (treasury takes on the net interest-rate and liquidity risk and hedges it).
3. Regulatory capital allocation alignment (FTP feeds the internal RAROC computation).
4. Hedge accounting documentation (the FTP rate provides the internal benchmark for identifying the component of risk being hedged under IFRS 9).

---

## 4. Trigger

This procedure fires on receipt of any of the following product lifecycle events from the event store:

| Event type | Description |
|---|---|
| `TradeExecuted` (bond) | New JSE bond purchase or sale; attaches FTP rate to the new position |
| `TradeExecuted` (OTC IRD) | New interest-rate swap, FRA, or cap/floor; attaches FTP rate at inception |
| `ProductAmended` | Structural amendment (e.g. notional change, maturity extension, currency change) — re-attaches FTP |
| `ProductMatured` | Confirms FTP detachment; no new rate required |
| `ProductCancelled` | Confirms FTP detachment and releases internal allocation |
| `HedgeDesignated` | New hedge relationship — FTP rate is cross-referenced for hedge documentation |

The procedure does **not** fire on mark-to-market updates or accrual events — those do not change the FTP basis.

---

## 5. Steps

Steps are executed by the FTP engine agent (`@platform/alm/ftp-engine`) unless a human-approval step is explicitly marked.

**Step 1 — Event ingestion (agent)**

The FTP engine subscribes to the event store topic `product.lifecycle.*`. On receipt of a qualifying event (§4), it extracts: product type, currency, tenor/maturity date, counterparty, notional, and trade date.

**Step 2 — Product classification (agent)**

The agent maps the product to an FTP curve segment using the following classification tree:

| Product type | FTP curve | Tenor bucket |
|---|---|---|
| JSE bond (fixed rate) | ZARONIA term curve + JSE bond liquidity premium | Matched to residual maturity |
| JSE bond (floating rate, JIBAR-linked) | JIBAR reset curve + spread | Reset period |
| OTC IRS (receive-fixed) | ZARONIA swap curve | Matched to swap maturity |
| OTC IRS (pay-fixed) | ZARONIA swap curve (negative — bank is a net payer) | Matched to swap maturity |
| FRA | Short-end ZARONIA curve | FRA settlement date |
| OTC cap/floor | ZARONIA vol-adjusted curve | Cap/floor expiry |

If the product type is not in the classification tree, the agent raises a `FTPClassificationGap` event and escalates to Eitan (Treasurer) within 30 minutes (§7).

**Step 3 — FTP rate retrieval (agent)**

The agent retrieves the current FTP curve snapshot from `@platform/alm/ftp-curve-store`. The curve snapshot is published each business day at 07:30 SAST by the FTP curve calibration sub-process (owned by Eitan (Treasurer) · Ravi (ALM quant engineer)). The agent interpolates to the product's exact tenor using log-linear interpolation on zero rates.

**Step 4 — Three-component rate assembly (agent)**

The FTP rate is assembled as:

```
FTP_rate = Base_rate + Liquidity_premium + Term_premium
```

- **Base_rate:** ZARONIA overnight index swap rate for the product tenor (sourced from SARB published rates or JSE data feed).
- **Liquidity_premium:** the bank-specific funding spread over ZARONIA, calibrated monthly by ALCO; reflects the marginal cost of raising term funding at the relevant tenor.
- **Term_premium:** additional basis for instruments beyond 2Y tenor, reflecting the incremental cost of locking in long-term funding.

All three components are recorded separately in the `FTPRateAttached` event payload (§10) to enable ex-post decomposition.

**Step 5 — FTP rate attachment and event emission (agent)**

The agent emits a `FTPRateAttached` event to the event store with payload:

```json
{
  "eventType": "FTPRateAttached",
  "tradeId": "<trade-id>",
  "productType": "<classification>",
  "currency": "ZAR",
  "tenor": "<years>",
  "tradeDate": "<ISO-date>",
  "ftpRate": "<decimal>",
  "components": {
    "baseRate": "<decimal>",
    "liquidityPremium": "<decimal>",
    "termPremium": "<decimal>"
  },
  "curveSnapshotId": "<snapshot-id>",
  "attachedAt": "<ISO-timestamp>",
  "attachedBy": "ftp-engine-agent"
}
```

The `tradeId` cross-references the originating `TradeExecuted` or `ProductAmended` event.

**Step 6 — Amendment handling (agent)**

On receipt of a `ProductAmended` event, the agent calculates a revised FTP rate using the curve snapshot on the amendment date. It emits a `FTPRateAmended` event with the original rate, the new rate, the delta, and the amendment reason. The amended rate applies from the amendment date; historical periods retain the original FTP rate for P&L attribution purposes. Backdating beyond the amendment date requires Eitan (Treasurer) approval (§7 escalation path B).

**Step 7 — Internal P&L allocation update (agent)**

After FTP attachment, the agent triggers the internal P&L allocation engine to update the business-line P&L attribution entry for the trade. The desk-level P&L report is updated in real time. The ALCO dashboard is refreshed on the next scheduled tick (hourly).

**Step 8 — Reconciliation check (agent)**

At 17:00 SAST each business day, the FTP engine runs an end-of-day reconciliation: every trade in the position register must have exactly one active `FTPRateAttached` event. Trades missing an FTP rate generate a `FTPAttachmentGap` exception. The exception list is included in the daily ALCO operations report and escalated to Eitan (Treasurer) if not resolved within 2 hours of detection.

---

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Eitan (Treasurer) | Procedure owner; FTP curve calibration; exception escalation resolution; amendment approval |
| Anya (platform & data engineer) | FTP engine substrate build and maintenance; curve data pipeline; event schema ownership |
| Ravi (ALM quant engineer) | FTP curve model validation; liquidity-premium calibration model; ALCO reporting support |
| Camille (CFO, governance) | FTP Methodology Policy approval; business-line P&L attribution governance |
| Helena (Chief Risk Officer, governance) | RAS oversight; FTP as a risk-management control |
| ALCO | Monthly curve parameter approval; methodology exceptions |

---

## 7. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| **Path A — FTPClassificationGap:** product type not in classification tree | Agent raises exception; Eitan (Treasurer) manually classifies and configures curve mapping; Atlas (platform engineer, engineering) updates classification tree in next sprint | Within 30 minutes of event receipt; trade held in a suspense bucket until resolved |
| **Path B — Backdating request:** FTP amendment requested for a date before the amendment date | Eitan (Treasurer) approves; Camille (CFO, governance) notified if the delta exceeds ZAR 100,000 in P&L attribution impact | Approval within 1 business day; CFO notification same day |
| **Path C — FTPAttachmentGap not resolved by 19:00 SAST** | Eitan (Treasurer) escalates to Camille (CFO, governance); gap included in monthly ALCO pack | Next business day ALCO report |
| **Path D — Curve snapshot unavailable** | Agent uses prior-day curve with a 5 bp loading; Eitan (Treasurer) notified immediately; curve refresh attempted within 1 hour | Immediate notification; resolution before 09:00 SAST |

---

## 8. System capabilities

| Capability | Status | Description |
|---|---|---|
| `@platform/alm/ftp-engine` | PLANNED | Event-driven FTP rate attachment agent; classification tree; rate assembly; `FTPRateAttached` event emission |
| `@platform/alm/ftp-curve-store` | PLANNED | Daily FTP curve snapshots (ZARONIA term curve, liquidity premium, term premium); curve-id versioning |
| `@platform/events/ftp-rate-attached` | PLANNED | Typed event schema for `FTPRateAttached` and `FTPRateAmended` |
| `@platform/alm/pl-attribution` | PLANNED | Internal P&L allocation engine; desk-level attribution update |
| `@platform/alm/ftp-reconciliation` | PLANNED | EOD FTP coverage check; gap detection; ALCO report feed |

---

## 9. Quality controls

| Control | Frequency | Owner |
|---|---|---|
| FTP curve snapshot completeness — all tenor buckets populated | Daily at 07:30 SAST | Anya (platform & data engineer) |
| FTP coverage reconciliation — every trade has exactly one active FTP rate | Daily at 17:00 SAST | FTP engine agent |
| ALCO curve calibration review — liquidity premium and term premium | Monthly | Eitan (Treasurer) · Ravi (ALM quant engineer) |
| Independent model validation of FTP curve methodology | Annual | Rohan (market risk quant engineer) (independent of Ravi) |
| FTP methodology policy review | Annual | Camille (CFO, governance) · Eitan (Treasurer) |
| Business-line P&L attribution reconciliation to FTP register | Monthly (at period-close, per PROC-FIN-MC-01) | Bea (financial-reporting engineer) |

---

## 10. Evidence / audit trail

| Artefact | Retention | Location |
|---|---|---|
| `FTPRateAttached` event (one per trade per attachment) | 7 years | Event store (immutable append-only log) |
| `FTPRateAmended` event (one per amendment) | 7 years | Event store |
| `FTPAttachmentGap` exception log | 7 years | Event store |
| FTP curve snapshot (daily) — all tenors, all three components | 7 years | `@platform/alm/ftp-curve-store` |
| ALCO monthly FTP calibration minutes | 7 years | Records Management Substrate (RMS) |
| FTP methodology policy (current and prior versions) | 7 years post-supersession | RMS document store (BLAKE3 content-addressed) |
| Business-line P&L attribution report (monthly) | 7 years | RMS |

All retention periods comply with Banks Act record-keeping requirements and SARS five-year minimum, with the longer period applied.
