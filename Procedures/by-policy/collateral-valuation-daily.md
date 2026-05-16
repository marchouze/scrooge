---
procedureId: PROC-ALM-CVD-01
title: Daily collateral valuation and margin call management
author: Eitan (treasury & ALM engineer) · Saskia (markets risk engineer)
date: 2026-05-16
owner: Eitan (treasury & ALM engineer) · Saskia (markets risk engineer)
status: POPULATED
policy-cited: Collateral Management Policy (planned)
system-capability: "@platform/alm/collateral-engine (PLANNED)"
---

# Procedure — Daily collateral valuation and margin call management

**Procedure ID:** PROC-ALM-CVD-01
**Owner:** Eitan (treasury & ALM engineer) · Saskia (markets risk engineer)
**Approval:** ALCO (Collateral Management Policy; eligible-collateral schedule; haircut grid); ALCO + BRC (margin policy — shared with PROC-MK-ODP-03 and PROC-MK-ODP-04)
**Cadence:** Daily (end-of-day valuation cycle, 17:00 SAST cutoff; margin calls issued by 18:00 SAST); intraday (on material MTM move > threshold); monthly ALCO collateral report
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

---

## 1. Source policy

- Collateral Management Policy (planned; to be authored by Eitan (treasury & ALM engineer) with Saskia (markets risk engineer); Helena (Chief Risk Officer, governance) approval; required before first OTC derivative trade).
- `Policies/margin-policy-v1.md` — Margin Policy (PLANNED; shared with PROC-MK-ODP-03 and PROC-MK-ODP-04).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B4 — counterparty credit risk appetite; collateral is the primary first-loss mitigation.

The obligation chain:

```
Regulation (PA Umoja Directive — VM reporting; Joint Standard JS 2/2020 — UMR IM; BCBS-IOSCO margin requirements)
  → Collateral Management Policy (PLANNED)
    → Margin Policy (PLANNED)
      → PROC-ALM-CVD-01 (this procedure)
        → @platform/alm/collateral-engine (PLANNED)
        → @platform/events/margin-call-issued (PLANNED)
```

Related procedures (upstream):

- **PROC-MK-ODP-03** (`margin-vm.md`) — daily variation margin calculation and exchange. PROC-ALM-CVD-01 consumes the VM call amounts computed by PROC-MK-ODP-03 and manages the collateral assets that satisfy those calls.
- **PROC-MK-ODP-04** (`margin-im.md`) — initial margin calculation and segregated custodian management. PROC-ALM-CVD-01 manages the daily IM collateral eligibility and top-up cycle.

PROC-ALM-CVD-01 is the collateral-side companion to the margin calculation procedures. PROC-MK-ODP-03 and PROC-MK-ODP-04 compute what is owed; PROC-ALM-CVD-01 governs the physical collateral that satisfies the obligation.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Joint Standard JS 2/2020 (FSCA/PA) §4–5 | VM and IM requirements for non-centrally cleared OTC derivatives; eligible collateral; segregation of IM |
| BCBS-IOSCO 2020 Final Margin Requirements | International standard adopted by JS 2/2020; phase-in thresholds; haircut floors |
| PA Umoja Directive (ILAAP / SREP) | Daily collateral reporting; intraday liquidity implications of margin calls |
| Regulations Relating to Banks Reg 69 (credit risk mitigation) | Eligible financial collateral; haircut methodology; legal certainty of netting |
| ISDA 2016 Credit Support Annex (VM) | Contractual VM mechanics; eligible collateral; delivery timeline (1 business day) |
| ISDA 2016 Credit Support Deed (IM) | IM segregation; custodian; rehypothecation prohibition |
| Banks Act 94 of 1990 s.78 (credit risk) | CRM recognition; eligible collateral standards |
| IFRS 9 §5.7.1 | Fair value measurement of collateral assets |

---

## 3. Purpose

The daily collateral valuation and margin call management cycle serves four purposes:

1. **Counterparty credit risk mitigation:** ensures the bank holds sufficient collateral at all times to cover its net exposure to each OTC derivative counterparty, so that in the event of counterparty default the bank can liquidate collateral and recover its exposure.
2. **Regulatory capital relief:** VM and IM collateral recognised under Reg 69 reduces the risk-weighted exposure for capital adequacy purposes; this requires daily valuation and compliant documentation.
3. **Collateral efficiency:** ensures the bank delivers the optimal mix of eligible collateral (minimising the opportunity cost of posting high-quality liquid assets) while meeting all contractual and regulatory requirements.
4. **PA Umoja reporting compliance:** daily collateral reporting to the Prudential Authority requires accurate MTM and margin call data.

---

## 4. Trigger

This procedure runs every business day at 17:00 SAST (end-of-day valuation cutoff). It also triggers intraday if:

- Any OTC position MTM change exceeds ZAR 5,000,000 since the previous margin call (intraday call threshold, ALCO-approved).
- A counterparty issues an unexpected margin call or disputes a call (escalation path B, §7).
- A collateral eligibility breach is detected (collateral posted by a counterparty becomes ineligible, e.g. due to rating downgrade).

---

## 5. Steps

Default actor is the collateral engine agent (`@platform/alm/collateral-engine`) unless a human-approval step is explicitly marked.

**Step 1 — OTC position MTM refresh (agent)**

At 17:00 SAST, the collateral engine retrieves end-of-day mark-to-market values for all open OTC derivative positions from `@risk/otc-mtm`. The MTM values are as of the 17:00 SAST JSDA/BASA fixing. Positions without an end-of-day MTM value by 17:15 SAST trigger a `MTMStalenessAlert` — Saskia (markets risk engineer) is notified immediately and a prior-day MTM with a conservative loading is used as a fallback pending resolution.

**Step 2 — ISDA/CSA netting calculation (agent)**

For each counterparty with an executed ISDA Master Agreement and CSA, the collateral engine:

1. Groups all OTC positions under the same netting set (defined by the ISDA netting set identifier in the position register).
2. Computes the net MTM of the netting set: Σ(MTM of all positions in the netting set). A positive net MTM means the bank is in-the-money (the counterparty owes collateral); a negative net MTM means the bank is out-of-the-money (the bank owes collateral).
3. Confirms the netting set identifier matches the legal netting opinion on file (Imani (legal-as-code engineer) maintains the netting legal opinion register; the collateral engine cross-checks the counterparty flag `nettingLegalOpinionValid: true`).

If no valid netting opinion is on file for a counterparty, the agent does **not** net — it treats each position on a gross basis, consistent with Reg 69 requirements for CRM recognition.

**Step 3 — Current collateral account balance retrieval (agent)**

The agent retrieves the current collateral account balances for each counterparty from `@platform/alm/collateral-ledger`:

- **VM collateral held** (collateral received from counterparty): cash or bonds posted by the counterparty as variation margin.
- **VM collateral posted** (collateral delivered to counterparty): cash or bonds the bank has posted as variation margin.
- **IM collateral held at custodian** (segregated IM received): per the IM custodian account statement (sourced from the custodian data feed — PROC-MK-ODP-04).
- **IM collateral posted at custodian** (segregated IM posted by the bank): per the custodian account statement.

**Step 4 — Net margin call calculation (agent)**

The agent calculates the net margin call for each counterparty netting set:

```
VM_net_call = Net_MTM − Threshold − MTA − VM_collateral_already_held + VM_collateral_already_posted
```

Where:
- **Threshold:** the contractual zero-threshold (per ISDA CSA; JS 2/2020 mandates zero threshold for in-scope counterparties).
- **MTA (Minimum Transfer Amount):** the ISDA CSA minimum transfer amount (typically ZAR 500,000 for institutional counterparties; confirmed in the CSA terms loaded in the counterparty register).
- If VM_net_call > 0: the bank issues a margin call to the counterparty (Step 6).
- If VM_net_call < 0: the bank must post additional VM collateral to the counterparty (Step 6).
- If |VM_net_call| < MTA: no call or posting required for the day.

For IM (in-scope counterparties only, per PROC-MK-ODP-04), the agent retrieves the latest SIMM computation and compares to the IM already held at the custodian; any shortfall triggers an IM top-up call (Step 6, flagged as IM).

**Step 5 — Collateral eligibility check (agent)**

For collateral held from counterparties and for collateral the bank is considering posting:

1. The agent checks each collateral asset against the ALCO-approved eligible-collateral schedule (stored in `@platform/alm/collateral-engine` configuration):

| Collateral type | Eligible for VM | Eligible for IM | Haircut (ALCO schedule) |
|---|---|---|---|
| ZAR cash | Yes | Yes | 0% |
| RSA government bonds (< 1Y residual) | Yes | Yes | 0.5% |
| RSA government bonds (1–5Y residual) | Yes | Yes | 2% |
| RSA government bonds (5–10Y residual) | Yes | Yes | 4% |
| RSA government bonds (> 10Y residual) | Yes | Yes | 8% |
| JSE-listed equity (top-40, investment grade issuer) | Yes (VM only) | No | 15% |
| Foreign currency cash (USD/EUR/GBP) | Yes | Yes (custodian holds) | FX haircut per JS 2/2020 |

2. For IM, the agent confirms that the collateral is held in a bankruptcy-remote segregated account at the custodian and is not rehypothecated.
3. If a collateral asset held from a counterparty is no longer eligible (e.g. bond rating downgrade, maturity crossed a tenor bucket), the agent flags a `CollateralEligibilityBreach` event and Eitan (treasury & ALM engineer) is notified within 30 minutes to demand a collateral substitution.

**Step 6 — Haircut application and adjusted collateral value (agent)**

For each collateral asset, the agent applies the ALCO-approved haircut:

```
Adjusted_collateral_value = Market_value × (1 − Haircut)
```

The adjusted collateral value is used for:
- Determining whether the net collateral position covers the net MTM exposure.
- Sizing the margin call (the call is for the shortfall in adjusted collateral value, not market value).

**Step 7 — Margin call issuance / receipt (agent, with Eitan sign-off for calls > ZAR 50,000,000)**

By 18:00 SAST:

1. For each counterparty with a net VM margin call or VM shortfall, the collateral engine:
   - Drafts a margin call notice in the ISDA standard format.
   - For calls ≤ ZAR 50,000,000: the agent issues the call automatically via the correspondent bank SWIFT MT messaging channel (or email per the CSA agreed method).
   - For calls > ZAR 50,000,000: Eitan (treasury & ALM engineer) reviews and approves the call before issuance (approval within 30 minutes of draft being ready).

2. The margin call is issued as a `MarginCallIssued` event in the event store, with payload:
   - Counterparty ID; netting set ID; call direction (bank-to-counterparty or counterparty-to-bank); call amount; call currency; value date (next business day); collateral type demanded.

3. For IM top-up calls (from PROC-MK-ODP-04), the call is flagged as `marginType: IM` and is routed to the custodian instruction queue rather than the correspondent bank.

4. Received margin calls from counterparties are logged as `MarginCallReceived` events; the bank must respond within the ISDA CSA delivery timeline (1 business day for VM; per JS 2/2020 for IM).

**Step 8 — Settlement instruction (agent)**

On the value date (next business day after the call date):

1. For VM collateral being delivered to a counterparty: the collateral engine instructs the correspondent bank (via PROC-MK-ODP-03 outbound payment channel) to transfer the collateral asset. For cash VM: SWIFT MT202 via correspondent. For bond VM: STRATE DvP instruction via the JSE settlement channel.
2. For VM collateral being received from a counterparty: the agent monitors the collateral ledger for the inbound credit. If not received by 12:00 SAST on the value date, a `MarginCallSettlementFail` event is raised and Eitan (treasury & ALM engineer) is notified (§7 Path C).
3. For IM: settlement is directly between the counterparty and the custodian; the bank confirms custodian receipt via the custodian data feed.

**Step 9 — Post-settlement reconciliation (agent)**

At 16:00 SAST on the value date:

1. The agent reconciles the collateral ledger against the correspondent bank statement and STRATE settlement confirmation.
2. Unreconciled items generate a `CollateralReconciliationBreak` event.
3. The reconciliation result is included in the daily ALCO operations report.

**Step 10 — PA Umoja collateral reporting (agent)**

By 09:00 SAST the following business day, the agent compiles the daily collateral position report for PA Umoja:

- Net MTM exposure per counterparty netting set.
- VM held and posted.
- IM held and posted (per custodian).
- Margin calls outstanding and their aging.
- Collateral eligibility exceptions.

The report is formatted per PA Umoja specifications and submitted via the PA reporting channel (shared with PROC-MK-ODP-03).

---

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Eitan (treasury & ALM engineer) | Procedure owner; large-call approval (> ZAR 50m); collateral eligibility exception resolution; settlement fail escalation |
| Saskia (markets risk engineer) | MTM staleness alert resolution; intraday trigger monitoring; Collateral Management Policy co-author |
| Ravi (ALM quant engineer) | SIMM IM computation (cross-referenced from PROC-MK-ODP-04); collateral VaR for ALCO reporting |
| Tomas (operations engineer) | Settlement instruction execution (correspondent bank; STRATE); reconciliation breaks |
| Imani (legal-as-code engineer) | Netting legal opinion register; CSA terms validation; collateral substitution notices |
| Helena (Chief Risk Officer, governance) | Collateral Management Policy approval; CCR RAS oversight; PA Umoja reporting governance |
| Camille (CFO, governance) | Capital relief recognition (Reg 69 CRM); ALCO reporting |
| ALCO | Eligible-collateral schedule approval; haircut grid approval; intraday threshold approval |

---

## 7. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| **Path A — MTMStalenessAlert:** MTM not available by 17:15 SAST | Saskia (markets risk engineer) notified immediately; prior-day MTM + conservative loading applied; root-cause resolution | Immediate notification; resolution before next day's cycle |
| **Path B — Counterparty disputes margin call** | Eitan (treasury & ALM engineer) and Imani (legal-as-code engineer) assess; PROC-MK-ODP-07 (OTC dispute resolution) invoked; interim collateral held; Helena (Chief Risk Officer, governance) notified if dispute exceeds ZAR 10m | Acknowledged within 1 business day; PROC-MK-ODP-07 governs resolution timeline |
| **Path C — MarginCallSettlementFail:** inbound collateral not received by 12:00 SAST value date | Eitan (treasury & ALM engineer) notified immediately; counterparty contacted; if not settled by 15:00 SAST, Imani (legal-as-code engineer) issues ISDA notice of failure; Helena (Chief Risk Officer, governance) notified | Immediate notification; ISDA notice within 3 hours of failure |
| **Path D — CollateralEligibilityBreach:** held collateral becomes ineligible | Eitan (treasury & ALM engineer) demands substitution within 2 business days; if no substitution, calls additional cash collateral; Helena (Chief Risk Officer, governance) notified | 2 business days for substitution; notification immediate |
| **Path E — Intraday trigger (> ZAR 5m MTM move)** | Collateral engine computes intraday call; Eitan (treasury & ALM engineer) approves if > ZAR 50m; issued immediately | Intraday; call issued within 1 hour of trigger |

---

## 8. System capabilities

| Capability | Status | Description |
|---|---|---|
| `@platform/alm/collateral-engine` | PLANNED | Daily valuation cycle orchestrator; netting; haircut application; margin call generation; eligibility checking |
| `@platform/alm/collateral-ledger` | PLANNED | Collateral account balances per counterparty; VM and IM separation; custodian reconciliation |
| `@risk/otc-mtm` | PLANNED | End-of-day OTC IRD mark-to-market (shared with PROC-MK-ODP-03) |
| `@platform/events/margin-call-issued` | PLANNED | Typed event schema: `MarginCallIssued`, `MarginCallReceived`, `MarginCallSettlementFail`, `CollateralEligibilityBreach`, `CollateralReconciliationBreak` |
| `@platform/alm/ftp-engine` | PLANNED | FTP rate on collateral assets (opportunity cost attribution, per PROC-ALM-FTP-01) |
| `@platform/risk/im-simm` | PLANNED | SIMM IM computation (per PROC-MK-ODP-04; cross-referenced) |
| `@platform/ops/correspondent-channel` | PLANNED | SWIFT MT202 / STRATE DvP settlement instructions |
| `@platform/reporting/pa-umoja` | PLANNED | PA Umoja daily collateral report submission |

---

## 9. Quality controls

| Control | Frequency | Owner |
|---|---|---|
| MTM completeness — all positions have EOD MTM by 17:15 SAST | Daily | Saskia (markets risk engineer) |
| Netting legal opinion validity — all counterparties flagged | Monthly | Imani (legal-as-code engineer) |
| Collateral eligibility schedule review — haircut grid and eligible assets | Quarterly (ALCO) | Eitan (treasury & ALM engineer) |
| Margin call issuance completeness — every netting set above MTA has a call or posting | Daily at 18:00 SAST | Collateral engine agent |
| Post-settlement reconciliation — collateral ledger vs. correspondent bank + STRATE | Daily at 16:00 SAST value date | Tomas (operations engineer) |
| PA Umoja submission timeliness | Daily by 09:00 SAST | Collateral engine agent |
| ALCO monthly collateral report — aggregate exposures, call efficiency, eligibility breaches | Monthly | Eitan (treasury & ALM engineer) · Ravi (ALM quant engineer) |
| Haircut model validation | Annual | Rohan (market risk quant engineer) (independent of Ravi) |

---

## 10. Evidence / audit trail

| Artefact | Retention | Location |
|---|---|---|
| `MarginCallIssued` event (per call) | 7 years | Event store (immutable) |
| `MarginCallReceived` event | 7 years | Event store |
| `MarginCallSettlementFail` event | 7 years | Event store |
| `CollateralEligibilityBreach` event | 7 years | Event store |
| `CollateralReconciliationBreak` event | 7 years | Event store |
| Daily EOD MTM snapshot (all OTC positions) | 7 years | `@risk/otc-mtm` time-series store |
| Daily collateral ledger snapshot (VM + IM, per counterparty) | 7 years | `@platform/alm/collateral-ledger` |
| Margin call notices (issued and received) | 7 years | RMS document store (BLAKE3 content-addressed) |
| PA Umoja collateral report (daily) | 7 years | RMS + PA Umoja submission log |
| ALCO monthly collateral report | 7 years | RMS |
| Eligible-collateral schedule and haircut grid (all versions) | 7 years post-supersession | RMS document store |
| ISDA CSA terms per counterparty (collateral provisions) | Life of agreement + 7 years | Imani (legal-as-code engineer) — contract register + RMS |

All retention periods comply with Banks Act requirements and SARS five-year minimum, with the longer period applied.
