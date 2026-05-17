---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T07:25:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-REGULATORY-READINESS-GATE-PLAN, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-REGULATORY-READINESS-GATE-PLAN`
- **Title:** Regulatory-readiness gate plan — top-3 workstreams for the licence-application package
- **Action:** modify
- **Source proposal:** [Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md)
- **Outcome:** Zara (Chief Compliance Officer, governance) + Helena (Chief Risk Officer, governance)'s pack approved with one modification: **W1 (AML/CFT-RMCP) approved, W2 (ICAAP/ILAAP/Recovery consolidated) approved, W3 (JS 1 of 2024 cyber-resilience) deferred.** Slices 1-3 of W1 and W2 authorised for immediate build under the Targeted budget per the no-pause rule. W3 cyber-resilience programme is filed as next-tranche; trigger TBD by Marc (CEO) — Senna (Security engineer) + Rashida (Chief Information Security Officer, governance) continue Principle 4 substrate-side security work without a gate-plan workstream wrapper for now.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "defer w3, approve w1 and w2" — chat-intake 2026-05-10.
- **Authority chain:** Standing CEO authority over regulatory-readiness sequencing. Implements obligations under Banks Act 94 of 1990 + Regulations Relating to Banks (W2: ICAAP/ILAAP/Recovery) + FIC Act 38 of 2001 + FATF Rec. 1 + FIC GN 7 (W1: RMCP). W3 (JS 1 of 2024 cyber-resilience) deferral is a sequencing call, not a substantive obligation deferral — the obligation continues to bind from Joint Standard's effective date; Senna + Rashida work continues to address it without the gate-plan wrapper.

## Follow-on routes recorded

- `agent:Mira (Compliance / RegTech engineer)` + `agent:Zara (Chief Compliance Officer, governance)` — W1 Slice 1 (RMCP attestable specification, pre-M2, ~1.5 sessions). Brief in `Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md` §3 W1 Slice 1.
- `agent:Helena (Chief Risk Officer, governance)` + `agent:Camille (Chief Financial Officer, governance)` — W2 Slice 1 (ICAAP/ILAAP/Recovery framework spec, pre-M2, ~1.5 sessions). Brief in pack §3 W2 Slice 1.
- W3 (Rashida + Senna cyber-resilience programme) — DEFERRED. Trigger to fire from CEO when the licence-application timeline crystallises or a cyber-resilience event compels it.

## Substrate gaps surfaced

None new. Pack §6 lists per-workstream substrate hooks; W1 + W2 Slice 1 are spec/framework documents requiring no new substrate.

## Change log

- 2026-05-10 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
