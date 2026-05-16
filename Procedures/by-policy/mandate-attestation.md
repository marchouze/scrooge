---
procedureId: PROC-MK-MA-01
title: Trading mandate attestation and limit compliance sign-off
author: Saskia (Head of Global Markets, governance) · Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Saskia (Head of Global Markets, governance) · Helena (Chief Risk Officer, governance)
status: POPULATED
policy-cited: Trading Mandate Policy (B5 — refining)
system-capability: "@platform/markets/mandate-attestation (PLANNED)"
---

# Procedure — Trading mandate attestation and limit compliance sign-off

**Procedure ID:** PROC-MK-MA-01
**Owner:** Saskia (Head of Global Markets, governance) · Helena (Chief Risk Officer, governance)
**Approval:** ALCO + BRC (Trading Mandate Policy B5)
**Cadence:** Pre-session (daily); intraday continuous monitoring; end-of-day sign-off
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Trading Mandate Policy (B5 — refining) — the bank's current version of the mandate framework governing per-product, per-counterparty, per-tenor, notional, and DV01 limits for all trading activity on JSE bonds/equities and OTC IRD.
- Risk Management Framework (RMF) — the parent framework; limit governance sits inside the RMF's trading-book risk chapter.
- Decision record: `D-MARKETS-SCHEMA-FOUNDATION` (CEO-approved) — establishes the markets substrate and positions this procedure as a load-bearing daily control.

The obligation chain:

```
Regulation (FMCA s.6 — ODP conduct; JSE Rules — member obligations; Banks Act s.73 — risk governance)
  → Trading Mandate Policy B5 (refining)
    → PROC-MK-MA-01 (this procedure)
      → @platform/markets/mandate-attestation (PLANNED)
        → Trading session execution
```

**Build-phase posture:** The substrate is being built now. Pre-session mandate checks during build phase are table-top exercises that test the procedure's logic but do not gate live trading. When live trading commences at licence-day, all steps become gate-enforcing and the `MandateAttestationEmitted` event must be confirmed before any order may be submitted.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-MK-01` (FMCA s.6 — ODP obligations) | ODP must operate within authorised mandate parameters; FSCA may inspect limit registers on demand. |
| `ORG-MK-02` (FMCA s.6 + CS 3/2018 §7) | ODP's trading book must be governed by documented limits; breaches must be reported to senior management and remediated. |
| `ORG-PR-03` (Banks Act s.73 — risk management governance) | The bank's board and senior management must set, monitor, and enforce risk limits; the limit register is a regulatory artefact. |
| `ORG-MK-JSE-01` (JSE Rules r.4 — member obligations) | JSE member banks must trade within their approved mandate; mandate changes require member notification. |
| `ORG-CS1-002` (Joint Standard 1/2022 — OTC margin) | Margin thresholds and notional caps flow from the mandate limit set; mandate attestation confirms limits are current before VM/IM calculations begin. |

## 3. Purpose

1. Confirm, before each trading session opens, that the bank's trading mandate limits (per product, counterparty, tenor, notional, DV01) are current, signed-off, and operationally active in the risk system.
2. Perform an automated limit-utilisation check against current positions so that the bank begins each session with accurate headroom visibility.
3. Emit a typed `MandateAttestationEmitted` event that serves as the event store's pre-session compliance record.
4. Monitor intraday limit utilisation continuously and alert on any breach threshold approach (80 % warning) or actual breach.
5. Execute an end-of-day sign-off confirming that no unresolved limit breach carried through session close.

## 4. Trigger

- **Primary (pre-session):** `TradingSessionOpenRequested { sessionId, sessionDate, desk }` — emitted by the session-management substrate each business morning before market open.
- **Intraday (breach approach):** `PositionUpdated { tradeId, desk, product, notional, dv01, counterpartyId }` — re-evaluated against current limits on every position change; 80 % utilisation threshold triggers an alert.
- **End-of-day:** `TradingSessionCloseRequested { sessionId }` — triggers the EOD sign-off step.
- **Mandate amendment:** `MandateLimitAmended { mandateVersion, amendedBy, effectiveAt, changeDetail }` — triggers an intraday re-attestation to confirm the new limits have propagated to the risk system.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On `TradingSessionOpenRequested`: pull the current mandate limit set from the risk limit register; confirm mandate version is B5 (or current approved version); confirm no superseding amendment is pending approval | `agent` (Ravi — market risk quant engineer) | `@platform/markets/mandate-attestation` (PLANNED) | If an amendment is pending approval (not yet signed by Helena), the session is held; Helena is notified immediately. |
| 2 | Run automated limit utilisation check: for each active product/counterparty/tenor bucket, compare current open positions (from the position store) against the mandate limit; compute utilisation % and remaining headroom | `agent` (Ravi) | `@platform/markets/mandate-attestation` (PLANNED) | Inputs: position snapshot at session-open T−10 min. Outputs: utilisation matrix per bucket. Any bucket already at or above 100 % at session open triggers step 3a. |
| 3 | If all buckets are below 80 % utilisation: emit `MandateAttestationEmitted { sessionId, sessionDate, mandateVersion, utilisationSummary, status: 'Clear', attestedAt }` | `agent` (Ravi) | `@platform/event-store` | This event is the gate for session open. |
| 3a | If any bucket is at or above 80 % utilisation at session open: notify Saskia (Head of Global Markets, governance) and Helena (CRO, governance); hold session open until Saskia provides an explicit `MandateBreachAcknowledged` instruction or the position is reduced | `agent` (notification) + `human` (Saskia + Helena — governance decision) | `@platform/markets/mandate-attestation` (PLANNED) | If the bucket is at 100 %+ (actual breach at session open), the session is not opened for that product/desk until the breach is remediated or Helena grants a time-limited override with a documented rationale. |
| 4 | On `TradingSessionOpenRequested` confirmation (after step 3): unlock order submission for the session across all cleared desks | `system` | `@platform/markets/mandate-attestation` (PLANNED) | The unlock is per-desk and per-product; a desk held under step 3a remains locked while others proceed. |
| 5 | **Intraday continuous monitoring.** On each `PositionUpdated` event: recalculate utilisation for the affected bucket; if utilisation crosses 80 % threshold: emit `LimitApproachAlert { sessionId, desk, product, counterpartyId, utilisation, headroom, alertedAt }` and notify Saskia | `agent` (Ravi) | `@platform/markets/mandate-attestation` (PLANNED) | Alerts are queued; Saskia acknowledges each alert. Unacknowledged alerts after 15 min auto-escalate to Helena. |
| 6 | If utilisation crosses 100 % (intraday breach): immediately emit `LimitBreachDetected { sessionId, desk, product, counterpartyId, breachAmount, detectedAt }`; halt new order submission for the breached bucket; notify Saskia + Helena within 5 min | `agent` (Ravi) | `@platform/markets/mandate-attestation` (PLANNED) + `@platform/event-store` | Breach is a material control event; it is escalated regardless of the breach magnitude. |
| 7 | On `LimitBreachDetected`: Helena (CRO, governance) performs a mandatory governance review; options: (a) direct immediate position reduction — trader executes; (b) grant a time-limited override (max 2h, documented rationale, ALCO notification); (c) escalate to ALCO for a mandate amendment | `human` (Helena — CRO, governance) | None — irreducible governance judgment | All three options produce a typed event: `BreachRemediationDirected`, `BreachOverrideGranted`, or `MandateAmendmentInitiated`. |
| 8 | **End-of-day sign-off.** On `TradingSessionCloseRequested`: rerun full limit utilisation check against final positions; confirm no open `LimitBreachDetected` events without a downstream `BreachRemediationConfirmed`; Saskia (Head of Global Markets, governance) reviews the EOD utilisation report | `agent` (Ravi — automated check) + `human` (Saskia — EOD review) | `@platform/markets/mandate-attestation` (PLANNED) | If any breach is unresolved at session close, Helena is notified immediately; the breach remains open on the breach register overnight. |
| 9 | Emit `MandateEodSignOffEmitted { sessionId, sessionDate, mandateVersion, finalUtilisationSummary, openBreaches, signedOffBy: Saskia, signedOffAt }` | `agent` | `@platform/event-store` | This event closes the session's mandate compliance record. |
| 10 | If `MandateLimitAmended` event is received intraday: validate that the new limits have propagated to the risk system (position store reflects new thresholds); emit `MandateIntraday​ReattestationEmitted { sessionId, newMandateVersion, propagationConfirmed, reattestAt }` | `agent` (Ravi) | `@platform/markets/mandate-attestation` (PLANNED) | Until `MandateIntradayReattestationEmitted` is confirmed, the system operates under the previous limit set to avoid a gap window. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Ravi (market risk quant engineer) | Operates `@platform/markets/mandate-attestation`; runs pre-session and EOD checks; emits typed events; fires alerts |
| Saskia (Head of Global Markets, governance) | Pre-session mandate currency confirmation; EOD sign-off; intraday alert acknowledgement; breach instruction (first responder) |
| Helena (Chief Risk Officer, governance) | Governance review on any `LimitBreachDetected`; override grant authority; escalation to ALCO; mandate amendment initiation |
| ALCO | Approves mandate amendments; reviews override-granted events; quarterly mandate adequacy review |
| Vera (internal audit engineer, governance) | Daily invariant check on open breaches; monthly attestation-completeness audit |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Bucket at 80 % utilisation at session open | Saskia + Helena notified; session held | Immediately |
| Bucket at 100 %+ at session open | Session held for that desk; Helena must act | Before order submission |
| Intraday breach (`LimitBreachDetected`) | Saskia (5 min) → Helena (15 min if unacknowledged) | Immediate |
| Helena override granted | ALCO notified within 30 min | Same session |
| Unresolved breach at EOD | Helena + ALCO notified; breach register remains open | EOD |
| Two or more breaches in a rolling 5-day window | ALCO convened; BRC briefed | Next business day |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/markets/mandate-attestation` | PLANNED | Limit-pull from risk register, utilisation calculation, alert dispatch, session lock/unlock |
| `@platform/event-store` | Live | Stores all typed mandate events |
| `@platform/markets/position-store` | PLANNED | Source of positions for limit utilisation calculation |
| `@platform/risk/limit-register` | PLANNED | Canonical limit set; mandate amendments update this register |
| `@platform/notify` | PLANNED | Alert dispatch to Saskia, Helena, ALCO |

## 9. Quality controls

- **Pre-session completeness:** `MandateAttestationEmitted` or `MandateBreachAcknowledged` must precede any `OrderSubmitted` event on each session. Vera asserts this invariant daily.
- **Breach dwell time:** No `LimitBreachDetected` event may remain without a downstream `BreachRemediationConfirmed` or `BreachOverrideGranted` for more than 2 hours within a session. Vera flags violations.
- **EOD coverage:** Every session must have a `MandateEodSignOffEmitted` event. Missing sign-off events are a Vera finding escalated to Helena.
- **Mandate version currency:** `MandateAttestationEmitted.mandateVersion` must match the current approved version in the limit register. Stale-version attestations are rejected.
- **Override audit:** Every `BreachOverrideGranted` is reviewed by Vera at month-end; three or more overrides in a quarter trigger a BRC briefing on mandate adequacy.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `MandateAttestationEmitted` (pre-session) | Event log | Permanent (Principle 1) | Per-session compliance record |
| `LimitApproachAlert` | Event log | 5 years (FMCA records) | Alert history for pattern review |
| `LimitBreachDetected` | Event log | 5 years | Breach register source event |
| `BreachRemediationDirected` / `BreachOverrideGranted` | Event log | 5 years | Helena's governance decision artefact |
| `MandateEodSignOffEmitted` | Event log | 5 years | EOD compliance record; Saskia's sign-off |
| `MandateIntradayReattestationEmitted` | Event log | 5 years | Intraday amendment propagation record |
| Breach register projection | `@platform/risk/breach-register` (PLANNED) | 5 years | Derived view of open and closed breach events |
| ALCO override notifications | Email / messaging record (via recording-retention procedure PROC-MK-REC-01) | 7 years (FAIS records) | If override communicated by message |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Saskia (Head of Global Markets, governance) · Helena (Chief Risk Officer, governance) | Initial POPULATED — pre-session mandate pull, automated utilisation check, attestation event, intraday breach alerts, EOD sign-off; 10-step workflow with typed events; breach escalation matrix. |
