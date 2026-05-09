---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T08:30:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-RAS-B-CLUSTER-CONCENTRATION-LINES, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-RAS-B-CLUSTER-CONCENTRATION-LINES`
- **Title:** RAS § B8a — FX-settlement-correspondent concentration appetite lines
- **Action:** approve
- **Outcome:** Approved as proposed by Helena (Chief Risk Officer, governance) + Rohan (Risk engineer) in PR #60. The five appetite lines below are now codified in the bank's Risk Appetite Statement and Framework as the binding concentration-management lines for the FX-settlement-correspondent posture under D-FX-CORRESPONDENT-PAIR-NAMING.
  - **L-B8a-1** Single-counterparty intraday FX-settlement notional: ≤ 97% steady-state / ≤ 99% switch-test window — `Hard`.
  - **L-B8a-2** Top-2 cumulative: ≤ 100% by design (observational); drift below 100% = `Critical` (signals an unsanctioned third correspondent).
  - **L-B8a-3** Switch-test window override (anchored on the typed `SwitchTestActivated` / `SwitchTestEnded` events from Saskia + Kai + Atlas's PR #64).
  - **L-B8a-4** Backup-readiness: last successful switch-test ≤ 100 days — `Hard`.
  - **L-B8a-5** Reserve correspondents (Absa, Nedbank): active-but-dormant — `Soft`.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "D-RAS-B-CLUSTER-CONCENTRATION-LINES approve" — chat-intake 2026-05-09.
- **Source proposal:** `Owner Inbox/2026-05-09_helena-rohan_ras-b-cluster-recalibration.md` (PR #60).
- **Authority chain:** Extends `D-FX-CORRESPONDENT-PAIR-NAMING` (resolved 2026-05-09; PR #59) → `D-M4-FX-SUB-DECISIONS` Sub-1 (PR #54) → `D-FX-CLS-MEMBERSHIP` (2026-05-07) → `D-MARKETS-SCHEMA-FOUNDATION` (2026-05-07). Sits at the *policy* layer of Principle 6's downward chain (governance-approved appetite); propagates downward to *standard* (the typed appetite-line schema), *process* (the Vera (Internal-audit / continuous-assurance engineer) recon harness that detects breach), and *presentation* (the obligations-dashboard surfacing the appetite-line state).
- **Rationale codified for the audit trail:** The lines are calibrated AT the structural ~95% / ~100% posture so that any drift fires a Vera continuous-controls finding rather than silently normalising. The intentional concentration is a structural feature of the indirect-participant operating posture (memory: `project_indirect_participant_posture.md`), not a risk-management failure — but the appetite line makes the structural rationale explicit so it is testable.

## Follow-on routes recorded

- `agent:Helena (Chief Risk Officer, governance)` — present the recalibration at the next BRC tick (Helena's BRC chair seat). Cite this decision record. The presentation closes the BRC-cadence loop on the appetite recalibration; do not re-litigate the lines themselves at BRC.
- `agent:Rohan (Risk engineer)` — promote the recon-harness stub from `TODO` to `IN_PROGRESS` against the typed `FxSettlementInstructed` event stream. v0 substrate-task: compute the rolling daily concentration from the event log, group by `correspondent` party, expose the four metrics (single-counterparty intraday max; top-2 cumulative; days-since-last-switch-test; reserve-correspondent activity-state) at `/api/ras/b-cluster`. The pattern is the backtest harness PR #27 + `dashboard-derivation-recon.ts`. Co-author with Atlas (Core banking platform architect) if the event-stream subscription substrate isn't ready.
- `agent:Vera (Internal-audit / continuous-assurance engineer)` — Wave-4 backlog item promoted from `proposed` to `approved`: B-cluster recon (`@platform/recon/ras-b-cluster.ts`) reads the four metrics from Rohan's harness and fires `RisingAppetiteBreach` typed events when the lines are crossed. Sits alongside the existing parallel-dispatch-divergence recon (Wave-4 #13b) under the same Wave-4 framework. Plan, do not implement now — sequence after Rohan's harness lands.
- `agent:Mira (Compliance / RegTech engineer)` — register row at `urn:obligation:bank:risk:b-cluster-fx-settlement-concentration:v1` (Helena + Rohan landed `ORG-PR-23` in PR #60 with status `DRAFTING`). Move status to `corporate-bind` now that the appetite lines are CEO-approved. Stack on or follow Mira's already-in-flight FAIS-Posture-A register PR.
- `agent:Atlas (Core banking platform architect)` — typed-event family on the appetite-side: `RisingAppetiteBreach` event type (payload: `{ ruleId, observedValue, hardLimit, asOf }`). Add to `prototype/platform/event-store/event-types.ts` once a clean window opens (currently busy on the FAIS event family + the routing-policy reconciliation against PR #49). Backlog item, not urgent.
- `agent:Anya (Data / analytics engineer)` — once Rohan's `/api/ras/b-cluster` surface lands, surface the four metrics on the obligations / risk-appetite dashboard tiles. Live-counts pattern (the `_refresh-controls.js` substrate from PR #51 already in place).

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring gap; Atlas v1.
2. **Real concentration computation from the event log** — Rohan's harness is a TODO; v0 substrate-task.
3. **`RisingAppetiteBreach` typed event** — Atlas v1 substrate-task; load-bearing for Vera's continuous-controls recon.
4. **Obligations / risk-appetite dashboard tile** — Anya pickup once the API surface lands; depends on PR #51's refresh substrate (already merged).
5. **BRC-presentation generator** — Owen (Company Secretary, governance)'s policy-pathway substrate; manual until generator lands.
6. **RAS version-control convention** — Owen substrate-stub owed; the appetite lines need a clear versioning trail so future recalibrations chain like the bank-name decision did (v1 → v2 → v3 supersession).

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
