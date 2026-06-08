---
title: RAS B2 — settlement-window (Herstatt) exposure measurement methodology
author: Helena (Chief Risk Officer, governance)
date: 2026-06-08
decision: D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY
authority: CRO
status: approved (CRO seat)
supersedes_card: requested card recorded 2026-06-07 (agent:rohan, instrument)
backing_brief: brief:helena:close-fx-gap-ratify-ras-b2-settlement-herstatt-m:2026-06-08
source_review: docs/2026-06-08_fx-functionality-domain-review.md (gap #5)
feeder: platform/projections/markets/limit-utilisation.ts (RiskCluster B2)
register: platform/risk/ras-appetite-register.ts (structured RAS register, D-RAS-STRUCTURED-REGISTER)
engineering_authority: D-RAS-B2-SETTLEMENT-EXPOSURE-FIX (CEO-approved 2026-06-07)
recon_gate: platform/recon/ras-cluster-feeder-coverage.ts (recon:ras-cluster-feeder-coverage)
---

# RAS B2 — settlement-window (Herstatt) exposure: measurement methodology

**Seat.** Helena (Chief Risk Officer, governance). Risk-appetite calibration is
CRO authority per the decision-authority routing table; the B2 measurement basis
is ratified under that authority. The engineering wiring it governs is already
CEO-approved (`D-RAS-B2-SETTLEMENT-EXPOSURE-FIX`, 2026-06-07).

**Naming caution (load-bearing).** Two distinct "B2" namespaces exist in the
substrate and MUST NOT be conflated:

- **RiskCluster B2** — the markets limit cluster *"Credit risk — settlement
  exposure"* (R100m ZAR limit, amber 70% / red 90%). **This is the subject of
  this methodology.** Feeder: `platform/projections/markets/limit-utilisation.ts`.
- **RAS appetite-register §B2 / `ras-b2-calibration.ts`** — the CET1 capital
  management-buffer line (RAS §B3 capital floor). Unrelated. Not in scope here.

This methodology governs **RiskCluster B2 only**.

---

## 1. What B2 measures — exposure definition

B2 measures **principal settlement risk (Herstatt risk)**: the exposure that
exists once the bank has **irrevocably delivered one leg** of an FX trade but has
**not yet received the counter-leg**. The loss event is the counterparty failing
between the bank's pay-leg becoming irrevocable and the bank's receive-leg
reaching finality — the bank's full delivered principal is at risk, not a
mark-to-market fraction.

**The window.** B2 exposure for a trade is OPEN over the interval:

> from **pay-leg irrevocability** (the bank can no longer recall its outgoing
> currency) **to receive-leg finality** (the counter-currency has landed with
> settlement finality).

**Trigger (open).** The window opens on either:
- a `PrincipalPayment{legKind:"deliver"}` for a trade whose `SettlementConfirmed`
  has not yet landed; OR
- an `FxSettlementFailed{failureKind:"one-leg-delivered", legStatus.payLegDelivered:true}`
  (the structured Herstatt-active signal: correspondent reports the bank's leg
  out, counterparty's leg unreceived).

**Amount.** The **delivered-leg notional** (principal, not a credit fraction).
For the failure branch where no `PrincipalPayment` captured the delivered leg,
the amount is the originating trade's **pay-leg notional**.

**Clear (close).** `SettlementConfirmed` for the trade (both legs settled with
finality) extinguishes the window. Confirmation means the counter-leg has landed
— Herstatt risk is extinguished.

**Distinction from B1 (no double-count).** B1 ("Credit risk — counterparty
exposure", R50m) is the **pre-settlement** counterparty credit add-on (10% of
notional), held *before any leg moves* and cleared on confirmation. B2 is the
**post-delivery, pre-receipt** principal-at-risk window. The two cover disjoint
intervals of the trade lifecycle and do not double-count:

| Window | Interval | Cluster | Basis |
|---|---|---|---|
| Pre-settlement | trade date → first leg moves | **B1** | 10% of notional (credit add-on) |
| Settlement (Herstatt) | pay-leg irrevocable → receive-leg final | **B2** | 100% of delivered principal |

---

## 2. Per-currency and per-counterparty measurement

**Per-currency.** B2 is accumulated **per delivered-leg ISO-4217 currency** in
major units (`b2SettlementByCurrency` in the feeder), then converted to
ZAR-equivalent at the delivered currency's `<CCY>/ZAR` market rate at read time
and measured against the **ZAR** B2 limit (R100m). This mirrors the B3 NOP
conversion (`computeB3Exposure` / `sumZarEquivalent`), removing the unit mismatch
where a foreign-currency notional would otherwise be compared raw against a ZAR
limit. A currency with no available rate contributes **0** rather than a raw-unit
figure (conservative on display, but see follow-on FO-2).

**Per-counterparty (methodology requirement; partial in feeder).** Herstatt loss
is a *counterparty* event — the relevant risk concentration is the bank's
aggregate delivered-but-unconfirmed principal **to a single counterparty** across
all open trades. The measurement basis is therefore **per-counterparty aggregation
of open-window delivered principal**, ZAR-converted. The current feeder
aggregates per-currency only and does not yet break the B2 line down by
counterparty. This is recorded as code follow-on **FO-1** (Rohan) — it is a
breakdown/visibility gap, not a measurement-correctness gap for the aggregate B2
limit, which the per-currency sum already computes correctly.

---

## 3. CLS-vs-non-CLS treatment (PvP eligibility) — the substantive methodology call

This is the determination the prior `requested` card did not make, and the core
of this ratification.

**Principle.** Settlement risk is **eliminated, not merely mitigated**, where the
trade settles on a **payment-versus-payment (PvP)** basis: under PvP, neither leg
settles unless both settle, so there is no interval in which the bank's principal
is out with the counter-leg unreceived. CLS (Continuous Linked Settlement) is the
canonical PvP mechanism. Per BCBS d226 (supervision of FX settlement risk), PvP-
settled trades carry **no Herstatt principal exposure**; only the **non-PvP
(bilateral / gross-settled)** tail carries it.

**Bank's posture (indirect participant).** Per the indirect-participant operating
posture and `platform/projections/markets/correspondent-routing.ts`:
- **ZAR** settles via SARB/SAMOS (RTGS, domestic) — not a cross-currency FX
  settlement leg; `herstattRisk: low`, zero Herstatt window for a ZAR-only RTGS
  leg.
- **USD / EUR / GBP / JPY** are routed `clsEligible: true` via CLS-member
  correspondents — **PvP-eligible → no settlement-window exposure when actually
  CLS-settled**.
- Any currency / pair **not** CLS-eligible, or a CLS-eligible pair that falls
  back to **bilateral** settlement (`flagBilateral: true`), settles **gross →
  full Herstatt principal at risk**.

**The measurement rule (target state).**

> For each open settlement window, B2 exposure =
> **0** if the trade settled (or is settling) PvP via CLS for both legs;
> **delivered-leg principal (gross, ZAR-converted)** otherwise (non-CLS, or
> CLS-eligible pair that fell back to bilateral settlement).

PvP eligibility is determined per trade from the settlement routing of *both*
legs: a window is PvP-offset only if **both** the delivered and the awaited leg
route through CLS (a one-sided CLS leg does not eliminate Herstatt risk on the
other). Where routing is unknown for a leg, the window is treated as **gross
at-risk** (conservative default).

**Current feeder state vs target — the DELTA.** The wired feeder computes B2
**gross for every open window** with **no CLS/PvP offset** — it does not consult
`correspondent-routing` CLS-eligibility and does not net PvP-eligible windows to
zero. This is a **deliberate, documented, conservative interim basis**: gross
over-states exposure (it never under-reports Herstatt risk), so it is safe to
operate and to limit against. The PvP-offset refinement is specified here and
flagged to Rohan as code follow-on **FO-2**.

---

## 4. Aggregation to the B2 RAS line + threshold basis

- **Aggregation.** Sum the per-window (per-currency, target-state per-PvP-status)
  ZAR-equivalent open-window delivered principal → single B2 `currentExposure`.
- **Limit.** **R100,000,000 absolute** ZAR (`limitName: "Credit risk —
  settlement exposure"`, `scripts/seed-ras-limits.ts`). Not a pct-capital line;
  not a Board/RAS Tier-1 limit. **No change to the limit value is made by this
  ratification** — see escalation guard, §6.
- **RAG bands.** amber at utilisation ≥ 0.70, red at ≥ 0.90 (`breachThresholdAmber`
  / `breachThresholdRed`), matching the published schedule. green below 0.70.
- **Continuity guarantee.** The recon gate `recon:ras-cluster-feeder-coverage`
  asserts B2 lights up for a one-leg-delivered (mid-settlement) trade, so the
  line can never silently regress to "declared-but-uncomputed" (the original
  blind spot).

---

## 5. CLS PvP model disposition — interim-gross, with tracked follow-on

There is **no full CLS PvP model in the build phase**, and this methodology does
**not** pretend one exists. The disposition is explicit:

- **Interim basis (live now): GROSS at-risk.** Every open settlement window
  contributes its full delivered principal to B2, with no PvP offset. This is the
  conservative basis and is what the feeder computes today.
- **Target basis (specified-not-built): PvP-offset per §3.** Requires the feeder
  to consult `correspondent-routing` (or, better, event-sourced
  `SettlementInstructionRouted` CLS-status per leg) and net both-legs-CLS windows
  to zero.
- **Tracked as follow-on FO-2** (below). The gap is the absence of a per-trade
  PvP-status signal in the settlement lifecycle that the feeder can fold; until
  the payments pipeline emits CLS-vs-bilateral settlement status per leg as an
  event, gross is both the honest and the safe basis.

---

## 6. Escalation guard — disposition

The brief's escalation guard requires CEO escalation **only if** the methodology
introduces a **new appetite threshold crossing a Board / RAS Tier-1 limit**. It
does not:

- The B2 limit (R100m absolute) is **unchanged** by this ratification.
- No tier reclassification; no new Board-level limit; no RAS Tier-1 cut.
- This ratifies the **measurement basis** for an existing, CEO-approved feeder
  and makes the conservative-interim (gross) treatment explicit.

**Conclusion: CRO self-ratification is in scope.** No CEO escalation. Recorded as
`Decision{phase:"approved", authority:"CRO"}`.

---

## 7. Feeder reconciliation result

Reconciled this methodology against the wired feeder
(`platform/projections/markets/limit-utilisation.ts`, `D-RAS-B2-SETTLEMENT-
EXPOSURE-FIX`):

| Methodology element | Feeder behaviour | Result |
|---|---|---|
| Window definition (deliver → confirm) | OPEN on `PrincipalPayment{deliver}` while not `SettlementConfirmed` | **MATCH** |
| Failure branch | `FxSettlementFailed{one-leg-delivered, payLegDelivered}` synthesises delivered notional | **MATCH** |
| Amount = delivered principal | delivered-leg notional (major units) | **MATCH** |
| Close on confirmation | `SettlementConfirmed` clears the window | **MATCH** |
| Per-currency, ZAR-converted vs ZAR limit | `b2SettlementByCurrency` + `sumZarEquivalent` | **MATCH** |
| B1/B2 no double-count | B1 pre-settlement credit; B2 post-delivery principal; disjoint | **MATCH** |
| **CLS/PvP offset** | none — gross for every window | **DELTA → FO-2** |
| **Per-counterparty breakdown** | per-currency only | **DELTA → FO-1** |
| Operating-book filter (prod + operator-sim only) | `eventInOperatingBook` gate | **MATCH** |

The aggregate B2 measure the feeder computes is **correct under the
conservative-interim (gross) basis** ratified here. The two deltas are
refinements (PvP offset; per-cpty breakdown), not correctness defects.

---

## 8. Code follow-ons (owning engineer: Rohan — Risk engineer, engineering)

I set methodology; Rohan implements. Two follow-ons, neither blocking this
ratification (the interim basis is live and safe):

- **FO-1 — per-counterparty B2 breakdown.** Add a per-counterparty aggregation
  of open-window delivered principal beneath the B2 line (mirroring the B3
  `perCurrency` breakdown), so the Herstatt concentration to any single
  counterparty is visible. Source: trade counterparty on the originating
  `FxTradeExecuted`. Priority: next-tick.

- **FO-2 — CLS/PvP offset (close the gross-over-statement).** Net both-legs-CLS
  settlement windows to zero per §3. Requires a per-leg CLS-vs-bilateral
  settlement-status signal the feeder can fold — ideally an event-sourced
  `SettlementInstructionRouted{clsEligible, flagBilateral}` per leg (Tomas's
  payments pipeline), not the static `correspondent-routing` seed. Until that
  signal exists, gross is retained as the documented interim basis. Priority:
  scheduled (substrate-dependent on the payments-pipeline CLS-status event).

---

## 9. Citations (Principle 2)

- `D-RAS-B2-SETTLEMENT-EXPOSURE-FIX` — engineering wiring (CEO 2026-06-07)
- `D-RAS-STRUCTURED-REGISTER` — structured RAS register (CEO 2026-06-08)
- `urn:reg:bcbs:d226` — BCBS supervision of settlement risk in FX (PvP / Herstatt)
- Banks Act 94 of 1990, Reg 39 — settlement-failure BCP / Herstatt
- `P1-EVENTS-ARE-TRUTH`, `P2-SINGLE-GRAPH-DISCIPLINE`
- RAS framework `RAS-FRAMEWORK-2026-05-06` (B-cluster limit schedule)
