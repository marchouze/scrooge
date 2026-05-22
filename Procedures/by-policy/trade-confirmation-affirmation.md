---
procedureId: PROC-MK-CONF-01
title: Trade confirmation and affirmation — JSE-listed bonds, equities, and exchange-traded products
author: Saskia (Head of Global Markets) · Tomas (Payments & settlement engineer, engineering)
date: 2026-05-22
owner: Saskia (Head of Global Markets) · Tomas (Payments & settlement engineer, engineering)
status: POPULATED
policy-cited: >
  Policies/trade-confirmation-affirmation-policy-v1.md;
  Policies/trading-mandate-v1.md;
  Policies/payments-settlement-policy-v1.md
system-capability: >
  @trading/oms · @trading/confirmation-dispatch (PLANNED) · @trading/confirmation-tracking (PLANNED) ·
  @settlement/strate-gateway · @platform/event-store · @platform/escalation
---

# Procedure — Trade confirmation and affirmation (JSE-listed bonds, equities, and exchange-traded products)

**Procedure ID:** PROC-MK-CONF-01
**Owner:** Saskia (Head of Global Markets) · Tomas (Payments & settlement engineer, engineering)
**Approval:** BRC (under Trade Confirmation and Affirmation Policy v1 + Trading Mandate v1)
**Cadence:** Continuous (per trade executed); daily reconciliation at EOD; T-1 settlement reminder sweep
**Version:** v1.0 — 2026-05-22
**Status:** POPULATED

> **Scope note.** This procedure covers JSE-listed government and corporate bonds (Debt segment), JSE equities, and other exchange-traded products executed on JSE-operated venues. It does **not** cover OTC derivative confirmation — that is governed by [`otc-confirmation.md`](otc-confirmation.md) (PROC-MK-ODP-06). Repo booking is covered by [`repo-booking.md`](repo-booking.md).

---

## 1. Source policy

The obligation chain for this procedure:

```
JSE Rules (Equities + Debt segments) — trade matching / confirmation obligation
STRATE Rules and Directives — CSD settlement instruction requirements
FMA 19 of 2012 s.35 — settlement finality, instruction gatekeeping
Banks Act 94 of 1990 Reg 29 — large-exposure / counterparty limit applicability
  → Trade Confirmation and Affirmation Policy v1 (Policies/trade-confirmation-affirmation-policy-v1.md)
  → Trading Mandate v1 (Policies/trading-mandate-v1.md) — execution authority and product scope
  → Payments and Settlement Policy v1 (Policies/payments-settlement-policy-v1.md) — settlement instruction gate
    → PROC-MK-CONF-01 (this procedure)
      → @trading/oms · @trading/confirmation-dispatch (PLANNED) · @trading/confirmation-tracking (PLANNED)
        → @settlement/strate-gateway · @platform/event-store
```

This procedure operationalises §3 (confirmation SLA), §4 (affirmation monitoring), §5 (dispute resolution), and §6 (settlement gate) of the Trade Confirmation and Affirmation Policy v1.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| JSE Rules — Equity Market Rules §4 | JSE matching engine matches all on-exchange trades electronically; matched trades are automatically confirmed; the bank is bound by the matched terms as the authoritative record. |
| JSE Rules — Debt Market Rules §6 | Bonds traded on the Debt segment may be matched electronically via the JSE order book or executed bilaterally (voice/chat); voice-executed bonds require bilateral confirmation with the counterparty before settlement instructions may be submitted. |
| STRATE Rules and Directives — Rule B.1 | Settlement instructions to STRATE's CSD may only be submitted for trades that have been confirmed and matched; unconfirmed trades cannot be settled through the CSD. |
| FMA 19 of 2012 s.35 | Settlement finality protections apply only to instructions that have entered the CSD settlement cycle; instructions for unmatched / disputed trades must be withheld pending resolution to avoid irrevocable settlement of incorrect terms. |
| Banks Act Reg 29 | Each confirmed trade creates or modifies a counterparty exposure; the confirmation event must be visible to the credit-limit engine (PROC-RISK-CLM-01) before settlement instructions are generated. |
| ECTA s.11 | Electronic confirmation messages and structured email affirmations are legally valid and binding; the procedure relies on ECTA compliance for bilateral bond confirmations dispatched electronically. |

---

## 3. Purpose

1. Ensure that every bond, equity, and exchange-traded product trade executed by the bank has a matched, authorised confirmation before any settlement instruction is generated to STRATE.
2. Prevent settlement fails arising from unmatched or disputed trade terms — a key operational risk in the JSE / STRATE settlement environment where T+3 (equities) and T+3 (bonds) settlement cycles leave limited time for resolution.
3. Provide an unambiguous event record (`TradeConfirmed`) that downstream systems — settlement gateway, credit-limit engine, GL posting engine — can rely on as the authoritative confirmed-trade signal.
4. Track all open confirmations in real time; detect unaffirmed voice-executed bond trades at T+0 close and escalate promptly so that disputes are resolved well before the settlement date.
5. Maintain an immutable, BLAKE3-hashed confirmation audit trail for regulatory inspection, counterparty dispute resolution, and Vera (internal audit engineer) continuous assurance.

---

## 4. Trigger

- **Primary — bond execution:** `BondTradeExecuted { tradeId, isin, nominal, price, settlementDate, counterpartyId, dealerRef, executionVenue }` — emitted by the OMS at trade execution.
- **Primary — equity execution:** `EquityTradeExecuted { tradeId, isin, quantity, price, settlementDate, counterpartyId, dealerRef, executionVenue }` — emitted by the OMS at trade execution.
- **Exception trigger:** `TradeConfirmationUnmatched { tradeId, reason, unaffirmedSince }` — emitted by the confirmation-tracking engine at T+0 close for any trade that has not reached `TradeConfirmed` status; triggers §5d affirmation monitoring escalation path.
- **Settlement-date reminder:** `SettlementDateApproaching { tradeId, settlementDate, hoursRemaining: 24 }` — emitted by the scheduler at T-1; triggers a sweep of all open confirmations approaching their settlement date and blocks settlement instruction generation for any trade not yet confirmed.

---

## 5. Steps

### 5a. Trade capture

On receipt of `BondTradeExecuted` or `EquityTradeExecuted`, the OMS records all material economic terms: ISIN, nominal / quantity, price, settlement date (T+3 for equities and JSE Debt segment bonds unless a different settlement date was agreed), counterparty identifier (LEI), dealer reference, and execution venue (JSE order book vs bilateral / voice). The trade is assigned a confirmation status of `PENDING`. The OMS emits `TradeCapturePending { tradeId, product: "bond" | "equity", executionVenue: "jse-electronic" | "bilateral-voice", confirmationStatus: "PENDING" }`.

Immediately on capture, the credit-limit engine (PROC-RISK-CLM-01) is notified via the event bus so that the pending exposure is reserved against the counterparty limit before the confirmation cycle completes.

### 5b. Electronic (JSE-matched) confirmation

For trades executed on the JSE electronic order book — all equities and order-book bonds — the JSE matching engine confirms matched trades automatically, typically within minutes of execution. The OMS polls the JSE trade confirmation feed or receives a push notification confirming the matched record.

On receipt of the JSE match confirmation, the OMS emits:

```
TradeConfirmed {
  tradeId,
  isin,
  confirmedTerms: { nominal, price, settlementDate, counterpartyId },
  source: "jse-electronic",
  confirmationRef,    // JSE match reference
  confirmedAt,
  materialTermsHash   // BLAKE3 hash of the full confirmed trade record
}
```

This event is the authoritative signal that the trade has been confirmed. The settlement instruction gate in §5f is satisfied by this event; Tomas (Payments & settlement engineer, engineering) proceeds to generate STRATE settlement instructions.

### 5c. Voice-trade bilateral confirmation

For bonds and any other products executed bilaterally by voice or electronic chat (not the JSE order book), automated exchange-level matching is not available. The confirmation must be effected bilaterally with the counterparty.

**Within T+0 + 2 hours of execution (hard SLA):** Tomas (Payments & settlement engineer, engineering) generates a structured confirmation message containing all material terms (ISIN, nominal, price, settlement date, counterparty details, SWIFT BIC / LEI, settlement account) and dispatches it to the counterparty via one of:
- SWIFT MT530 (bond confirmation) or SWIFT MT320 (depending on the product-type mapping in the Party register);
- Structured email with ECTA s.11-compliant electronic signature if the counterparty's documented preference (Party register `confirmationChannel` field) is email.

The dispatch is logged by emitting:
```
TradeConfirmationDispatched {
  tradeId, confirmationRef, dispatchedAt, channel, counterpartyId, materialTermsHash
}
```

**Counterparty affirmation deadline: T+0 close (17:00 SAST).**  The counterparty must affirm (return a signed / acknowledged copy, or acknowledge via their own SWIFT message) by T+0 close. On receipt of the counterparty affirmation, the OMS emits:
```
TradeConfirmed {
  tradeId,
  confirmedTerms: { nominal, price, settlementDate, counterpartyId },
  source: "bilateral-voice",
  confirmationRef,
  counterpartyAffirmationRef,
  confirmedAt,
  materialTermsHash
}
```

### 5d. Affirmation monitoring

The confirmation-tracking engine monitors the confirmation status of every open voice-executed trade continuously from execution until `TradeConfirmed` is received. At T+0 close, any trade that does not have a `TradeConfirmed` event in the store is treated as unaffirmed.

For each unaffirmed trade at T+0 close, the engine emits:
```
TradeConfirmationUnmatched {
  tradeId, isin, counterpartyId, nominalOrQuantity, price,
  settlementDate, dispatchedAt, unaffirmedSince, reason
}
```

Saskia (Head of Global Markets) is notified immediately via the escalation channel. Tomas (Payments & settlement engineer, engineering) also receives the notification to begin counterparty follow-up. The settlement instruction gate (§5f) remains blocked for all unaffirmed trades.

### 5e. Dispute resolution

On receiving a `TradeConfirmationUnmatched` notification:

1. Tomas (Payments & settlement engineer, engineering) contacts the counterparty directly — by telephone and written follow-up — to understand the nature of the disagreement: whether the counterparty has not yet responded (silent) or has identified a discrepancy in terms (active dispute).

2. For **silent counterparties** (no response): Tomas escalates via the counterparty relationship manager channel. If no response is received by T+1 09:00, the trade is reclassified as `DISPUTED` and Saskia (Head of Global Markets) leads the senior counterparty engagement personally.

3. For **active disputes** (counterparty has identified a discrepancy in terms): Tomas and Saskia (Head of Global Markets) compare the bank's OMS record with the counterparty's position. If the discrepancy can be resolved by reference to the execution record (voice recording, chat transcript), Tomas issues a corrected confirmation and the counterparty reaffirms. `TradeConfirmationResolved { tradeId, resolvedAt, resolvedBy, correctedTerms }` is emitted on resolution.

4. If the dispute is not resolved by **T+1 12:00 (noon SAST):** Saskia (Head of Global Markets) escalates jointly to Devon (Chief Operating Officer, governance) and Helena (Chief Risk Officer, governance). The trade remains held from settlement. Imani (legal-as-code engineer) is notified to review any GMRA, ISDA, or master-trading-agreement implications of the unresolved dispute. `TradeConfirmationDisputed { tradeId, disputedAt, escalatedTo, description }` is emitted.

5. The trade remains blocked from settlement instruction generation until either `TradeConfirmationResolved` or `TradeCancelled` is recorded.

### 5f. Settlement gate

**Settlement instructions to STRATE are generated only for trades that have a `TradeConfirmed` event in the event store.** This is an absolute gate enforced by the settlement gateway (`@settlement/strate-gateway`). The gateway queries the confirmation status of each pending trade before submitting instructions and rejects instruction submission for any trade not in `CONFIRMED` state. No override is available without a CEO-authorised emergency exception documented as a `Decision` event.

On passing the settlement gate:
- STRATE settlement instructions are generated by Tomas (Payments & settlement engineer, engineering) via the STRATE gateway.
- `SettlementInstructionSubmitted { tradeId, settlementDate, strateRef, submittedAt }` is emitted.

### 5g. Late affirmation

If a counterparty provides affirmation after T+0 close but before the STRATE T-1 instruction cut-off:
- The trade proceeds to confirmation and settlement instruction generation.
- `LateAffirmationReceived { tradeId, affirmedAt, source, counterpartyId }` is logged.
- The late affirmation is flagged in the weekly MI report (§8) and counts toward the unmatched-rate MI metric.
- No separate approval is required; Saskia (Head of Global Markets) is informed in the daily confirmation summary.

---

## 6. Reconciliation

**Events produced in the confirmation lifecycle:**

| Event | Trigger | Description |
|---|---|---|
| `TradeCapturePending` | OMS — trade execution | Trade captured; confirmation pending |
| `TradeConfirmationDispatched` | Tomas — voice trade | Bilateral confirmation dispatched to counterparty |
| `TradeConfirmed { source: "jse-electronic" }` | JSE match receipt | JSE order-book match confirmed |
| `TradeConfirmed { source: "bilateral-voice" }` | Counterparty affirmation received | Voice-trade bilateral confirmation complete |
| `TradeConfirmationUnmatched` | Tracking engine at T+0 close | Trade not confirmed by deadline |
| `TradeConfirmationDisputed` | Escalation at T+1 noon | Unresolved disagreement on terms |
| `TradeConfirmationResolved` | Dispute resolution | Agreed terms; confirmation proceeds |
| `LateAffirmationReceived` | Late counterparty response | Affirmation received after T+0 but before T-1 cut-off |
| `TradeCancelled` | Unresolvable dispute | Trade voided; positions reversed |

**Reconciliation checks (Vera asserts):**

- Every `BondTradeExecuted` or `EquityTradeExecuted` has a `TradeConfirmed` event before `SettlementInstructionSubmitted` — zero exceptions tolerated.
- Every `TradeConfirmationDispatched` for a voice trade has a downstream `TradeConfirmed`, `TradeConfirmationUnmatched`, or `TradeCancelled` — no silent open dispatches.
- `materialTermsHash` in `TradeConfirmed` must match the document held in the BLAKE3 document store — tamper-detection invariant.
- Every `TradeConfirmationUnmatched` has a downstream `TradeConfirmationResolved`, `TradeConfirmationDisputed`, or `TradeCancelled` within 24 hours — no stale unmatched records.
- `SettlementInstructionSubmitted` count for the day matches `TradeConfirmed` count (less any `TradeCancelled`) — settlement gate is airtight.

---

## 7. Exception handling

### Unresolved dispute at T+1

If a dispute is not resolved by T+1 close:
- Saskia (Head of Global Markets) and Devon (Chief Operating Officer, governance) determine jointly whether to cancel the trade or hold it pending further negotiation.
- If cancelled: `TradeCancelled { tradeId, cancelledAt, reason: "confirmation-dispute-unresolved", authorisedBy }` is emitted; OMS reverses the pending position; credit-limit reservation is released.
- If held beyond T+1: the settlement fail risk crystallises. Devon (Chief Operating Officer, governance) triggers PROC-OPS-SFBCP-01 (settlement failure BCP). Helena (Chief Risk Officer, governance) is notified of the operational risk event.
- Imani (legal-as-code engineer) reviews any GMRA / master-agreement implications — particularly any close-out netting rights — and advises within 4 hours of the escalation.

### JSE matching engine outage

If the JSE matching engine is unavailable and electronic confirmations cannot be received:
- Tomas (Payments & settlement engineer, engineering) monitors the JSE systems-status feed.
- All pending JSE-electronic trades remain in `PENDING` state; settlement instructions are blocked.
- Saskia (Head of Global Markets) notifies Devon (Chief Operating Officer, governance) if the outage extends beyond 2 hours during the trading day.
- When the JSE engine recovers, the confirmation feed is replayed and `TradeConfirmed` events are emitted for all matched trades. Back-dated timestamps (JSE match time) are used.
- If the JSE engine does not recover before the STRATE cut-off: Devon (Chief Operating Officer, governance) authorises a settlement deferral; the trade settles on the next settlement date. `SettlementDeferred { tradeId, originalSettlementDate, newSettlementDate, reason }` is emitted.

---

## 8. Reporting and management information

### Daily confirmation status

At EOD (17:30 SAST), the confirmation-tracking engine emits:
```
DailyConfirmationSummary {
  date,
  tradesExecuted,
  confirmedJseElectronic,
  confirmedBilateral,
  lateAffirmations,
  unmatched,
  disputed,
  cancelled,
  settlementInstructionsSubmitted
}
```

Saskia (Head of Global Markets) receives the daily summary automatically.

### SLA

- **Target:** 100% of trades confirmed (source: `TradeConfirmed`) by T+0 close.
- **Voice-trade SLA:** confirmation dispatched within T+0 + 2 hours of execution; counterparty affirmation received by T+0 close.
- **Unmatched rate KPI:** ≤ 0% unmatched after T-1 cut-off (zero settlement fails from confirmation gaps).

### Weekly MI

The weekly confirmation MI report (produced by Tomas, Payments & settlement engineer, engineering; distributed to Saskia and Devon (Chief Operating Officer, governance)) covers:
- Unmatched rate: unaffirmed trades as a % of total voice-executed trades.
- Late-affirmation count and breakdown by counterparty.
- Dispute count and average resolution time.
- Settlement deferrals caused by confirmation issues.

Persistent unmatched rates above 1% per week are escalated to Helena (Chief Risk Officer, governance) as a market-operations risk indicator and trigger a root-cause review.

---

## 9. Change control

- **Approval authority:** Saskia (Head of Global Markets) approves all changes to this procedure.
- **Co-approval:** Tomas (Payments & settlement engineer, engineering) co-approves any change that affects the settlement-instruction generation step or the STRATE gateway integration.
- **Mandatory review triggers:**
  - JSE Rule amendment affecting trade confirmation or matching requirements → 30-day mandatory review and update.
  - STRATE Directive change affecting settlement instruction requirements → 30-day mandatory review.
  - Regulatory action (PA, FSCA) relating to confirmation practices → immediate review.
- **Version control:** changes committed to the event store as `ProcedureRevised { procedureId: "PROC-MK-CONF-01", version, revisedBy, reason }` and recorded in §17 change log.

---

## 10. Evidence

| Artefact | Storage | Retention | Sensitivity |
|---|---|---|---|
| Confirmation messages (SWIFT MT530 / MT320 dispatched + counterparty reply) | Document store (BLAKE3-addressed, referenced from `TradeConfirmationDispatched` event) | 7 years (FAIS records; ECTA s.17) | Confidential — counterparty commercial data |
| JSE match receipts | Document store + OMS audit trail | 7 years | Internal |
| `TradeConfirmed` event chain | Event log (`@platform/event-store`) | Permanent (Principle 1) | Restricted |
| `TradeConfirmationUnmatched` / `Disputed` / `Resolved` events | Event log | Permanent | Restricted |
| Dispute correspondence (voice recordings, emails) | Document store + voice archive (PROC-MK-REC-01) | 7 years | Confidential |
| `DailyConfirmationSummary` events | Event log + confirmation register projection | 7 years | Internal |
| Weekly MI reports | RMS document store (`RecordFiled`) | 7 years | Internal |

---

## 11. Manual steps

The following steps currently require manual agent action and are named substrate gaps:

1. **SWIFT MT confirmation generation (step 5c):** Automated SWIFT MT530 / MT320 confirmation generation from OMS trade data is PLANNED (`@trading/confirmation-dispatch`). Until live, Tomas (Payments & settlement engineer, engineering) generates the SWIFT message manually from the OMS trade record and sends via the SWIFT interface. Substrate gap: `@trading/confirmation-dispatch` SWIFT MT generation module — owner: Tomas + Atlas.

2. **Automated affirmation tracking (step 5d):** The confirmation-tracking engine (`@trading/confirmation-tracking`) is PLANNED. Until live, Tomas (Payments & settlement engineer, engineering) maintains the affirmation status register manually and performs the T+0-close sweep. Substrate gap: `@trading/confirmation-tracking` — owner: Tomas + Anya.

3. **JSE electronic confirmation feed integration (step 5b):** The OMS integration with the JSE trade confirmation feed (automated polling or push) is PLANNED. Until live, Tomas (Payments & settlement engineer, engineering) manually checks the JSE post-trade data feed and records the JSE match reference in the OMS, triggering the `TradeConfirmed` event. Substrate gap: JSE electronic confirmation API integration — owner: Tomas + Atlas.

4. **Dispute escalation call (step 5e):** Saskia (Head of Global Markets) leads senior counterparty engagement for unresolved disputes personally by telephone. No automated escalation pathway for this step; it is an intentional human decision point.

5. **Trade cancellation (step 5e / 7):** Cancellation of a trade due to an unresolvable confirmation dispute requires explicit authorisation from Saskia (Head of Global Markets) and Devon (Chief Operating Officer, governance). This step is deliberately non-automatable.

---

## 12. Failure modes

| Failure mode | Detection | Initial response |
|---|---|---|
| Voice trade unconfirmed at T+0 close | `TradeConfirmationUnmatched` emitted by tracking sweep | Tomas follows up with counterparty immediately; Saskia notified |
| JSE matching engine outage | No JSE match confirmation received within 30 min of execution for order-book trade | Tomas monitors JSE feed; Saskia notified if > 2h |
| Counterparty disputes terms on bilateral confirmation | Counterparty responds with discrepancy notice | Tomas + Saskia compare execution records; corrected confirmation if warranted |
| Counterparty silent (no affirmation by T+0 close) | Affirmation tracking sweep at T+0 close; no response | Tomas escalates via relationship channel; Saskia leads T+1 09:00 senior call |
| Confirmation dispatch channel failure (SWIFT outage) | SWIFT delivery failure notification | Tomas switches to structured email channel; re-dispatches; `TradeConfirmationDispatched` event updated with new channel |
| STRATE settlement instruction submission rejected | STRATE gateway error response | Tomas investigates rejection reason; confirmation re-validated; Devon (COO) if systemic |
| Materialterms hash mismatch (tamper-detection) | Vera recon: `materialTermsHash` in `TradeConfirmed` vs document store | Tomas + Saskia freeze settlement; investigate; Helena (CRO) and Rashida (CISO, governance) notified |

---

## 13. Escalation

| Condition | Escalation path |
|---|---|
| Trade unaffirmed at T+0 close | Tomas → Saskia (immediate notification) |
| Dispute unresolved by T+1 noon | Saskia → Devon (COO) + Helena (CRO) jointly |
| Dispute unresolved by T+1 close / settlement fail risk | Saskia + Devon invoke PROC-OPS-SFBCP-01; Imani reviews GMRA implications |
| JSE engine outage > 2h during trading day | Saskia → Devon (COO); Devon authorises settlement deferral if required |
| Systemic confirmation failures (> 5% unmatched rate in a single session) | Saskia → Helena (CRO) + Devon (COO); BRC notification at next meeting |
| STRATE instruction submission failure — systemic | Devon (COO) → STRATE operations liaison; PA notification if material |

---

## 14. Cross-references

| Procedure | Relationship |
|---|---|
| [`markets/settlement-instruction-workflow.md`](../markets/settlement-instruction-workflow.md) | Downstream: settlement instructions generated only after `TradeConfirmed`; this procedure is a prerequisite |
| [`markets/csd-settlement-gateway.md`](../markets/csd-settlement-gateway.md) | Downstream: CSD gateway is the execution path for STRATE instructions gated by §5f |
| [`by-policy/otc-confirmation.md`](otc-confirmation.md) (PROC-MK-ODP-06) | Sibling: OTC derivative post-execution confirmation; entirely separate flow |
| [`by-policy/repo-booking.md`](repo-booking.md) | Sibling: repo booking procedure; repos have their own confirmation mechanics |
| [`operations/settlement-failure-bcp.md`](../operations/settlement-failure-bcp.md) (PROC-OPS-SFBCP-01) | Escalation target: invoked when a confirmation dispute results in a settlement-fail risk |
| [`by-policy/otc-dispute-resolution.md`](otc-dispute-resolution.md) (PROC-MK-ODP-07) | Reference: dispute-resolution framework; some overlap for voice-bond bilateral disputes |
| [`by-policy/credit-risk-limit-management.md`](credit-risk-limit-management.md) (PROC-RISK-CLM-01) | Prerequisite consumer: credit-limit engine reserves exposure on `BondTradeExecuted`/`EquityTradeExecuted`; the `TradeConfirmed` event settles the provisional reservation |
| [`by-policy/mandate-attestation.md`](mandate-attestation.md) (PROC-MK-MA-01) | Prerequisite: trading mandate attestation gate is a pre-trade check; this procedure handles post-execution confirmation |

---

## 15. Substrate gaps

| Gap | Description | Owner | Priority |
|---|---|---|---|
| SWIFT MT confirmation generation (`@trading/confirmation-dispatch`) | Automated generation and dispatch of SWIFT MT530 / MT320 confirmation messages from OMS trade data | Tomas + Atlas | PLANNED |
| Automated affirmation tracking (`@trading/confirmation-tracking`) | Real-time tracking of confirmation status per trade; T+0-close sweep; `TradeConfirmationUnmatched` emission | Tomas + Anya | PLANNED |
| JSE electronic confirmation API integration | OMS integration with JSE trade confirmation / matching feed for automatic receipt and processing of JSE match records | Tomas + Atlas | PLANNED |
| Multi-channel acknowledgement receipt parser | Inbound parsing of counterparty affirmation messages via SWIFT MT, email, and counterparty portal; automatic `TradeConfirmed` emission | Tomas + Atlas | PLANNED |
| Settlement gate automated enforcement (`@settlement/strate-gateway` confirmation check) | Hard gate in the STRATE submission pipeline that rejects instruction submission for trades lacking `TradeConfirmed` event | Tomas + Atlas | PLANNED |

---

## 16. Audit and assurance

**Vera (internal audit engineer) — continuous assurance:**
- Every `BondTradeExecuted` or `EquityTradeExecuted` has a `TradeConfirmed` event before any `SettlementInstructionSubmitted` event — zero-exception invariant; any violation is an immediate Vera P1 finding.
- Unmatched rate: `TradeConfirmationUnmatched` count / total voice-executed trades < 1% per week. Breaches are P2 findings.
- Every `TradeConfirmationDisputed` has a downstream resolution (`TradeConfirmationResolved` or `TradeCancelled`) within 48 hours; overdue disputes are P2 findings.
- `materialTermsHash` in every `TradeConfirmed` matches the corresponding document in the BLAKE3 document store — tamper-detection sweep run daily.
- `DailyConfirmationSummary` present for every trading day — continuity assertion.

**Thandiwe (Chief Audit Executive, governance) — quarterly review:**
- Sample testing of confirmation event chains (10% of voice-executed trades per quarter): end-to-end trace from `BondTradeExecuted` / `EquityTradeExecuted` → `TradeConfirmed` → `SettlementInstructionSubmitted`.
- Assessment of dispute-resolution quality: dispute log reviewed; resolution timeliness verified against §13 escalation thresholds.
- Late-affirmation trend analysis: persistent late-affirmation counterparties identified; recommendation to Saskia (Head of Global Markets) on relationship management actions.
- Regulatory alignment opinion: JSE Rule / STRATE Directive compliance; ECTA s.11 confirmation-dispatch practice.
- Annual opinion reported to the Interim Audit Forum (Owen chair).

---

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-22 | Saskia (Head of Global Markets) · Tomas (Payments & settlement engineer, engineering) | Initial POPULATED procedure: full 17-section procedure covering JSE electronic and bilateral voice confirmation flows; affirmation monitoring; dispute escalation; settlement gate; substrate gaps named; Vera recon assertions defined. |
