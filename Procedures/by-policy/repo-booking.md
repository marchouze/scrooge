---
policy-parent: >
last-reviewed: 2026-05-22
procedureId: PROC-MK-REPO-01
title: Repo and reverse-repo booking — end-to-end lifecycle
author: Saskia (Head of Global Markets, governance) · Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-22
owner: Saskia (Head of Global Markets, governance) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
policy-cited: >
  securities-financing-policy-v1.md;
  collateral-management-policy-v1.md;
  trading-mandate-v1.md
system-capability: >
  @platform/markets/repo-oms (PLANNED);
  @platform/markets/strate-settlement-gateway (PLANNED);
  @platform/markets/collateral-valuation (PLANNED);
  @platform/markets/margin-call-engine (PLANNED);
  @platform/event-store (Live)
---

# Procedure — Repo and reverse-repo booking

**Procedure ID:** PROC-MK-REPO-01
**Owner:** Saskia (Head of Global Markets, governance) · Bea (Accounting & financial reporting engineer, engineering)
**Approval:** BRC (Markets) + ALCO (liquidity use-cases)
**Cadence:** Continuous — event-triggered on each repo trade
**Version:** v1.0 — 2026-05-22
**Status:** POPULATED

---

## 1. Source policy

- **Securities Financing Policy v1** (`Policies/securities-financing-policy-v1.md`) — sets the permissible instruments for repo activity, eligibility criteria for collateral, maximum tenor, concentration limits, and mandatory GMRA documentation requirement.
- **Collateral Management Policy v1** (`Policies/collateral-management-policy-v1.md`) — governs daily MTM of collateral, initial margin and variation-margin mechanics, haircut schedules, and the daily call-issuance deadline.
- **Trading Mandate v1** (`Policies/trading-mandate-v1.md`) — grants Saskia (Head of Global Markets, governance) authority to trade classic repos and reverse repos within the notional and tenor limits specified in Schedule A; any exceedance is a mandate breach requiring Helena (Chief Risk Officer, governance) sign-off before execution.

The obligation chain:

```
Regulation (JSE Debt Market Rules; SARB Guidance Note on repo participation;
            Banks Act Reg 23; FMA s.35–36; GMRA 2011)
  → Securities Financing Policy v1
  → Collateral Management Policy v1
  → Trading Mandate v1
    → PROC-MK-REPO-01 (this procedure)
      → @platform/markets/repo-oms (PLANNED)
      → @platform/markets/strate-settlement-gateway (PLANNED)
      → @platform/markets/collateral-valuation (PLANNED)
      → Typed event log → repo book positions + P&L
```

---

## 2. Source regulations

| Citation | Instrument | Requirement |
|---|---|---|
| JSE Debt Market Rules — Repo Chapter | JSE Ltd | Member banks transacting repo on JSE-admitted debt securities must comply with JSE repo rules on eligible collateral, minimum haircuts, and trade reporting. |
| SARB Guidance Note on repo participation | SARB | Sets minimum operational and documentation standards for repo participants; requires GMRA or equivalent master agreement; mandates tri-party or bilateral settlement via STRATE. |
| Banks Act Reg 23 | Reserve Bank Act / Banks Act 94 of 1990 — Regulations | Repo liabilities constitute funding instruments; balance-sheet treatment and liquidity-coverage-ratio reporting obligations apply; HQLA eligibility of collateral is assessed under Reg 23 LCR schedule. |
| FMA s.35–36 | Financial Markets Act 19 of 2012 | Securities financing transactions must be reported to the STRATE trade repository; counterparty LEI and trade economics mandatory. |
| GMRA 2011 | Global Master Repurchase Agreement (ICMA/SIFMA) | Governs legal title transfer of collateral, margin maintenance obligations, close-out netting on default, and mini-close-out mechanics. |

---

## 3. Purpose

This procedure governs the complete lifecycle of every classic repurchase agreement (repo) and reverse repurchase agreement (reverse repo) entered into by the bank, from initial dealer booking through confirmation, STRATE settlement, daily mark-to-market and margin maintenance, to final close-out at maturity or early termination.

A **repo** (sale and repurchase) is a transaction in which the bank sells a debt security to a counterparty at a spot price and simultaneously agrees to repurchase that security at a forward price on an agreed end-date. The difference between spot and forward price constitutes the repo interest. The bank's books treat the transaction as a secured borrowing: cash received, bond off-balance-sheet, repo liability on-balance-sheet (per IFRS 9 derecognition criteria — linked asset).

A **reverse repo** (purchase and resale) is the mirror: the bank buys a security spot and agrees to resell it forward, providing cash to the counterparty secured against the bond collateral. Treated as a secured lending: cash advanced, bond received as collateral (not derecognised from counterparty per IFRS 9), repo receivable on-balance-sheet.

The procedure applies to:
- Overnight repos and reverse repos (ON/TN/SN);
- Term repos and reverse repos up to 12 months tenor;
- Open-maturity repos (callable repos) — covered by step 7 (early termination).

Out of scope: securities lending (governed by a separate GMSLA-based procedure); triparty repos (deferred — STRATE triparty API PLANNED).

---

## 4. Trigger

| Event | Description |
|---|---|
| `RepoTradeExecuted { repoId, product: 'Repo' \| 'ReverseRepo', counterpartyId, collateralISIN, notionalCash, repoRate, startDate, endDate, initialMarginPct, haircut }` | Primary trigger — emitted by dealer at point of verbal or electronic agreement. Starts the booking and confirmation workflow. |
| `RepoMaturityApproaching { repoId, endDate, businessDaysToMaturity: 2 }` | T−2 alert — triggers pre-maturity settlement instruction preparation. |
| `RepoMarginCallRequired { repoId, callId, callType: 'VM', callAmount, callCurrency, dueBy }` | Triggers the margin call resolution workflow (step 5e). |
| `RepoClosed { repoId, closedReason: 'Maturity' \| 'EarlyTermination', finalPnL }` | Terminal event — procedure ends on receipt. |

---

## 5. Steps

### 5a — Trade capture

When a dealer at Saskia's (Head of Global Markets, governance) desk agrees a repo or reverse repo with a counterparty (verbally on voice-recorded line, via electronic messaging, or via a JSE repo matching platform), the dealer immediately enters the trade into the Order Management System (OMS).

The OMS performs the following automated validations before accepting the booking:

1. **Counterparty eligibility.** Query the Party register and the counterparty-onboarding-markets register (`CounterpartyEnabled` event must exist for the counterparty with `product.repo = true`). Reject with error code `CPTY_INELIGIBLE` if not found.
2. **GMRA master agreement on file.** The legal document register (maintained by Imani (legal-as-code engineer, legal)) must hold a live `GMRAExecuted` event for the counterparty with no subsequent `GMRATerminated` event. Reject with `GMRA_MISSING` if absent; the dealer escalates to Imani to cure before the trade is booked.
3. **Mandate headroom.** The OMS queries the mandate-utilisation engine (PROC-MK-MA-01). The proposed notional must not breach (a) the per-counterparty repo sub-limit from the credit-limit register, (b) the aggregate repo-book notional limit in the Trading Mandate v1 Schedule A, and (c) any per-tenor or per-collateral-type sub-limit. If any limit is breached, the system emits `MandateBreachAlert` and suspends booking pending Saskia + Helena joint authorisation.
4. **Collateral eligibility.** The ISIN must appear on the approved collateral inclusion list (`Procedures/markets/corporate-issuer-inclusion-list.md`). Sovereign and SARB paper are always eligible. Non-sovereign must be rated ≥ BBB− (Fitch/Moody's/S&P; lowest of three) per the collateral management policy.
5. **Haircut and initial margin.** The OMS applies the haircut schedule from the Collateral Management Policy v1 based on issuer type, credit rating, and tenor. Initial margin (over-collateralisation) is set per the GMRA annex for the counterparty.

On successful validation, the OMS emits `RepoTradeBooked { repoId, ... }` and the trade record is created in the repo book.

**Manual step:** Where the GMRA is not on file and the trade has been verbally agreed, Saskia (Head of Global Markets, governance) may approve a same-day exception booking under a Letter of Undertaking (LOU), valid for 3 business days, while Imani (legal-as-code engineer, legal) completes GMRA execution. This exception is logged as `RepoBookingExceptionApproved { repoId, reason: 'LOU', expiryDate }` and Vera (internal audit engineer, audit) monitors daily for LOU expiry without GMRA cure.

### 5b — Trade confirmation

On `RepoTradeBooked`, the confirmation engine generates and dispatches an electronic confirmation to the counterparty.

The confirmation must be dispatched by T+0 close-of-business (17:00 SAST) and must include:
- Trade date and settlement date;
- Start leg: cash amount, collateral ISIN, quantity, dirty price, accrued interest, initial margin amount;
- End leg: repurchase amount (cash + repo interest);
- Repo rate (annualised, act/365);
- Governing GMRA and annex reference;
- Settlement instructions (STRATE depository participant ID, Nostro account for cash).

The counterparty is required to provide electronic affirmation by T+0 close of business. Affirmation is recorded as `RepoTradeConfirmed { repoId, confirmedBy: counterpartyId, confirmedAt }`.

If affirmation is not received by T+0 17:00 SAST, Tomas (Payments & settlement engineer, engineering) emits `TradeConfirmationUnmatched { repoId, reason: 'AffirmationTimeout' }` and escalates to Saskia (Head of Global Markets, governance). Saskia contacts the counterparty relationship contact directly. If the counterparty disputes the economics, the dispute follows the OTC dispute resolution procedure (PROC-MK-ODP-07). Unresolved disputes by T+1 09:00 are escalated to Helena (Chief Risk Officer, governance) and Imani (legal-as-code engineer, legal).

**GMRA 2011 §4 note:** Under the GMRA, legal title to the collateral transfers to the buyer on the purchase date. The confirmation is the contractual record of the parties' agreement; unsigned GMRA confirmations without affirmation are a documentation risk. Vera asserts daily that every `RepoTradeBooked` has a downstream `RepoTradeConfirmed` within 1 business day.

### 5c — Settlement instruction

On `RepoTradeConfirmed`, Tomas (Payments & settlement engineer, engineering) generates the STRATE settlement instruction for the opening leg of the repo.

For a repo (bank as seller / cash borrower):
- **Securities leg:** deliver collateral ISIN quantity from bank's STRATE account to counterparty STRATE account (DvP — delivery versus payment).
- **Cash leg:** receive cash into bank's nostro account at the correspondent bank.

For a reverse repo (bank as buyer / cash lender):
- **Securities leg:** receive collateral ISIN quantity from counterparty into bank's STRATE custody account.
- **Cash leg:** deliver cash from nostro to counterparty.

Instructions are transmitted via the STRATE CSD interface (see `Procedures/markets/csd-settlement-gateway.md`). Standard settlement is T+0 for overnight repos and T+1 for term repos, consistent with JSE Debt Market settlement conventions.

Tomas emits `RepoSettlementInstructed { repoId, legType: 'Opening', strate InstructionRef, expectedSettlementDate }` on dispatch.

Settlement confirmation from STRATE triggers `RepoSettlementConfirmed { repoId, legType: 'Opening', settledAt }`. Bea (Accounting & financial reporting engineer, engineering) posts the GL entries: cash leg to the repo liability / repo receivable account; bond leg to the collateral received / pledged account (per the bank's IFRS 9 derecognition policy). See `Procedures/by-policy/posting-rule-publication.md` for the applicable posting rules.

If settlement fails (STRATE rejection or counterparty fail), the procedure routes to the settlement fail pathway in step 12 (Failure modes) and cross-references PROC-OPS-SFBCP-01.

### 5d — Daily mark-to-market

At market close each business day, Bea's (Accounting & financial reporting engineer, engineering) valuation engine reprices every open repo's collateral bond at the daily closing price sourced from the BESA composite feed (primary) or the bank's internal MTM model (fallback per the collateral-valuation procedure at `Procedures/markets/repo-collateral-valuation.md`).

The MTM cycle produces:
- Current market value of collateral (dirty price × quantity + accrued interest).
- Collateral coverage ratio = market value ÷ (cash principal + accrued repo interest).
- If coverage ratio < initial margin threshold (as specified in the counterparty's GMRA annex), a margin call is warranted.
- Accrued repo interest for the day is posted to the P&L interest-income / interest-expense account.

On completion of the daily MTM cycle, Bea emits `RepoMarkToMarketCompleted { repoId, valuationDate, collateralMarketValue, coverageRatio, marginCallWarranted: boolean, accrualAmount }`.

If `marginCallWarranted: true`, the margin call engine automatically emits `RepoMarginCallRequired { repoId, callId, callType: 'VM', callAmount, callCurrency, dueBy }` where `dueBy` is 10:00 SAST on the following business day. The margin call amount equals the deficit to restore the coverage ratio to the initial margin floor.

Haircut adjustments required by credit-rating changes follow the haircut adjustment procedure at `Procedures/markets/repo-haircut-adjustment.md`.

### 5e — Margin call resolution

On `RepoMarginCallRequired`, Tomas (Payments & settlement engineer, engineering) notifies the counterparty of the margin call and specifies the form of eligible variation margin (cash or substitution collateral). The margin call notification is the counterparty's formal demand under GMRA 2011 §4(c).

The counterparty is required to deliver variation margin by **10:00 SAST on the next business day** following the margin call emission.

Resolution outcomes:

| Outcome | Event emitted | Action |
|---|---|---|
| Counterparty delivers cash VM before 10:00 | `RepoMarginCallResolved { repoId, callId, resolvedBy: 'CashVM', resolvedAt }` | Tomas applies cash to the repo and Bea updates the balance sheet. |
| Counterparty delivers substitution collateral before 10:00 | `RepoMarginCallResolved { repoId, callId, resolvedBy: 'CollateralSubstitution', newISIN }` | Tomas settles the substitution via STRATE; Bea reprices at new collateral MTM; `RepoMarkToMarketCompleted` re-emitted. |
| Margin call unresolved by 10:00 | Saskia notified; Saskia may grant a discretionary extension of up to 2 hours. | Extension recorded as `RepoMarginCallExtensionGranted { repoId, callId, extensionDeadline }`. |
| Margin call unresolved by **14:00 SAST** | `RepoMarginCallDefaulted { repoId, callId, defaultedAt }` | GMRA §10 close-out triggered. Saskia (Head of Global Markets, governance) approves close-out instruction. Tomas executes. Helena (Chief Risk Officer, governance) notified immediately. The close-out valuation is Bea's responsibility. Replacement trade cost, if any, is recorded as P&L. |

**GMRA 2011 §10:** The bank is entitled — but not obligated — to designate a Default Valuation Time and issue a Default Notice on failure to deliver margin. Any acceleration must be documented in writing by Imani (legal-as-code engineer, legal) under the bank's standard GMRA close-out template.

### 5f — Maturity

On `RepoMaturityApproaching` (T−2), Tomas (Payments & settlement engineer, engineering) prepares the closing-leg settlement instruction:

- **Repo maturity (bank as seller):** bank repurchases the collateral by delivering the forward repurchase amount (original cash + accrued repo interest) to the counterparty; counterparty returns the bond.
- **Reverse repo maturity (bank as buyer):** counterparty repays the forward purchase price; bank returns the bond.

The closing-leg instruction is transmitted to STRATE by T−1 end of business to meet the CSD's pre-notification requirement.

On settlement confirmation from STRATE, Tomas emits `RepoSettlementConfirmed { repoId, legType: 'Closing', settledAt }`. Bea (Accounting & financial reporting engineer, engineering) posts the final GL entries: reverses the opening-leg balance-sheet entries, realises any carry P&L not yet accrued, and emits `RepoClosed { repoId, closedReason: 'Maturity', finalPnL, closedAt }`.

The repo record is archived in the repo book with status `Closed`. The Vera recon assertion (section 16) checks that `RepoClosed` exists for every `RepoTradeBooked` within 5 business days of the contractual end date.

### 5g — Early termination

Either party may request early termination (termination before the contractual end date) by providing notice per the GMRA 2011 and any applicable term-repo break-clause in the GMRA annex. For open-maturity (callable) repos, either party may terminate on the next business day with same-day notice by 09:00 SAST.

Steps:

1. The requesting party (counterparty or bank) delivers notice of early termination to Tomas (Payments & settlement engineer, engineering) / the bank's dealer.
2. **Saskia (Head of Global Markets, governance) must approve all early terminations** where the bank is the terminating party; approval is recorded as `RepoEarlyTerminationApproved { repoId, approvedBy: 'Saskia', approvedAt, rationale }`. Counterparty-initiated terminations are accepted without separate Saskia approval but are recorded as `RepoEarlyTerminationAccepted { repoId, acceptedAt }`.
3. Bea (Accounting & financial reporting engineer, engineering) accrues repo interest to the actual termination date (not the original end date) and posts the accrual adjustment. The accrued interest amount is the close-out consideration under GMRA §9.
4. Tomas (Payments & settlement engineer, engineering) generates and transmits the early-termination closing-leg settlement instruction to STRATE on the agreed early-termination date.
5. On STRATE confirmation, Bea emits `RepoClosed { repoId, closedReason: 'EarlyTermination', finalPnL, closedAt }`.

---

## 6. Reconciliation — typed event chain

Every repo trade must produce the following event sequence. Vera (internal audit engineer, audit) asserts daily that the chain is gapless for all open trades and for all trades closed within the past 5 business days.

| # | Event | Emitter | When |
|---|---|---|---|
| 1 | `RepoTradeBooked` | OMS / dealer | Trade capture (step 5a) |
| 2 | `RepoTradeConfirmed` | Confirmation engine / counterparty affirmation | By T+0 17:00 (step 5b) |
| 3 | `RepoSettlementInstructed { legType: 'Opening' }` | Tomas (settlement engine) | On confirmation (step 5c) |
| 4 | `RepoSettlementConfirmed { legType: 'Opening' }` | STRATE gateway | On CSD confirmation (step 5c) |
| 5 | `RepoMarkToMarketCompleted` | Bea's valuation engine | Daily at market close (step 5d) — one per calendar day per open repo |
| 6 | `RepoMarginCallRequired` | Margin call engine | When `marginCallWarranted: true` (step 5d) — zero or more per repo |
| 7 | `RepoMarginCallResolved` | Settlement / Bea | On margin delivery (step 5e) — must follow each `RepoMarginCallRequired` |
| 8 | `RepoSettlementInstructed { legType: 'Closing' }` | Tomas | T−1 of maturity or early termination (steps 5f / 5g) |
| 9 | `RepoSettlementConfirmed { legType: 'Closing' }` | STRATE gateway | On CSD confirmation (steps 5f / 5g) |
| 10 | `RepoClosed` | Bea | On closing-leg settlement (steps 5f / 5g) — terminates the chain |

**Gap rules:**
- `RepoTradeBooked` without `RepoTradeConfirmed` within 1 BD → Vera finding (severity: High).
- `RepoMarginCallRequired` without `RepoMarginCallResolved` or `RepoMarginCallDefaulted` within 1 BD → Vera finding (severity: Critical).
- `RepoTradeBooked` without `RepoClosed` within 5 BD of contractual end date → Vera finding (severity: High).

---

## 7. Exception handling

| Exception | First response | Escalation |
|---|---|---|
| Settlement fail (STRATE rejection on opening leg) | Tomas investigates with STRATE; re-submits corrected instruction within 2 hours. Route to PROC-OPS-SFBCP-01 if not resolved same day. | Devon (Chief Operating Officer, governance) notified if fail persists beyond T+1. |
| Settlement fail (STRATE rejection on closing leg) | Tomas re-submits; counterparty notified of delay; repo interest continues to accrue under GMRA §7(f). | Devon + Saskia joint if > T+3 from original end date. |
| Margin call unresolved by 14:00 | GMRA §10 close-out — see step 5e. | Helena (Chief Risk Officer, governance) + Marc (CEO) notified immediately on default event. |
| Counterparty default (insolvency / non-performance beyond close-out) | Helena leads credit risk close-out under PROC-RISK-CO-01; Imani manages GMRA netting and proof-of-claim. | Marc (CEO) and the full governance leadership group notified on Day 1. |
| GMRA not on file at trade capture | Booking suspended; Saskia may approve LOU (see step 5a exception). Imani cures within 3 BD. | If LOU expires without GMRA executed, trade cancelled; counterparty notified; Vera finding raised. |
| Mandate breach detected at booking | Booking suspended; Saskia + Helena joint authorisation required before proceeding. | `MandateBreachAlert` escalated per PROC-MK-MA-01. |
| Collateral rating downgrade post-booking | Haircut uplift calculated per repo-haircut-adjustment procedure; margin call issued if coverage falls below floor. | If counterparty refuses substitution or additional collateral, treat as margin call default at next 14:00 deadline. |

---

## 8. Reporting and MI

| Report | Content | Frequency | Recipients |
|---|---|---|---|
| Repo book live dashboard | Open repos (counterparty, ISIN, notional, rate, tenor, MTM, margin status) | Live / intraday | Saskia, Eitan (Treasurer) |
| Daily P&L report | Accrued repo income / expense, MTM movement, realised P&L on closed trades | Daily (T+0 close) | Bea (Accounting & financial reporting engineer, engineering), Camille (Chief Financial Officer, governance) |
| Margin call status report | Open margin calls, amount, counterparty, resolution status | Intraday on any open call | Saskia, Helena (Chief Risk Officer, governance) |
| Weekly repo book review | Notional, concentration, tenor distribution, open margin calls, weekly P&L | Weekly | Saskia + Helena joint review |
| Monthly ALM/liquidity report contribution | Repo as secured funding; reverse repo as secured lending; LCR/NSFR collateral HQLA classification | Monthly | Eitan (Treasurer), Camille (CFO) — inputs to PROC-RISK-ILF-01 |
| FMA s.35–36 trade report | SFT economics to STRATE trade repository within T+1 of execution | Per trade | Mira (regulatory intelligence engineer, compliance) oversight; Tomas submission |

---

## 9. Change control

- **Procedure owner:** Saskia (Head of Global Markets, governance) + Bea (Accounting & financial reporting engineer, engineering).
- **Amendments to the repo booking workflow or margin call mechanics** require joint sign-off by Saskia + Helena (Chief Risk Officer, governance). Both must review any change before it takes effect; material changes require BRC approval.
- **GMRA election changes** (standard elections in Annex I or any supplemental annex) require Imani (legal-as-code engineer, legal) to assess the legal effect before Saskia + Helena sign off. Imani authors the updated GMRA elections in the legal document register.
- **Collateral haircut schedule updates** follow the haircut adjustment procedure (`Procedures/markets/repo-haircut-adjustment.md`) and require Eitan (Treasurer) + Saskia + Helena approval at ALCO.
- **Collateral inclusion list updates** (adding / removing eligible ISINs) follow `Procedures/markets/corporate-issuer-inclusion-list.md`.
- All procedure versions are recorded in the change log (section 17).

---

## 10. Evidence / audit trail

| Artefact | Location | Retention | Authority |
|---|---|---|---|
| `RepoTradeBooked` + full booking payload | Event log | 7 years | FMCA s.35; SARB record-keeping |
| GMRA confirmation + trade annex (signed) | BLAKE3 document store (RMS) | 7 years or life of agreement + 3 years | GMRA 2011 §24 |
| Trade confirmation dispatched to counterparty | Event log (`RepoTradeConfirmed`) + correspondence store | 7 years | FMA s.35 |
| STRATE settlement instructions + CSD confirmation | Settlement log (Tomas) + event log | 7 years | STRATE rules |
| Daily MTM records (`RepoMarkToMarketCompleted`) | Event log | 7 years | SARB / Banks Act |
| Margin call correspondence (notices, counterparty responses) | Event log (`RepoMarginCallRequired`, `RepoMarginCallResolved`) + correspondence store | 7 years | GMRA 2011 §4(c); SARB |
| GMRA §10 close-out notices (where issued) | BLAKE3 document store (RMS) + event log (`RepoMarginCallDefaulted`) | 7 years | GMRA 2011 §10 |
| Early termination notices | BLAKE3 document store + event log | 7 years | GMRA 2011 §9 |
| `RepoClosed` event | Event log | Permanent | Principle 1 |
| FMA s.35–36 trade reports (STRATE TR submission) | Regulatory correspondence store | 5 years | FMA s.35 |

---

## 11. Manual steps

The following steps require human judgment and cannot be fully automated with the current substrate:

| Step | Manual actor | Trigger | Substrate gap |
|---|---|---|---|
| GMRA negotiation and execution | Imani (legal-as-code engineer, legal) + Saskia (Head of Global Markets, governance) | New counterparty onboarding; GMRA amendment | GMRA confirmation engine PLANNED — until live, Imani authors in DocuSign manually |
| Early termination approval (bank as terminating party) | Saskia (Head of Global Markets, governance) | Early termination requested | Manual Saskia sign-off in current substrate; automated approval-routing PLANNED |
| Margin call escalation (10:00 → 14:00 window) | Saskia (Head of Global Markets, governance) | `RepoMarginCallRequired` unresolved after 10:00 | Manual monitoring by Tomas + Saskia; automated escalation alerting PLANNED |
| GMRA §10 close-out initiation (formal close-out notice) | Imani (legal-as-code engineer, legal) | `RepoMarginCallDefaulted` | Close-out notice generation PLANNED; currently Imani uses standard template |
| Collateral substitution eligibility assessment | Bea (Accounting & financial reporting engineer, engineering) | Counterparty proposes substitution collateral | Automated eligibility check PLANNED; currently manual ISIN + rating lookup by Bea |

---

## 12. Failure modes

| Failure mode | Detection | Consequence | Recovery |
|---|---|---|---|
| **Settlement fail (opening leg)** | STRATE rejects instruction; `RepoSettlementInstructed` not followed by `RepoSettlementConfirmed` within 1 BD | Cash or bond not delivered; counterparty may claim fail charges per JSE rules; repo interest does not begin to accrue until actual settlement | Tomas re-submits; if persistent, invoke PROC-OPS-SFBCP-01; Devon notified |
| **Margin call ignored (counterparty)** | `RepoMarginCallRequired` with no `RepoMarginCallResolved` by 14:00 | GMRA §10 close-out event triggered; potential mark-to-market loss if replacement trade required at higher rate | GMRA close-out executed; Imani issues Default Notice; Helena + Marc notified |
| **GMRA not on file** | OMS validation rejects at booking; or Vera daily recon finds open repo without matching `GMRAExecuted` event | Booking suspended; no enforceable netting on default; unsecured credit exposure | Imani cures; LOU max 3 BD; if uncured, trade cancelled |
| **Collateral haircut not applied correctly** | Bea's daily MTM recon finds coverage ratio inconsistent with approved haircut schedule | Potential under-margined position; credit exposure to counterparty | Immediate Bea correction + margin call if warranted; Vera finding raised |
| **Mandate limit breach** | OMS validation at booking; or Vera intraday mandate-utilisation recon | Trade cannot proceed without exception approval; reputational and regulatory risk if unchecked | Saskia + Helena joint approval required before proceeding; MandateBreachAlert logged |
| **Incorrect IFRS derecognition** | Bea's GL reconciliation against `RepoSettlementConfirmed` events | Balance-sheet mis-statement; potential IAS 39 / IFRS 9 restatement | Bea corrects posting; Camille (CFO, governance) notified; prior-period restatement if material |

---

## 13. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Margin call unresolved at 10:00 | Tomas → Saskia (Head of Global Markets, governance) | Immediately at 10:00 SAST |
| Margin call unresolved at 14:00 (GMRA §10) | Saskia → Helena (Chief Risk Officer, governance) + Marc (CEO) | Immediately on `RepoMarginCallDefaulted` event |
| Counterparty default (insolvency or non-performance beyond close-out) | Helena (CRO, governance) leads; Imani (legal-as-code engineer, legal) + Saskia + Marc notified same day | Day 1 of confirmed default |
| Settlement fail > T+3 from original settlement date | Tomas → Devon (Chief Operating Officer, governance) | At T+3 17:00 SAST |
| Unconfirmed trade at T+1 09:00 | Tomas + Saskia → Helena (dispute risk) + Imani (legal) | T+1 09:00 SAST |
| Mandate breach (aggregate repo book > limit) | Saskia → Helena for exception sign-off; Vera finding raised | Immediately on breach detection |
| STRATE system outage affecting settlement | Tomas → Devon (COO, governance) → PROC-OR-DR-01 | On outage detection |

---

## 14. Cross-references

| Reference | Description |
|---|---|
| `Procedures/markets/csd-settlement-gateway.md` | STRATE CSD interface; settlement instruction format; fail management at CSD level |
| `Procedures/markets/repo-collateral-valuation.md` | Daily bond collateral repricing methodology; BESA composite feed; fallback model |
| `Procedures/markets/repo-haircut-adjustment.md` | Haircut schedule; credit-rating-triggered haircut uplift; ALCO approval path |
| `Procedures/by-policy/tr-collateral-management.md` | Collateral management policy operationalisation; variation-margin and initial-margin mechanics for ISDA trades (separate from GMRA margin) |
| `Procedures/by-policy/collateral-valuation-daily.md` | PROC-ALM-CVD-01 — daily EOD collateral valuation covering ISDA/CSA netting; links to repo margin where collateral pools overlap |
| `Procedures/by-policy/counterparty-onboarding-markets.md` | PROC-MK-CO-01 — counterparty onboarding gate; `CounterpartyEnabled` event prerequisite |
| `Procedures/by-policy/credit-risk-limit-management.md` | PROC-RISK-CLM-01 — credit limits that bound per-counterparty repo exposure |
| `Procedures/by-policy/intraday-liquidity-funding.md` | PROC-RISK-ILF-01 — repo as a secured funding instrument; reverse repo as a secured lending tool; repo book feeds the ALM liquidity position |
| `Procedures/by-policy/posting-rule-publication.md` | GL posting rules for repo opening leg, daily accrual, closing leg, and close-out |
| `Procedures/markets/corporate-issuer-inclusion-list.md` | Approved non-sovereign collateral ISINs |

---

## 15. Substrate gaps

| Gap | Status | Owner | Notes |
|---|---|---|---|
| GMRA confirmation engine — automated generation and dispatch of GMRA-compliant trade confirmations | PLANNED | Kai (trading system engineer, engineering) | Currently manual DocuSign; engine will generate ISO 20022 / GMRA-annex-format confirmations automatically on `RepoTradeBooked` |
| Margin call automation — automated issuance of margin call notices, escalation alerts, and 14:00 default trigger | PLANNED | Tomas (Payments & settlement engineer, engineering) | Currently relies on Tomas manual monitoring; automation will emit `RepoMarginCallRequired` and escalate without human intervention |
| STRATE repo API — programmatic two-way integration with STRATE for repo settlement instructions (opening and closing legs) | PLANNED | Tomas | Current substrate uses STRATE's manual/batch interface; full API integration planned for M-phase settlement build |
| Triparty repo | DEFERRED | Saskia | Triparty repo via STRATE's triparty service is deferred until STRATE triparty API is live |
| Haircut schedule automation | PLANNED | Bea | Automated haircut uplift on credit-rating downgrade event; currently manual lookup by Bea |
| Collateral substitution eligibility engine | PLANNED | Bea + Kai | Automated check of substitute ISIN against inclusion list + haircut schedule on `CollateralSubstitutionProposed` |

---

## 16. Audit and assurance

Vera (internal audit engineer, audit) runs the following recon assertions on the repo book as part of the daily continuous-assurance pipeline:

| Assertion | Vera recon check | Failure severity |
|---|---|---|
| Every `RepoTradeBooked` has a downstream `RepoTradeConfirmed` within 1 business day | Count `RepoTradeBooked` events where no matching `RepoTradeConfirmed` exists within `eventTime + 1BD` | High |
| Every `RepoTradeBooked` has a downstream `RepoClosed` within 5 business days of contractual end date | Count `RepoTradeBooked` events where `endDate + 5BD < today` and no `RepoClosed` exists | High |
| No open margin calls older than 1 business day | Count `RepoMarginCallRequired` events where no `RepoMarginCallResolved` or `RepoMarginCallDefaulted` exists and `dueBy + 1BD < now` | Critical |
| Every open repo has a `RepoMarkToMarketCompleted` event for the previous business day | Count open repos (no `RepoClosed`) where no `RepoMarkToMarketCompleted` for the prior BD exists | High |
| Every `RepoSettlementInstructed` has a downstream `RepoSettlementConfirmed` within 2 business days | Count `RepoSettlementInstructed` events without a matching `RepoSettlementConfirmed` within 2 BD | High |
| No `RepoTradeBooked` without a prior `CounterpartyEnabled` event in the Party register | Cross-reference repo `counterpartyId` against counterparty onboarding register | Critical |
| No `RepoTradeBooked` without a matching `GMRAExecuted` event | Cross-reference each `RepoTradeBooked.counterpartyId` against legal document register | Critical |

Vera findings from these assertions are filed as `AuditFinding` events with severity classification per PROC-AUD-FT-01 and routed to Thandiwe (Chief Audit Executive, governance) for P1/P2 items.

---

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-22 | Saskia (Head of Global Markets, governance) · Bea (Accounting & financial reporting engineer, engineering) | Initial POPULATED — full 17-section lifecycle: trade capture (GMRA gate + mandate headroom + collateral eligibility), electronic confirmation (T+0 affirmation SLA), STRATE settlement (DvP opening and closing legs), daily MTM and margin call (GMRA §4 mechanics, 10:00/14:00 escalation ladder, §10 close-out), maturity settlement, early termination (Saskia approval; Bea interest accrual to termination date). Seven typed events in the reconciliation chain. Exception handling: settlement fail → PROC-OPS-SFBCP-01; margin default → Helena + Marc; GMRA absent → LOU 3 BD grace. Six substrate gaps identified: GMRA confirmation engine, margin call automation, STRATE repo API, triparty repo, haircut automation, collateral substitution engine. Seven Vera recon assertions. |
