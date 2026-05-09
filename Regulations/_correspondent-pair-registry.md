---
title: Correspondent-pair registry — FX settlement nostros
authors:
  - Saskia (Head of Global Markets, governance)
  - Kai (Trading-systems engineer)
  - Atlas (Core banking platform architect)
date: 2026-05-09
source: D-FX-CORRESPONDENT-PAIR-NAMING (CEO approved 2026-05-09; PR #59)
proposal: Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md (PR #58)
---

# Correspondent-pair registry

Canonical, citable list of the correspondent banks the bank uses to clear
its FX counter-currency legs. The substrate seed at
`prototype/seeds/correspondent-pair.json` is a typed mirror of this
registry; the registry here is the authoring location and the substrate
seed is its derived form.

Per CLAUDE.md Principle 1 the routing decision is recorded as a typed
event on the `FxSettlementInstructed` payload (`correspondent` field);
the projection at `prototype/platform/markets/correspondent-routing.ts`
resolves the routing intent (`primary` / `backup` /
`switch-test-live-traffic`) to the named party identity using the rows
below.

## Active pair (as-of 2026-05-09)

| Tag       | Party                                  | Jurisdiction | LEI                                  | Correspondent / BIC code        |
|-----------|----------------------------------------|--------------|--------------------------------------|---------------------------------|
| primary   | Standard Bank of South Africa Ltd      | ZA           | `[citation: TBC pending Tomas LEI registration]` | `[citation: TBC pending Tomas BIC registration]` |
| backup    | FirstRand Bank Ltd (RMB)               | ZA           | `[citation: TBC pending Tomas LEI registration]` | `[citation: TBC pending Tomas BIC registration]` |

## Reserve list

| Tag       | Party        | Jurisdiction | LEI                  | Correspondent / BIC code |
|-----------|--------------|--------------|----------------------|--------------------------|
| reserve-1 | Absa Bank Ltd | ZA          | `[citation: TBC]`    | `[citation: TBC]`        |
| reserve-2 | Nedbank Ltd   | ZA          | `[citation: TBC]`    | `[citation: TBC]`        |

## Switch-test mechanics

- A quarterly + triggered switch test runs the backup leg with 5–10% of
  live traffic (configurable fraction). The window is opened by a typed
  `SwitchTestActivated` event and closed by `SwitchTestEnded`. A
  `SwitchTestReport` event is emitted at window-end with the observed
  fraction, latency, and breach indicators (per
  Devon (COO, governance) + Tomas (Operations & payments engineer)
  proposal §4).
- During an active window, the routing-policy projection routes a
  deterministic-by-`correlationId` fraction of `primary`-tagged
  intents via the `backup` correspondent. The fraction is configurable
  on the `SwitchTestActivated` event; `0%` is a no-override (sanity
  test); `100%` is permitted for full-failover scenarios per the
  proposal §4 trigger 1.

## Substrate gaps (open at v0)

- **LEI substrate** — Tomas (Operations & payments engineer) follow-on
  to register GLEIF LEIs and BIC codes against each row. v0 carries
  `[citation: TBC pending Tomas LEI registration]` placeholders.
- **Primary-vs-backup contract status check** — neither correspondent
  agreement is countersigned; Imani (Legal-as-code engineer) must
  confirm execution before live traffic flows. Captured as a follow-on.
- **RAS appetite-line breach detection** — if the active switch-test
  fraction strays outside the 5–10% appetite band, this is a breach;
  Helena (Chief Risk Officer, governance) + Rohan (Risk engineer) own
  the appetite line; the projection emits a `SwitchTestBreachRaised`
  signal in a follow-on slice. v0 records the fraction on every
  `SwitchTestActivated` payload so the breach test has the input it
  needs.

## Citation chain

- Source decision: D-FX-CORRESPONDENT-PAIR-NAMING (CEO approved
  2026-05-09; PR #59 record).
- Source proposal: Devon (COO, governance) + Tomas (Operations &
  payments engineer) named-correspondent-pair proposal (PR #58).
- Substrate event family: `FxSettlementInstructed`,
  `SwitchTestActivated`, `SwitchTestEnded`, `SwitchTestReport`
  (`prototype/platform/event-store/event-types.ts`).
- Projection: `prototype/platform/markets/correspondent-routing.ts`.
- Seed: `prototype/seeds/correspondent-pair.json`.
