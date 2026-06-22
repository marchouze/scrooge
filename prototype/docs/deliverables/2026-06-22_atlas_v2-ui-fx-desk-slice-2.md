# FX Desk V2 UI — visibility-remediation slice 2

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-06-22
**Authority:** D-V2-UI-VISIBILITY-REMEDIATION (CEO-approved 2026-06-22); D-V2-UI-OVERSIGHT-STANDARD (standing)
**Audience:** Marc (CEO)
**Status:** Delivered — page-wiring slice (Class A in the visibility audit).

> This markdown is a derived render of the canonical `RecordFiled` event (RMS Phase 3,
> registerKey `documents`). The content-addressed document store is canonical (D-RMS-PHASE-4);
> regenerate via `bun run file:atlas-v2-ui-fx-desk-slice-2`.

---

## 1. What shipped

The FX desk surface was already served end-to-end at `/api/v2/markets/fx/*` but the pages were
prose (`data-provenance-content="none"`, zero fetch). This slice wires four markets pages to the
served, name-free `/api/v2` layer, to the V2 human-oversight standard (four content types,
drill-through not modals, provenance badge + Prod/+Sim, honest empty states, seat Titles only).

| Page | Source endpoint(s) | Treatment |
|---|---|---|
| `v2/markets/fx.html` | `GET /api/v2/markets/fx` (aggregate surface) | FX desk hub — 4 metric tiles, 6 tables, per-panel provenance manifest |
| `v2/markets/fx-metric.html` | `GET /api/v2/markets/fx` | Metric drill-through — formula + constituents for P&L / net-position / capital-charge / VaR |
| `v2/markets/positions.html` | `GET /api/v2/markets/fx/blotter` | FIL position register (FX-scoped — see §3) |
| `v2/markets/instrument.html` | `GET /api/v2/markets/fx/blotter` | Per-instrument detail — economic terms (blotter row → here) |

No new API routes were added — the slice consumes the existing served endpoints. A small
`.v2-note` CSS rule was added to `_v2-shell.css` for muted scope/gap callout text.

## 2. Standard conformance

- **Key metrics:** four headline tiles (Unrealised P&L YTD, net-open-position charge, BA-320 FX
  capital charge, market-risk VaR), each drilling (click, no modal) to `fx-metric.html` which
  renders the **formula** (numerator/denominator → result) and the **constituent list**
  (per-currency net positions; per-currency P&L; VaR risk-factor breakdown). No dead-end tiles.
- **Tables:** blotter, counterparties, RAS §B3 headroom, NPA attestation, gateway rejections,
  and a per-panel data-provenance manifest. Blotter / positions rows drill to `instrument.html`.
  Honest empty states everywhere — never a blank that reads as zero.
- **Provenance:** every page declares `data-provenance-source` + carries a
  `[data-provenance-badge]`; fetches through `v2WireLoader`/`v2Fetch`; the Prod/+Sim toggle
  re-runs the loader and repaints the badge. Satisfies `recon:provenance-badge-coverage`.
- **Name-free:** desk-owner seat renders as "Head of Global Markets" (Title) via the `/api/v2`
  `seatTitle()` boundary; a grep of the FX response for roster names returns nothing.

## 3. Tracked substrate gaps

1. **Cross-asset FIL positions have no V2 read endpoint.** `positions.html` is honestly scoped
   to FX (the only FIL asset class served by `/api/v2` today). A cross-asset FIL read endpoint
   (IR / cash / bond instances) is needed; stated in-line as a scope note.
2. **No per-instrument read endpoint.** `instrument.html` sources economic terms from the live
   FX blotter. A dedicated instrument-detail endpoint serving per-instance mark-to-market
   valuation + replay-derived `FilInstrument*` event history is a follow-on; surfaced as a
   stated gap, not blank sections.
3. **`/api/v2/markets/fx/blotter` carries no `asOf` field** (only the aggregate surface does),
   so blotter-fed pages show "—" for as-of. Cosmetic.
4. **Gateway-rejections panel is honestly empty** — no V2 `V2FxOrderRejectedAtGateway` emitter
   ships yet; the V1→V2 emitter cutover is the upstream gap (D-FX-OTC-CLOSURE-BACKLOG). The page
   reads only the V2-native family and states the gap; never falls back to V1.

## 4. Verification

`bun run ci` green in full; `citation-gate` → 0. In-browser (headless, seeded store): FX desk
renders 3 live FX FIL instances (EUR/ZAR short, GBP/ZAR long, USD/ZAR long), four metric tiles
populated; the net-position tile drills to a formula block
(8% × max(Σ|long|, Σ|short|) = 1,115,200 ZAR) with per-currency constituents; a blotter row
drills to the USD/ZAR instrument detail; positions.html shows the FX register with the
cross-asset scope note; the Prod/+Sim toggle re-runs the loader cleanly with no console errors.
