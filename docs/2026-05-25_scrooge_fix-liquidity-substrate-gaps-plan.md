# Fix liquidity substrate gaps

## Context

The liquidity risk substrate was substantially built in D-TREASURY-GAPS-WAVE1 (closed 2026-05-19). However, four gaps remain in the code and persona specs:

1. `runLiquidityProjection` in `platform/liquidity/projection.ts` defaults to `buildPhaseProvider` (returns empty arrays for all five horizons: T+0, T+7, T+14, T+30, T+90). No production caller uses this function — the data/analytics engineer's handler, the CRO's appetite-watch, and the dashboard all bypass it and call `getALMPositionSnapshot` + `computeLCR`/`computeNSFR` directly, duplicating the same 4-line pattern in three places.

2. `SettlementInstructionIssued` is unconditionally pushed to the `gaps[]` array in `getALMPositionSnapshot` (line ~554 of `alm-positions.ts`) regardless of whether `TradeBooked` events exist. T+2 securities settlement outflows — a real LCR denominator item per BA 325 — are not captured. The event type doesn't exist yet, but these outflows *can* be derived from existing `TradeBooked` events (buy-side cash out at settlement date) minus `TradeSettled` events (already settled).

3. `Team/Ravi.md` §16 was last reviewed 2026-05-14 and still shows ALM engine and collateral inventory substrate as "designed; not yet built" — both were closed in wave-1 on 2026-05-19.

4. `runtime/agents/eitan-liquidity-snapshot.ts` substrate gaps section (lines ~264–282) hardcodes ALCO pack, ILAAP, and collateral inventory as "not yet built" — all three were closed 2026-05-19.

## Implementation plan

### Step 1 — Wire `runLiquidityProjection` to `getALMPositionSnapshot`

**File:** `prototype/platform/liquidity/projection.ts`

- Add a new exported function `makeEventStoreLiquidityInputProvider(eventStore: EventStore): LiquidityInputProvider` that implements `LiquidityInputProvider` by calling `getALMPositionSnapshot(eventStore, asOf, horizonDays)` for each of the four getter methods (hqlaPositions, fundingPositions, asfItems, rsfItems).
- Change `runLiquidityProjection` signature to accept an optional `eventStore` or an optional `LiquidityInputProvider`. When neither is passed and the global `eventStore` composition singleton is available, use it via the new provider. Retain the explicit `provider` parameter for tests (isolated stores).
- Remove `buildPhaseProvider` entirely — replace with the new event-store-backed provider as the live default.
- Add import of `getALMPositionSnapshot` from `../projections/alm-positions` and `EventStore` from `../event-store/store`.

**File:** `prototype/platform/liquidity/index.ts`

- Re-export `makeEventStoreLiquidityInputProvider` from `projection.ts` so callers can construct the provider with a test-isolated store.

**File:** `prototype/runtime/agents/anya-liquidity-projection.ts`

- Replace the inline `getALMPositionSnapshot` + `computeLCR` + `computeNSFR` calls with a call to `runLiquidityProjection(ctx.asOf)` (which now defaults to the live event-store provider). Extract the T+0 and T+30 results from `result.horizons`.
- Retain the `almT0.gaps` / `almT30.gaps` reporting in the deliverable.

### Step 2 — Derive settlement outflows from `TradeBooked` events (explicit `settlementDate` only)

Settlement date conventions differ by product (SAGB T+3, FX spot T+2, repo T+0/T+1, IRDs vary). The settlement date must come from the event payload — never computed from T+N arithmetic.

**File:** `prototype/platform/projections/alm-positions.ts`

- Add `buildSettlementOutflows(eventStore, asOf, horizonDays)` function:
  - Replay `TradeSettled` events up to `asOf` — collect settled trade IDs into a `Set`.
  - Replay `TradeBooked` events up to `asOf` — for each event:
    - Extract `settlementDate` from `event.payload` if present (typed as `string | undefined`). If absent, **skip the trade** — do not infer any settlement convention. The gap for trades without explicit `settlementDate` remains.
    - For unmatched buy trades where `settlementDate` is present, falls within `[asOf, asOf + horizonDays]`, and `marketValueZar > 0`: push `FundingPosition { amountZar: marketValueZar, category: "wholesale-non-operational" }` (conservative BA 325 §23 contractual-maturity treatment).
  - Return `{ positions: FundingPosition[], count: number, skippedNoDate: number }`.
- In `getALMPositionSnapshot`:
  - Call `buildSettlementOutflows` and merge positions into `fundingPositions`.
  - Change the `SettlementInstructionIssued` gap push from **unconditional** to **conditional**:
    - If `count > 0`: replace with informational note — `"SettlementInstructionIssued: ${count} pending trade(s) with explicit settlementDate included in LCR outflow. ${skippedNoDate} trade(s) skipped (no settlementDate in payload). Full event class remains a deferred gap for non-trade contractual outflows."`
    - If `count === 0` (no `settlementDate`-bearing buy trades in horizon): retain the unconditional gap push as before.
- **Note for trade-booking handlers**: the `TradeBooked` schema (`markets-trading-extended.ts`) is a passthrough schema with `settlementDate` as an optional field. Existing bond-accounting and IRD-accounting schemas already carry it. New bookings for SAGB, FX, and repo should pass `settlementDate` explicitly; this wiring motivates that discipline without mandating it retroactively.

### Step 3 — Update stale persona spec

**File:** `Team/Ravi.md` §16 (treasury/ALM engineer's persona spec)

Update the Substrate gaps section (last reviewed 2026-05-14) to:
- Mark "ALM engine" as ✅ closed 2026-05-19 (mirrors the Treasurer's entry).
- Mark "Collateral inventory substrate" as ✅ closed 2026-05-19 (HQLA classifier + inventory projection live).
- Retain remaining open gaps: FTP engine (indicative rates only; live market-data feed deferred), FTP curve sources, SAMOS interface (operations & payments engineer + treasury/ALM engineer; pre-licence mandatory), hedge-accounting integration, and the partial `SettlementInstructionIssued` / `BalanceSheetProjected` ALM gaps now partially addressed by this PR.
- Add a §17 change log entry: `v1.2 | 2026-05-25 | treasury/ALM engineer (via Scrooge) | §16 updated: ALM engine + collateral inventory gaps closed per D-TREASURY-GAPS-WAVE1 (closed 2026-05-19). SettlementInstructionIssued gap partially closed — T+2 settlement outflows now derived from TradeBooked events.`

### Step 4 — Update stale handler substrate-gaps section

**File:** `prototype/runtime/agents/eitan-liquidity-snapshot.ts` (lines ~264–282) (Treasurer's handler)

Update the hardcoded "## Substrate gaps (build-phase)" section to:
- Mark ALCO pack as ✅ closed 2026-05-19.
- Mark ILAAP engine as ✅ closed 2026-05-19.
- Mark Collateral inventory substrate as ✅ closed 2026-05-19.
- Retain "FTP curve generator — not yet built (live market-data feed deferred to vendor-selection). Owner: treasury/ALM engineer + data/analytics engineer."
- Add note for `SettlementInstructionIssued` partial closure.

### Step 5 — Tests

**File:** `prototype/platform/liquidity/__tests__/projection.test.ts` (new or existing)

- Test that `runLiquidityProjection(asOf)` called with no provider argument returns `no-positions` when the event store is empty.
- Test that `runLiquidityProjection(asOf)` returns live LCR/NSFR results when `TradeBooked` + `DepositTaken` events exist (construct a small isolated store, seed with one SAGB buy + one retail deposit).

**File:** `prototype/platform/projections/alm-positions.test.ts`

- Add test: when a `TradeBooked` buy event with `marketValueZar > 0`, `side === "buy"`, and **explicit `settlementDate` within the horizon** exists, `fundingPositions` includes the outflow and the `SettlementInstructionIssued` gap entry becomes the informational note.
- Add test: `TradeBooked` events without `settlementDate` are skipped and the gap remains unconditional.

## Critical files

- `prototype/platform/liquidity/projection.ts` — primary change: new provider + default wiring
- `prototype/platform/projections/alm-positions.ts` — T+2 settlement outflow derivation
- `prototype/platform/liquidity/index.ts` — re-export the new provider
- `prototype/runtime/agents/anya-liquidity-projection.ts` — simplify to `runLiquidityProjection` (data/analytics engineer's handler)
- `Team/Ravi.md` — update §16 + §17 (treasury/ALM engineer's persona spec)
- `prototype/runtime/agents/eitan-liquidity-snapshot.ts` — update substrate gaps section (Treasurer's handler)

## Reuse / existing utilities

- `getALMPositionSnapshot` (`platform/projections/alm-positions.ts`) — existing; the new provider wraps it
- `computeLCR` / `computeNSFR` (`platform/liquidity/lcr.ts`, `nsfr.ts`) — unchanged; called via `runLiquidityProjection`
- `eventStore` composition singleton (`platform/composition.ts`) — used as default in new provider
- `classifyHQLA` (`platform/collateral/hqla-classifier.ts`) — unchanged; already used in `alm-positions.ts`

## Verification

1. `cd prototype && bun run ci` — must pass with zero TypeScript errors and zero recon failures.
2. `bun run citation-gate` — zero violations.
3. Run `bun run prototype/runtime/agents/anya-liquidity-projection.ts` (dry-run) — confirm it exercises `runLiquidityProjection` and reports substrate gaps accurately.
4. Run `bun test prototype/platform/liquidity/__tests__/` — all pass.
5. Run `bun test prototype/platform/projections/alm-positions.test.ts` — all pass, including new settlement outflow test.
6. Grep for `buildPhaseProvider` — should be deleted, no remaining references.
