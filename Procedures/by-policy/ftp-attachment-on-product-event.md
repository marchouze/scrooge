---
policy-parent: funds-transfer-pricing-policy-v1
last-reviewed: 2026-06-11
procedureId: PROC-ALM-FTP-01
title: Funds transfer pricing rate attachment on product lifecycle events
author: Eitan (Treasurer, governance) · Anya (Platform & data engineer, engineering)
date: 2026-05-16
owner: Eitan (Treasurer, governance) · Anya (Platform & data engineer, engineering)
status: POPULATED
policy-cited: funds-transfer-pricing-policy-v1
system-capability: "@platform/ftp (LIVE — curve, attribution, projection) · prototype/runtime/agents/ravi-ftp-attribution.ts (LIVE — ravi:ftp-attribution, event-driven)"
---

# Procedure — Funds transfer pricing rate attachment on product lifecycle events

**Procedure ID:** PROC-ALM-FTP-01
**Owner:** Eitan (Treasurer) · Anya (platform & data engineer)
**Approval:** ALCO (FTP curve parameters and methodology); CFO (policy approval)
**Cadence:** Event-driven (fires on every qualifying product lifecycle event); monthly ALCO review of FTP curve calibration; annual methodology review
**Version:** v0.2 — 2026-06-11
**Status:** POPULATED

---

## 1. Source policy

- [`Policies/funds-transfer-pricing-policy-v1.md`](../../Policies/funds-transfer-pricing-policy-v1.md) — Funds Transfer Pricing Policy v1 (IN FORCE 2026-05-22, owner: Eitan (Treasurer, governance); Camille (Chief Financial Officer, governance) co-author) — specifically §5.1 (FTP event emission on product origination) and §2.2 (product-level FTP rate calculation).
- [`archive/owner-inbox/2026-05-06_risk-appetite-statement-and-framework.md`](../../archive/owner-inbox/2026-05-06_risk-appetite-statement-and-framework.md) §B — the RAS frames internal profit attribution as a risk-management control; FTP is the mechanism that enforces it (structured successor register: `prototype/platform/risk/ras-appetite-register.ts`).
- Basel III / BCBS guidance on internal funds transfer pricing for banks — informs curve construction and liquidity premium components (FTP Policy §2).

The obligation chain (Principle 2):

```
Regulation (Banks Act s.71 — fair value and internal pricing transparency;
            BCBS sound liquidity principles (2008) Principle 4; reg.26)
  → Policy: funds-transfer-pricing-policy-v1 (§2.2 rate calculation; §5.1 event emission)
    → PROC-ALM-FTP-01 (this procedure)
      → @platform/ftp (curve.ts + attribution.ts + projection.ts — LIVE)
      → FtpCurvePublished + FtpAttributionRecorded typed events
        (prototype/platform/event-store/event-types/ftp.ts — LIVE)
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

> **Implemented trigger surface (2026-06-11).** The table above carries the design-era event taxonomy. The live `ravi:ftp-attribution` handler (`prototype/runtime/agents/metadata/ravi.ts`) subscribes to `FtpCurvePublished`, `TradeBooked`, `LoanBooked`, `DepositReceived`, and `FundingDrawnDown`; amendment/maturity/cancellation re-attribution and hedge cross-referencing remain planned extensions of the live handler.

---

## 5. Steps

Steps are executed by the FTP attribution engine (`@platform/ftp`, invoked by the live event-driven `ravi:ftp-attribution` handler) unless a human-approval step is explicitly marked.

**Step 1 — Event ingestion (agent)**

The FTP attribution handler subscribes to the qualifying origination events (§4 implementation note). On receipt of a qualifying event, it extracts: product type, currency, tenor/maturity date, counterparty, notional, and trade date.

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

The agent retrieves the latest published FTP curve — the most recent `FtpCurvePublished` event for the product currency. The curve is published each business day at 05:45 UTC by the live `ravi:ftp-curve-publish` handler under PROC-ALM-FTC-01 (`ftp-curve-calibration.md`, owned by Ravi (Treasury/ALM engineer, engineering) · Eitan (Treasurer, governance)). The agent interpolates to the product's exact tenor using the matched-maturity linear interpolation in `platform/ftp/curve.ts`.

**Step 4 — Three-component rate assembly (agent)**

The FTP rate is assembled as:

```
FTP_rate = Base_rate + Liquidity_premium + Term_premium
```

- **Base_rate:** ZARONIA overnight index swap rate for the product tenor (sourced from SARB published rates or JSE data feed).
- **Liquidity_premium:** the bank-specific funding spread over ZARONIA, calibrated monthly by ALCO; reflects the marginal cost of raising term funding at the relevant tenor.
- **Term_premium:** additional basis for instruments beyond 2Y tenor, reflecting the incremental cost of locking in long-term funding.

All three components are reflected in the published curve's tenor rates; per-component decomposition in the attribution payload is a planned schema extension (§8) — the implemented payload carries the composite `ftpRate` plus the realised `spread`.

**Step 5 — FTP rate attachment and event emission (agent)**

The agent emits the implemented `FtpAttributionRecorded` event (`prototype/platform/event-store/event-types/ftp.ts`) to the event store with payload:

```json
{
  "eventType": "FtpAttributionRecorded",
  "attributionId": "<FTP-ATTR-xxx>",
  "transactionId": "<trade-or-loan-event-ref>",
  "transactionType": "loan | bond | swap | deposit | repo",
  "currency": "ZAR",
  "notional": "<number>",
  "tenor": "<matched curve tenor>",
  "clientRate": "<decimal>",
  "ftpRate": "<decimal>",
  "spread": "<clientRate - ftpRate>",
  "ftpCurveId": "<FtpCurvePublished ref>",
  "attributedAt": "<ISO-timestamp>"
}
```

The `transactionId` cross-references the originating booking event; `ftpCurveId` cross-references the `FtpCurvePublished` event used (full provenance, Principle 1).

**Step 6 — Amendment handling (agent)**

On receipt of a `ProductAmended` event, the agent calculates a revised FTP rate using the published curve on the amendment date. It emits a `FtpRateAmended` event (PLANNED — amendment re-attribution is not yet in the live handler's subscription set, §4 note) with the original rate, the new rate, the delta, and the amendment reason. The amended rate applies from the amendment date; historical periods retain the original FTP rate for P&L attribution purposes. Backdating beyond the amendment date requires Eitan (Treasurer) approval (§7 escalation path B).

**Step 7 — Internal P&L allocation update (agent)**

After FTP attachment, the agent triggers the internal P&L allocation engine to update the business-line P&L attribution entry for the trade. The desk-level P&L report is updated in real time. The ALCO dashboard is refreshed on the next scheduled tick (hourly).

**Step 8 — Reconciliation check (agent)**

At 17:00 SAST each business day, the FTP engine runs an end-of-day reconciliation: every trade in the position register must have exactly one active `FtpAttributionRecorded` event (the portfolio projection `buildFtpPortfolio` in `platform/ftp/projection.ts` is the reconciliation read). Trades missing an FTP attribution generate a `FtpAttachmentGap` exception (PLANNED exception event). The exception list is included in the daily ALCO operations report and escalated to Eitan (Treasurer) if not resolved within 2 hours of detection.

---

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Eitan (Treasurer) | Procedure owner; FTP curve calibration; exception escalation resolution; amendment approval |
| Anya (platform & data engineer) | FTP engine substrate build and maintenance; curve data pipeline; event schema ownership |
| Ravi (ALM quant engineer) | FTP curve model validation; liquidity-premium calibration model; ALCO reporting support |
| Camille (CFO, governance) | Funds Transfer Pricing Policy co-author (`funds-transfer-pricing-policy-v1`); business-line P&L attribution governance |
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
| `@platform/ftp` | ✓ LIVE | `attribution.ts` (`attributeTransaction` — matched-maturity rate attachment), `curve.ts` (FtpCurve interpolation), `projection.ts` (`buildFtpPortfolio` coverage read) |
| `ravi:ftp-attribution` handler | ✓ LIVE | Event-driven attribution on origination events; emits `FtpAttributionRecorded` |
| `ravi:ftp-curve-publish` handler + `@platform/alm/ftp-curve-publisher` | ✓ LIVE | Daily `FtpCurvePublished` curve (PROC-ALM-FTC-01 governs calibration); idempotent publication guard |
| `FtpCurvePublished` / `FtpAttributionRecorded` typed events | ✓ LIVE | `prototype/platform/event-store/event-types/ftp.ts` |
| Per-component attribution payload (`baseRate` / `liquidityPremium` / `termPremium` decomposition) | PLANNED | FTP Policy §5.1 component decomposition; implemented payload carries composite `ftpRate` + `spread` |
| `FtpRateAmended` / `FtpAttachmentGap` events + amendment re-attribution | PLANNED | Amendment handling (Step 6) and EOD gap exception (Step 8) |
| `@platform/alm/pl-attribution` | PLANNED | Internal P&L allocation engine; desk-level attribution update (Camille (Chief Financial Officer, governance) management-accounts integration) |

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
| `FtpAttributionRecorded` event (one per trade per attribution) | 7 years | Event store (immutable append-only log) |
| `FtpRateAmended` event (one per amendment — PLANNED) | 7 years | Event store |
| `FtpAttachmentGap` exception log (PLANNED) | 7 years | Event store |
| `FtpCurvePublished` event (daily) — full tenor grid | 7 years | Event store |
| ALCO monthly FTP calibration minutes | 7 years | Records Management Substrate (RMS) |
| FTP methodology policy (current and prior versions) | 7 years post-supersession | RMS document store (BLAKE3 content-addressed) |
| Business-line P&L attribution report (monthly) | 7 years | RMS |

All retention periods comply with Banks Act record-keeping requirements and SARS five-year minimum, with the longer period applied.

---

## 11. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-05-16 | Eitan (Treasurer, governance) · Anya (Platform & data engineer, engineering) | Initial population (design-era anchors). |
| v0.2 | 2026-06-11 | Ravi (Treasury/ALM engineer, engineering) | Anchor reconciliation under `brief:ravi:treasury-procedure-tail-3-missing-procedures-6-a:2026-06-11` (W1.3): policy-parent `FTP Methodology (planned)` → in-force `funds-transfer-pricing-policy-v1`; design-era `@platform/alm/ftp-engine (PLANNED)` → live `@platform/ftp` + `ravi:ftp-attribution`/`ravi:ftp-curve-publish` handlers; design-era `FTPRateAttached` → implemented `FtpAttributionRecorded` (payload per `event-types/ftp.ts`); curve-calibration sub-process now PROC-ALM-FTC-01; remaining design-era items explicitly marked PLANNED. No substance change. |
