---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T06:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-M4-FX-SUB-DECISIONS, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted below; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-M4-FX-SUB-DECISIONS`
- **Title:** M4 FX foundation — three sub-decisions (backup correspondent identity · FinSurv URN curation cadence · primary FX venue at M4)
- **Action:** approve
- **Outcome:** Approved as drafted. All three sub-decisions accepted on the recommendations as authored by Saskia (Head of Global Markets, governance) + Kai (Trading-systems engineer):
  - **Sub-1 — Backup correspondent identity.** Devon (COO, governance) + Tomas (Operations & payments engineer) pick the named correspondent pair under their existing third-party-risk-governance and correspondent-connectivity mandates. Standard pattern: two CLS Settlement Members both holding SA correspondent relationships (typically one of {Standard Bank, FirstRand, Absa, Nedbank} as primary; one of the remaining three as backup; quarterly switch-test cadence). The named pair flows back into the dashboard as an informational record once contracted; Helena (Chief Risk Officer, governance)'s RAS B-cluster concentration line is calibrated against the named pair.
  - **Sub-2 — FinSurv URN curation cadence.** Wave-based (option 2). Mira (Compliance / RegTech engineer) curates the high-volume FinSurv categories first (current-account, capital-account); long-tail categories accept `[citation: TBC]` until commencement-of-trading; URNs upgrade as flows materialise. Substrate-side `[citation: TBC]` is already an accepted Principle-2 pattern; build-phase rehearsal value preserved.
  - **Sub-3 — Primary FX venue at M4.** OTC-first. Institutional FX (Saskia's franchise) is dominantly OTC bilateral; M4 foundation slice is substrate-complete without an electronic-venue connector. Electronic-venue selection (EBS / Refinitiv FXall / Bloomberg FXGO) is M5+ franchise-pull when client volume justifies the FIX-gateway threat-model + connector engineering. JSE-listed FX futures remain out-of-scope for M4 (different product family).
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "go with m4 recommendations" — chat-intake 2026-05-09.
- **Source proposal:** `Owner Inbox/2026-05-09_saskia-kai_m4-sub-decisions.md`
- **Authority chain:** Extends `D-MARKETS-SCHEMA-FOUNDATION` (resolved 2026-05-07) under the M4 phase; sits downstream of the resolved D-FX-AD-STATUS / D-FX-CLS-MEMBERSHIP / D-FX-BOOK-BOUNDARY trio.
- **Follow-on routes recorded:**
  - `agent:Devon (COO, governance) + agent:Tomas (Operations & payments engineer)` — author the named-correspondent-pair proposal at M4 substrate-readiness; primary + backup; quarterly switch-test cadence; cite Directive 3 of 2018 (cloud-and-offshoring) and the operational-resilience policy. Outsourcing-due-diligence and Directive-3 PA-notification procedures populated ahead of M4 commencement-of-trading per the FX sub-decisions follow-on. Coordinate with Helena (Chief Risk Officer, governance) on the RAS B-cluster concentration line calibration.
  - `agent:Mira (Compliance / RegTech engineer)` — open the FinSurv URN cluster wave-1: current-account + capital-account categories curated under the existing register schema (URN format `urn:obligation:bank:mk:finsurv:<category>:v1` per the established pattern); long-tail categories logged as `[citation: TBC]` register entries with status `wave-2-deferred`. Coordinate with Zara (Chief Compliance Officer, governance) on the conduct line. Mira's curation cadence is already her own substrate task per `D-THIN-HUMAN-LAYER-MINIMUM` follow-on; this dispatch slots into that backlog.
  - `agent:Saskia (Head of Global Markets, governance) + agent:Kai (Trading-systems engineer)` — proceed with M4 substrate work under OTC-first; do NOT include electronic-venue connector engineering at M4. Open a placeholder M5+ decision card (`D-M5-FX-ELECTRONIC-VENUE-SELECTION`) at the appropriate cadence (when M5 client-volume signal materialises); not now.
  - `agent:Helena (Chief Risk Officer, governance)` — note: the RAS B-cluster concentration appetite line is calibrated against the named correspondent pair Devon + Tomas will propose; Helena reads back into Devon's named-pair proposal at substrate-readiness.
  - `agent:Eitan (Treasurer, governance)` — note: HQLA hedge funding via FX swaps continues to flow through the OTC-first posture; treasury substrate unchanged.
  - `agent:Anya (Data / analytics engineer)` — semantic-layer entries for the resolved `correspondent`-party identity field land once Devon + Tomas name the pair.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — this record is written directly to markdown under Principle 7 "steady-state vs current substrate" because Scrooge's `ceo-decision-record` runtime handler is invoked by chat-intake, not yet by orchestrator-direct-write. Atlas (Core banking platform architect) v1: typed-event substrate emits `CeoDecision` automatically when Scrooge writes the markdown.
2. **Follow-on-router auto-dispatch** — the `followOnRoutes` list is currently a human-readable record; in v1 the follow-on-router runtime handler reads the typed payload and chains the substantive work via event-driven fan-out (per the existing Provenance pattern from prior decision records).
3. **Default-if-no-decision wording** — the source card carries operationally-safe defaults that fired had no decision been made; the record-language could codify that explicitly so that absent-decision cases produce the same followOnRoutes payload as decided-as-recommended cases.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
