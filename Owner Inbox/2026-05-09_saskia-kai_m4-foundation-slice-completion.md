---
title: M4 FX foundation slice — completion brief
author: Saskia, Kai
date: 2026-05-09
summary: M4 foundation slice landed — four FX variants (Spot, Forward, Swap, NDF) with typed shapes, the bookType discriminator on FxTradeExecuted per D-FX-BOOK-BOUNDARY, and correspondent-routed FxSettlementInstructed per D-FX-CLS-MEMBERSHIP. No new schema primitives outside the additions named here. Substrate gaps and downstream dependencies named.
decision-required: false
---

# M4 FX foundation slice — completion brief

**Authors:** Saskia (Head of Global Markets — markets-side franchise) · Kai (trading systems engineer)
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:** Extension of `D-MARKETS-SCHEMA-FOUNDATION` (resolved 2026-05-07) under the M4 phase, with the FX sub-decisions (`D-FX-AD-STATUS`, `D-FX-CLS-MEMBERSHIP`, `D-FX-BOOK-BOUNDARY`, all resolved 2026-05-07) wired in.
**Source spec:** `Owner Inbox/2026-05-07_saskia-kai_fx-product-family.md` (canonical M4 scoping).
**Status:** **Substrate landed.** Foundation-slice schema and tests pass. Three sub-decisions surfaced separately as `D-M4-FX-SUB-DECISIONS` (`Owner Inbox/2026-05-09_saskia-kai_m4-sub-decisions.md`).

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer. It cites the FX product-family proposal, the FX sub-decisions, the markets architecture, and the obligations register entries (ORG-MK-08, ORG-EXCON-ODP-001). It authors no new substance.

---

## What landed in this slice

### Typed events

Two new typed event families under `prototype/platform/markets/cdm/fx.ts`:

- **`FxTradeExecuted`** — covers all four M4 in-scope variants via the `productTaxonomy` discriminator (`"FX-spot"` / `"FX-forward"` / `"FX-swap"` / `"NDF"`). The `bookType` discriminator (`"trading"` / `"banking-treasury"`) is **required** on every payload from M4 onwards per D-FX-BOOK-BOUNDARY. `currencyPair` carries both currencies at the type level (Principle 5). Cross-field validation enforces:
  - FX-Swap → exactly two legs (one `near`, one `far`).
  - Spot/Forward/NDF → exactly one `near` leg.
  - NDF → `settlementForm = "cash"`, requires `ndfFixingSource` and `ndfSettlementCurrency`.
  - Spot/Forward/Swap → `settlementForm = "physical"`.
  - Every leg's pay/receive currencies drawn from the trade's `currencyPair`.

- **`FxSettlementInstructed`** — settlement-instruction envelope. Per D-FX-CLS-MEMBERSHIP, the default `settlementPath` is `"correspondent"` (CLS-member correspondent bank settles via SWIFT MT202 / pacs.009); `"bilateral"` is the exception path. `correspondent` party is required when `settlementPath = "correspondent"`; the `messageStandard` enum covers the SWIFT MT3xx / ISO 20022 migration target.

Both factories enforce **at least one citation** on the envelope (Principle 2), accepting `[citation: TBC]` for in-flight URN curation.

### Schema bindings (extensions to existing primitives)

Under `prototype/platform/markets/cdm/primitives.ts`:

- **`currencyPairSchema`** — typed base/quote pair (ISO 4217 uppercase; rejects identical pair).
- **`bookTypeSchema`** — `"trading"` / `"banking-treasury"` discriminator per D-FX-BOOK-BOUNDARY.
- **`instrumentClassSchema`** extended with `"fx-forward"` and `"fx-ndf"` (was: `"fx-spot"`, `"fx-swap"` only).

The CDM barrel index (`prototype/platform/markets/cdm/index.ts`) re-exports the FX module.

### Tests

`prototype/tests/cdm-fx.test.ts` — 27 focused tests covering:
- Primitive validation (`currencyPair`, `bookType`, `fxProductTaxonomy`).
- Per-variant shape validation (Spot / Forward / Swap / NDF positive + negative cases).
- `bookType`-required enforcement (D-FX-BOOK-BOUNDARY).
- Cross-field rules (NDF requires fixing source + cash settlement; Swap requires near+far legs; leg currencies drawn from pair).
- Citation-slot enforcement (Principle 2: factories reject empty citations).
- Correspondent-vs-bilateral path discipline (D-FX-CLS-MEMBERSHIP).

All 42 CDM tests (15 pre-existing equity + 27 new FX) pass under `bun test`.

### Permission-policy entries — deferred to spec-driven derivation

The current substrate derives permission-policy from `AgentSpec.eventsEmitted` (see `prototype/platform/agent-identity/permission-policy.ts`); there is no manually-edited per-product permission file. The two new event types (`FxTradeExecuted`, `FxSettlementInstructed`) will flow into Kai's and Saskia's emit-allow-lists when their persona files declare them under §11 (events emitted) — that's persona-spec work, not foundation-slice work, and is left for the next M4 substrate increment under Atlas's permission-policy-publication runtime (A1.2).

This follows the Atlas A1.2 pattern: substrate-level event registry first, persona-spec emission declarations next, permission-policy publication third.

## What remains for M4

The foundation slice is necessary-but-not-sufficient for M4 substrate-completion. Outstanding work, by owner:

### Schema-layer (Saskia + Kai)
- **Event-store registry registration** — `prototype/platform/event-store/registry.ts` does not yet enumerate `FxTradeExecuted` / `FxSettlementInstructed` (it currently lists cross-cutting events; product-specific events go through their own factories with envelope validation only). When Atlas's A1.x widens the registry to subsume product-specific event-type schemas, the FX shapes should land there. **Substrate gap surfaced** — same pattern as `EquityTradeBooked` today.
- **FX-Swap composition helper** — Spot+Forward "make Swap" composition function (a Swap is structurally two atomic FX trades). Useful but not foundational; Kai picks up at M4 substrate-readiness.
- **NDF cash-settlement plumbing** — the fixing-event lifecycle (a `Reset { fixingType: "NDF-settlement" }` per FX product-family §4.4) is downstream of the foundation slice. The architecture commits to reusing the existing `Reset` event from the A0 freeze; Kai wires the NDF-specific flow at M4 substrate-readiness.
- **CLS / non-CLS settlement plumbing** — the actual SWIFT MT202 / pacs.009 message generation, correspondent-bank dispatch, and acknowledgement parsing are Tomas-domain. The M4 foundation slice provides the typed envelope; Tomas builds the operational integration.

### Citation chain (Mira + Zara)
- **FinSurv URN cluster** — see `D-M4-FX-SUB-DECISIONS` § D-M4-FX-SUB-2 for the curation cadence question. Wave-based curation recommended.
- **FX-specific JSE rule review** — Mira's M1 completion brief flagged "JSE FX-instrument rules to review at M4-start" — this is now M4-start. Mira reviews and adds any JSE-FX-rule URNs to the obligations register.
- **Excon Manual + ORG-EXCON-ODP-001 citation gate** — these obligations register rows already exist (PARTIAL / DRAFTING). Mira completes them at M4 substrate-readiness; the citation-gate pipeline asserts coverage.

### Settlement substrate (Tomas + Devon)
- **Primary + backup correspondent wiring** — the named correspondent pair is open (see `D-M4-FX-SUB-DECISIONS` § D-M4-FX-SUB-1). Devon owns the third-party-risk governance; Tomas owns the operational integration.
- **`outsourcing-due-diligence.md` procedure** — Devon-owned, planned. Required before correspondent goes live.
- **`directive-3-pa-notification.md` procedure** — Devon-owned, planned. Material correspondent for cross-border functions is notifiable to the PA under SARB Directive 3 of 2018.
- **Bilateral-settlement Herstatt-risk runbook** — Tomas-owned. Required for any non-correspondent path; the substrate accepts `settlementPath = "bilateral"` but the runbook gates operational use.

### Downstream agent dispatch
- **Bea IFRS classification dispatch** — Bea's IFRS classifier reads `bookType` + `productTaxonomy` and applies the per-variant treatment (FVTPL trading, FVTPL or designated-hedge banking-treasury). Joint with Camille for IAS 21 reporting-currency translation discipline.
- **Yael tax classification** — VAT treatment (largely exempt as financial services); deferred-tax on FX MTM (IAS 12); WHT considerations on FX-linked notes paid to non-residents.
- **Eitan funding implications** — FX swaps as HQLA-management tool (banking-treasury bookType); funding-currency-rotation cadence; HQLA-by-currency composition targets.
- **Rohan FX risk-factor coverage** — FRTB delta/vega/curvature for FX; SA-CCR FX add-ons; structural-FX banking-book monitoring.
- **Helena RAS B-cluster** — FX-pair limits + structural-FX appetite (joint with Eitan and Saskia); correspondent-concentration appetite line per D-FX-CLS-MEMBERSHIP cross-cutting follow-up.

## Substrate gaps named (not hidden)

Per Principle 7 — gaps are roadmap items, not things to hide:

1. **Event-store registry coverage of product-specific events** — `FxTradeExecuted` and `FxSettlementInstructed` (and `EquityTradeBooked`, `EquityCorporateActionApplied`, `EquitySettlementInstructed`) are not yet enumerated in `prototype/platform/event-store/registry.ts`. Validation happens at the factory boundary instead. Atlas-side substrate roadmap item.
2. **Permission-policy-spec coverage** — `eventSubscribeAllowList` and `registerWriteAllowList` are still derived as empty (per Atlas's note in `permission-policy.ts`); the parser doesn't yet expose §7 trigger or §11 register-write text. Atlas Wave-4 #11 substrate gap; the FX events inherit this gap.
3. **Currency-pair calendar service** — every FX schedule should resolve against the intersection of two currency-pair calendars; the M1 `cdmDateSchema` carries a single calendar tag. Anya-side substrate; required at M4 substrate-readiness.
4. **FX fixing-rate substrate** — SARB ZAR FixingRate (4pm SAST), WM/Refinitiv 4pm London, EMTA-published per-currency NDF fixings. Atlas's `MarketDataIngested` event covers the schema; the actual feed integrations are operational. Tomas-side / Atlas-side; required at M4 substrate-readiness for NDF fixing flow.
5. **`book-reclassification.md` procedure stub** — Owen-owned per D-FX-BOOK-BOUNDARY cross-cutting follow-up; the substrate accepts cross-book reclassification only via explicit `TradeAmended` event with full audit trail, but the procedural runbook is open.
6. **Hedge-accounting designation flow** — Bea + Camille joint deliverable for IFRS 9 hedge model; required when treasury starts using FX swaps to hedge banking-book FX exposure.
7. **Naming consistency between equity (`*TradeBooked`) and FX (`*TradeExecuted`)** — equity events (M1) shipped as `EquityTradeBooked`; FX events (M4) ship as `FxTradeExecuted` per D-FX-BOOK-BOUNDARY's prescription on `TradeExecuted` payloads. The naming divergence is consistent with the source documents but is a small substrate-grooming roadmap item — at some future increment, equity events should be renamed to `EquityTradeExecuted` for symmetry, or both should converge to a single discriminator-keyed `TradeExecuted` shape per the original A0 plan. Cosmetic, not blocking.

## Citation chain — this slice's coverage

Per Principle 6 (upward chain):

| Layer | Citation |
|---|---|
| Regulation | Currency and Exchanges Manual for Authorised Dealers (per D-FX-AD-STATUS); SARB FinSurv reporting (ORG-MK-08, ORG-EXCON-ODP-001); ISDA 1998 FX and Currency Option Definitions (FX product-family §5); CLS Bank rulebook (correspondent-routed via D-FX-CLS-MEMBERSHIP). |
| Policy | Excon Compliance Policy (planned — Eitan / Zara per ORG-MK-08); Funding Strategy Policy; OTC Trading Policy. |
| Procedure | `finsurv-reporting.md` (planned — Mira/Zara, FX product-family §6); `outsourcing-due-diligence.md` (planned — Devon); `directive-3-pa-notification.md` (planned — Devon); `book-reclassification.md` (planned — Owen). |
| System capability | This slice — typed `FxTradeExecuted` and `FxSettlementInstructed` events with discriminator-driven dispatch, citation-slot enforcement, and Principle-5 multi-currency typing. |

Citation slots that carry `[citation: TBC]` today (per Principle-2 norm):
- FinSurv URN cluster (per `D-M4-FX-SUB-DECISIONS` § D-M4-FX-SUB-2 wave-based curation).
- JSE FX-instrument rule URNs (Mira to populate at M4-start review).

## Verification

- `bunx tsc --noEmit` — clean.
- `biome check .` — clean.
- `bun test tests/cdm.test.ts tests/cdm-fx.test.ts` — 42 pass / 0 fail.
- `bun run recon:runtime-handler-sync` — 132 asserted / 0 violations.
- `bun run recon:agent-spec` — 29 asserted / 0 violations.
- `bun run recon:parallel-dispatch-divergence` — pre-existing warn (D-A22 sample window not yet met) only.

The two failing pre-existing tests in `tests/runtime.test.ts` (Vera overnight-recon) reflect main-branch state of the decision-event-reconciliation pipeline (8 resolved registry entries lack matching `CeoDecision` events in the store). These are unaffected by this slice.

---

—Saskia (markets-side franchise) · Kai (engineering)
