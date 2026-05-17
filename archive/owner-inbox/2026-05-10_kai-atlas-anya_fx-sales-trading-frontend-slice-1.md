---
title: FX sales & trading front-end Slice 1 — UI shell + counterparty picker
author: Kai (Trading systems engineer, engineering — reports to Saskia, Head of Global Markets) + Atlas (Core banking platform architect, engineering — UI shell) + Anya (Data / analytics engineer, engineering — projection / derivation)
date: 2026-05-10
summary: First slice of D-FX-SALES-TRADING-FRONTEND lands. New page at `/markets/fx/desk.html` reads `CounterpartyEligibilityScreened` / `Revalidated` / `Breached` events (Niko's institutional-eligibility screening v0 — PR #77) via a new `GET /api/markets/fx/counterparties` endpoint and renders only counterparties whose latest screening result is `institutional-eligible` AND whose latest event is not a `Breached`. Substrate-mode banner pinned to the top of the page per pack §3 J7. Launcher tile registered on `home.html` linking through to the desk page. Smoke test in `prototype/tests/markets-fx-desk-shell.test.ts` covers fold semantics (5 cases) + page-surface assertions (3 cases). RFQ form (Slice 2), pricer (Slice 3), risk-officer view (Slice 5), NPA badge (Slice 7) deliberately out of scope per pack §6.
decision-required: false
decision-id: D-FX-SALES-TRADING-FRONTEND-SLICE-1
decision-category: substrate-foundational
decision-owner: Kai (Trading systems engineer, engineering) + Atlas (Core banking platform architect, engineering) + Anya (Data / analytics engineer, engineering)
---

# FX sales & trading front-end Slice 1 — UI shell + counterparty picker

> **Standing authority:** `D-FX-SALES-TRADING-FRONTEND` (CEO-approved 2026-05-10). Slice authorisation: `D-FX-SALES-TRADING-FRONTEND-SLICE-1`. No new CEO decision required — this slice executes the substrate the parent decision authorised; per the no-pause rule, downstream slices of an approved decision dispatch without per-item CEO confirmation.
>
> **Pack:** [`Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md`](2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md), §6 row 1 + §12 (dispatch-ready brief).

## What landed

Slice 1 stands up the FX desk page, the counterparty-picker fold over Niko (Sales / CRM engineer)'s institutional-eligibility screening events, and the launcher tile on `home.html`. The page is read-only; no events are emitted from the UI in Slice 1.

### Files touched / created

| File | Status | Purpose |
|---|---|---|
| `prototype/dashboard/public/markets/fx/desk.html` | created | Slice-1 page shell — substrate-mode banner, counterparty picker table, next-slice placeholders, substrate trail. Reuses `_shell.css` / `_shell.js` / `_brand.css` (PR #52). |
| `prototype/dashboard/public/markets/fx/desk.css` | created | FX-namespaced styles — banner, picker table, placeholder cards. Layered on top of brand tokens. |
| `prototype/dashboard/public/markets/fx/desk.js` | created | Picker loader — fetches `/api/markets/fx/counterparties`, renders rows, registers a 30s poll via `_refresh-controls.js`, falls back to `setInterval`. |
| `prototype/dashboard/markets-fx-counterparties.ts` | created | Read-side projection over the three `CounterpartyEligibility*` event types. Per-counterparty latest-wins fold; surfaces only `institutional-eligible` AND not-currently-`Breached` rows. |
| `prototype/dashboard/server.ts` | extended | New `GET /api/markets/fx/counterparties` route returns the fold output as JSON. No new auth surface (read-only; same identity-stub posture as the rest of v0). |
| `prototype/dashboard/public/home.html` | (unchanged) | Markets section already exists. |
| `prototype/dashboard/public/home.js` | extended | New launcher tile `mkts-fx-desk` in the markets catalogue, linking to `/markets/fx/desk.html`. Existing `mkts-desks` tile re-titled "Trading desks (other)". |
| `prototype/tests/markets-fx-desk-shell.test.ts` | created | 5 fold-semantics tests (pass/fail, breach gating, breach-then-revalidation re-include, latest-revalidation surfaced, empty-store) + 3 page-surface assertions (HTML banner copy, asset existence, launcher-tile registration). |
| `prototype/scripts/record-d-fx-sales-trading-frontend-slice-1.ts` | created | One-shot CeoDecision-emitter; idempotent. |

### Eligibility-filter wiring

The picker reads from a single read-side fold (`buildCounterpartiesView`) over the event store:

1. Replay all events; keep only `CounterpartyEligibilityScreened`, `CounterpartyEligibilityRevalidated`, `CounterpartyEligibilityBreached`.
2. Per `counterpartyId`, hold three latest-of pointers: the latest screening (Screened OR Revalidated, by `payload.asOf`), the latest revalidation `asOf`, and the latest breach `asOf`.
3. Mark a counterparty `isBreached: true` iff a breach exists AND no revalidation has landed strictly after it.
4. Filter the picker output to `outcome === "institutional-eligible" && !isBreached`.

This mirrors pack §3 G1: a previously-passed counterparty re-enters the picker once a `Revalidated` lands strictly after the `Breached`. The semantics are exercised end-to-end by the smoke test (case 3).

### Page surface

- **Substrate-mode banner** pinned full-width above the shell layout — verbatim copy `BUILD MODE — SYNTHETIC DATA — NO REAL COUNTERPARTIES`, links to `D-INTERIM-OPERATING-POSTURE`. Static in Slice 1; once Atlas's composition-mode flag lands (pack §9 #1), the banner becomes dynamic.
- **Counterparty picker** — semantic table with `(Counterparty, Latest screening, Outcome, Asof, Evidence)` columns, sorted by `counterpartyId`. Empty-corpus state is rendered explicitly with a pointer to the synthetic-corpus substrate gap (§9 #6, lands in Slice 2).
- **Next-slice placeholders** — five `is-placeholder` cards naming each slice's surface and owner.
- **Substrate trail** — `<ul>` of cite-don't-rebuild references (event types, CDM, gateway, routing, shell, pack).
- **Substrate-gap callout** — pack §9 items 1, 2, 3, 5, 6 visible on the page.

### Launcher tile

`mkts-fx-desk` tile in the `markets` category on `home.html`, linking to `/markets/fx/desk.html`. The previously-placeholder `mkts-desks` (Trading desks) is renamed "Trading desks (other)" to make clear it covers equities/bonds/IRS, not FX. No layout restructure — single additive tile.

## Substrate gaps remaining (Slices 2–8)

Per pack §6 + §9. None block Slice 1.

| # | Gap | Slice that lands it |
|---|---|---|
| 1 | Composition-root mode flag (`build` vs `live`) — UI banner is currently static. | Atlas follow-on; pack §9 #1. |
| 2 | `RfqRequested` + `QuoteResponded` event types — queues behind RMS Slice 2 to avoid the three-way `event-types.ts` clash. | Slice 2 (after RMS Slice 2 lands). |
| 3 | RFQ intake form — Spot / Forward / Swap / NDF, fields per `cdm/fx.ts`. | Slice 2. |
| 4 | FX blotter projection — fold over `RfqRequested`, `QuoteResponded`, `OrderProposed`, `OrderApprovedAtGateway`, `OrderRejectedAtGateway`. | Slice 2. |
| 5 | Trader pricer + headroom panel against Helena's RAS B-cluster. | Slice 3. |
| 6 | Order acceptance + gateway-visualisation tiles. | Slice 4. |
| 7 | Risk-officer view (`markets/fx/risk.html`) — RAS utilisation, rejection feed, correspondent-routing tile. | Slice 5. |
| 8 | CEO oversight tile-deck card on `home.html`. | Slice 6. |
| 9 | NPA-attestation badge on the pricer (informational v1, gating v2). | Slice 7. |
| 10 | Vera UI-integrity recon — four assertions across emission gating, projection bit-identical re-derive, and `synthetic: true` carriage. | Slice 8. |
| 11 | Synthetic counterparty + RFQ corpus seed. | Slice 2 (FX-only). |
| 12 | Niko eligibility-projection read-API surface migrates from `dashboard/markets-fx-counterparties.ts` to a Niko-owned module at licence-day. | Niko activates at licence-day. |

## CI

`bun run ci` green from `prototype/`:
- `typecheck`, `lint`, `test` (smoke test passes), `citation-gate`, all recon harnesses.

## Authority + citations

- `D-FX-SALES-TRADING-FRONTEND` (CEO-approved 2026-05-10) — pack at [`Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md`](2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md).
- `D-INTERIM-OPERATING-POSTURE` (CEO-approved 2026-05-06) — rehearsal-only, no live trading until SARB licence.
- Niko (Sales / CRM engineer) institutional-eligibility screening v0 — PR #77; `event-types.ts` `CounterpartyEligibility*` family.
- Bank UI shell — PR #52 (`_shell.css`, `_shell.js`, `_brand.css`, `home.html`).
- CLAUDE.md Principles 1 (events as truth), 2 (citation discipline), 6 (single-graph), 7 (autonomous by default).

## Change log

- 2026-05-10 — Initial Slice-1 build. Authors: Kai (Trading systems engineer, engineering) · Atlas (Core banking platform architect, engineering) · Anya (Data / analytics engineer, engineering). Dispatched by Scrooge (Chief of Staff).
