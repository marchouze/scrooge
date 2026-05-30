# FX counterparty simulator — front-end trade-input driver

**Authority:** `D-FX-SIM-FRONTEND-INPUT-DRIVER` (CEO-approved 2026-05-30, session delegation).
**Workstream:** WS-FX-SIM-FRONTEND-INPUT.
**Owner:** Atlas (Core banking platform architect, engineering).

## Why this exists

A *3rd-party simulator* models an actor that lives **outside** the bank. For the FX
counterparty simulation the faithful realisation is therefore for that counterparty
to transact through the bank's **external web front-end** — `/trade-book.html` —
exactly as a real external party would, **not** through an internal `bookFxTrade`
function call.

This directory documents the agent-executable **browser-driver procedure**. It pairs
with the deterministic **param-generator**:

| Piece | Path | Role |
|---|---|---|
| Param-generator (the reusable "script") | `prototype/scripts/sim/fx-frontend-trade-specs.ts` | Emits N deterministic, `provenance=simulated` FX trade specs, each mapping 1:1 onto the trade-book form fields. |
| Browser-driver procedure (this doc) | `prototype/platform/simulation/fx-frontend-driver/README.md` | How an agent consumes the specs and drives the form via Claude-in-Chrome. |

The previous in-process auto-booking (`EnvSimEngine` trade loop → `executeFxTrade`
→ `bookFxTrade`) is **retired** so there is exactly **one** counterparty FX booking
path (CLAUDE.md "One dispatch path per scope"). See "What changed" below.

## Step 1 — generate the trade specs (deterministic)

Run from `prototype/`:

```bash
bun run scripts/sim/fx-frontend-trade-specs.ts --count 5 --seed 42
# optional pair restriction:
bun run scripts/sim/fx-frontend-trade-specs.ts --count 10 --seed 42 --pairs USD/ZAR,EUR/ZAR
```

Flags:

- `--count <n>` — number of specs (default 5).
- `--seed <int>` — seeded RNG (mulberry32). **Same seed → identical specs.** No
  `Math.random` / `Date.now()` in the generation draws (Principle 1 discipline). The
  only wall-clock field is `settlementDate` (T+2, always ≥ today, which the form
  requires).
- `--pairs <CSV>` — optional `BASE/QUOTE` filter (e.g. `USD/ZAR,EUR/ZAR`).

The generator **reuses** the existing simulation logic verbatim — `FxRateEngine`,
`SIM_COUNTERPARTIES`, `generateSimTrade` — so the specs are coherent with the live
sim. Every spec is tagged `provenanceMode: "simulated"`.

### Output shape

A JSON array; each element carries both the typed fields and a flat `formFields`
map keyed by the trade-book element ids:

```jsonc
{
  "productType": "fx",
  "provenanceMode": "simulated",
  "base": "USD",
  "quote": "ZAR",
  "side": "buy",
  "notionalAmount": 12.34,          // MAJOR units (minor / 1e6)
  "notionalCurrency": "ZAR",
  "rate": 18.50,                    // quote-per-base
  "settlementDate": "2026-06-01",   // >= today (T+2)
  "counterpartyName": "Standard Simulated Bank SA",
  "counterpartyLei": "SIMSAZA0000000001ZA",
  "traderRef": "sim:counterparty-fx-request",
  "formFields": {
    "tb-product": "fx",
    "provenanceMode": "simulated",
    "tb-base": "USD",
    "tb-quote": "ZAR",
    "tb-side": "buy",
    "tb-notional": "12.34",
    "tb-notional-ccy": "ZAR",
    "tb-rate": "18.5",
    "tb-settlement": "2026-06-01",
    "tb-cpty-select": "__other__",
    "tb-cpty-name": "Standard Simulated Bank SA",
    "tb-cpty-lei": "SIMSAZA0000000001ZA",
    "tb-trader-ref": "sim:counterparty-fx-request"
  }
}
```

## Step 2 — drive the form (agent + Claude-in-Chrome)

The browser-driving half is **necessarily an agent activity**: the Claude-in-Chrome
MCP tool is only callable by an agent, not by a headless server process. For each
spec, the agent navigates to `/trade-book.html` and applies the **validated field
map** below (confirmed live on the page), then submits.

### Validated field map (`/trade-book.html`)

| Spec source | Form control | Action |
|---|---|---|
| `formFields["tb-product"]` = `"fx"` | product-type `<select>` | select **"FX Spot"** (value `fx`). |
| `provenanceMode` = `"simulated"` | radio `name="provenanceMode" value="simulated"` | **set via `form_input(<simulated-radio-ref>, true)`** — see the booking-mode procedure below. **Do NOT** raw-click the input. |
| `base` | `#tb-base` | select base currency. |
| `quote` | `#tb-quote` | select quote currency. |
| `notionalAmount` | `#tb-notional` | type the amount. |
| `notionalCurrency` | `#tb-notional-ccy` | select notional currency. |
| `rate` | `#tb-rate` | type the spot rate. |
| `settlementDate` | `#tb-settlement` | type/set the date (must be ≥ today). |
| `counterpartyName` | `#tb-cpty-select` → `#tb-cpty-name` | select **"Other (type name)…"** (`value="__other__"`) to reveal `#tb-cpty-name`, then type the name there. |
| `counterpartyLei` | `#tb-cpty-lei` | (optional) type the LEI. |
| `traderRef` = `sim:counterparty-fx-request` | `#tb-trader-ref` | type the trader ref. |
| — | `#tb-form` submit ("Book Trade") | **submit.** |

### Booking-mode (provenance) selection — MANDATORY procedure

> **This step has a known defect trap. Follow it exactly.** Two simulated test
> trades (`MAN-1780135556707-A2F877A9`, `MAN-1780136862743-A7951042`) were booked
> tagged `production` because the documented "click the Simulated radio" step
> silently failed. They were reclassified after the fact by
> `scripts/cleanup-fx-frontend-driver-provenance-pollution.ts`.

The booking-mode control on `/trade-book.html` is a pair of **visually-hidden**
radios styled via `.tb-side-label`:

```html
<input type="radio" name="provenanceMode" value="production" checked>
<input type="radio" name="provenanceMode" value="simulated">
```

Because the `<input>` is visually hidden, a **raw browser click on the input does
NOT register** — the form stays on its default `production`. Do all four of the
following, in order:

1. **Set, do not click.** Select Simulated via
   `form_input(<simulated-radio-ref>, true)` — NOT a coordinate/element click on
   the hidden input. (Clicking the *visible label* also works; the hidden input
   does not.)
2. **Pre-submit gate (assert the `:checked` value).** Before submitting, run JS
   and require the result to be exactly `"simulated"`:

   ```js
   document.querySelector('input[name="provenanceMode"]:checked')?.value
   // must === 'simulated' — DO NOT submit otherwise; re-apply step 1 and re-check.
   ```

3. **The on-screen "BOOKING MODE: …" label is NOT a reliable indicator.** During
   validation it showed the *opposite* of the true checked state in both
   directions. **Trust the `:checked` radio value (step 2), never the label
   text.**
4. **Post-submit provenance verification.** After the `Booked: <tradeId> ·
   event: <eventId>` banner (below), confirm the **persisted event's provenance
   is `simulated`** before treating the booking as good — query the event store
   by the returned `event_id` (or by `tradeId`), e.g.:

   ```bash
   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
     sqlite3 "$BANK_EVENT_DB" \
     "SELECT json_extract(provenance,'\$.kind') FROM events WHERE event_id='<eventId>';"
   # must print 'simulated'. If it prints 'production', the booking is polluted:
   # reclassify with scripts/cleanup-fx-frontend-driver-provenance-pollution.ts
   # (after adding the new event_id to its target list) before proceeding.
   ```

   A `production`-tagged simulated test trade contaminates the production-only FX
   position / PnL / GL views and must be remediated, not left.

### Read back the confirmation

On success a green banner shows:

```
Booked: <tradeId> · event: <eventId>
```

Read it back as confirmation for each booked spec. (The live proof-of-chain booking
was `MAN-1780135556707-A2F877A9`, sub-second after the PR #912 per-booking wedge
fix.) Then run the **post-submit provenance verification** in step 4 above before
treating the booking as good.

### Suggested loop

1. `bun run scripts/sim/fx-frontend-trade-specs.ts --count N --seed S` → parse JSON.
2. For each spec: navigate `/trade-book.html`, apply the field map, submit, capture
   the `Booked: …` banner.
3. Report the booked tradeIds / eventIds back to Scrooge.

## Substrate gap (named, not hidden)

> Fully autonomous **unattended** browser-driven runs require an **agent runtime**: a
> Bun server process cannot invoke the Claude-in-Chrome MCP tool. Until that runtime
> lands, these runs are **agent-executed / Scrooge-coordinated**, not server-scheduled.

This is a **roadmap item, not a blocker** — it is the same substrate gap that applies
to every browser-driven agent activity in the build phase (Principle 6: autonomous by
default; humans/agents oversee the residual until the runtime substrate is complete).
The deterministic param-generator + this documented field map are exactly the reusable
mechanism an agent runtime would consume once it exists, so no rework is implied — only
the *invoker* changes (agent runtime in place of a Scrooge-coordinated run).

## What changed (retirement of the in-process path)

To avoid two live booking paths for the same scope:

- `dashboard/server.ts` — the `FxSimEngine` no longer receives an `executeFxTrade`
  callback; the in-process counterparty FX trade loop no longer auto-books through
  `bookFxTrade`.
- `platform/simulation/hub/adapters/env-sim.ts` — `makeCounterpartyFxRequestModule`
  no longer drives `engine.startTradeLoop` / `fireTrade`. Its `start`/`stop` are
  no-ops, its single fire action (`how-to`) returns front-end guidance, and its
  status surfaces the front-end input path + read-only internal-MM risk context.
- `dashboard/fx-sim-view.ts` — `POST /api/fx-sim/start` and `POST /api/fx-sim/stop`
  return **HTTP 410 Gone** with a pointer to this driver. `GET /api/fx-sim/status`
  remains for the read-only risk-monitor context.

The `bookFxTrade` GL/booking path itself is **untouched** (it was just fixed in
PR #912) — the front-end form still calls it exactly as a manual/real trade does;
the only change is that the *counterparty simulator* now reaches it through the
external web surface instead of an internal call.
