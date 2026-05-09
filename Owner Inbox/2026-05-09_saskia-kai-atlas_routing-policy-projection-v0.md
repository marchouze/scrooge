---
title: Correspondent routing-policy projection v0 — completion note
author: Saskia (Head of Global Markets, governance) + Kai (Trading-systems engineer) + Atlas (Core banking platform architect)
date: 2026-05-09
summary: Routing-policy projection for the FX correspondent-pair (Standard Bank ZA primary; FirstRand-RMB ZA backup) with switch-test-live-traffic override mechanism, plus typed SwitchTestActivated / SwitchTestEnded / SwitchTestReport event family. Closes the D-FX-CORRESPONDENT-PAIR-NAMING substrate gap surfaced by Devon + Tomas in PR #58.
decision-required: false
---

# Correspondent routing-policy projection v0

Substrate slice that closes the gap surfaced when CEO approved
**D-FX-CORRESPONDENT-PAIR-NAMING** (2026-05-09; PR #59 record):
the named pair (Standard Bank ZA primary; FirstRand Bank Ltd / RMB ZA
backup) needed a projection that resolves the abstract "primary" /
"backup" tags to the specific party identities at FX-settlement-instruction
time, including the 5–10% live-traffic override during the quarterly
switch-test window per Devon (COO, governance) + Tomas (Operations &
payments engineer) PR #58 §4.

## What landed

### Projection

`prototype/platform/markets/correspondent-routing.ts` —

- `RoutingIntent` = `{ kind: "primary" | "backup" | "switch-test-live-traffic", correlationId, asOf }`.
- `ResolvedCorrespondent` = `{ party, requestedIntent, resolvedTag, overriddenBySwitchTest, switchTestWindowId, asOf, lei, correspondentBankCode }`.
- `resolveCorrespondent(state, intent) → ResolvedCorrespondent` is pure;
  given a state and an intent, the resolution is deterministic — replay
  from the event log reproduces the routing decision.
- Switch-test override: for `primary`-intent traffic during an open
  switch-test window, a deterministic-by-hash fraction
  (FNV-1a-32 on `windowId|correlationId`) of legs is overridden to
  `backup`. Same `correlationId` always lands on the same leg within a
  given window; replay-stable.

### Configuration source

Two-layer source-of-truth:

- **Canonical authoring location:** `Regulations/_correspondent-pair-registry.md`
  — the human-readable register that cites the source decision and
  carries the active pair, the reserve list, the switch-test mechanics,
  and the substrate-gap inventory.
- **Substrate seed:** `prototype/seeds/correspondent-pair.json` — typed
  mirror of the register, consumed by the projection at boot.

LEIs and BIC codes carry `[citation: TBC pending Tomas LEI registration]`
placeholders at v0 — Tomas's follow-on substrate slice will resolve
them against GLEIF.

### Switch-test event family

Typed in `prototype/platform/event-store/event-types.ts` and registered
in `prototype/platform/event-store/registry.ts`:

| Event-name             | Replay-fold       | Issuer | Purpose |
|------------------------|-------------------|--------|---------|
| `SwitchTestActivated`  | `pair-coupled`    | Tomas  | Opens a window with a configurable fraction in `[0, 1]` |
| `SwitchTestEnded`      | `pair-coupled`    | Tomas  | Closes the window opened by the matching `windowId` |
| `SwitchTestReport`     | `latest-wins-per-key` | Tomas | Emitted at window-end with observed fraction, leg counts, latency, breach indicator |

The routing decision lands on the **`FxSettlementInstructed.payload.correspondent`**
field — surfaced on the event (Principle 1) so downstream audit can
reconcile every instructed leg back to the routing-policy snapshot
that resolved it.

### FX CDM module

Because PR #49 (Saskia + Kai's M4 FX foundation) had not yet merged
when this slice landed, this PR also seeds `prototype/platform/markets/cdm/fx.ts`
with `FxTradeBooked` and `FxSettlementInstructed` shapes (consistent
with the equity CDM module pattern at `prototype/platform/markets/cdm/equity.ts`).
When PR #49 merges, the surfaces should be aligned by Kai in a
follow-on slice; the v0 contract here is intentionally minimal so
collisions stay small.

### Tests

`prototype/tests/correspondent-routing.test.ts` — **21 tests, all pass.**

Covers:

- Straight resolution of `primary` → Standard Bank ZA, `backup` →
  FirstRand-RMB ZA, with no switch-test window active.
- 5% switch-test fraction → ~5% override (within ±2pp of configured).
- 10% fraction → ~10% override.
- 0% fraction → zero overrides (sanity-test case).
- 100% fraction → full failover (allowed per proposal §4 trigger 1).
- Determinism: same `(windowId, correlationId)` always produces same
  routing decision.
- After `SwitchTestEnded`, `primary` intents resolve to `primary` again.
- `switch-test-live-traffic` intent always routes via backup.
- Schema rejection: fraction outside `[0, 1]` rejected.
- Idempotency: re-ending the same window is a no-op.
- `fractionBucket` salts on `windowId` (different windows → different
  fraction-bucket distribution per `correlationId`).
- Each typed-event factory validates its payload + envelopes correctly.
- `FxSettlementInstructed` factory accepts the resolved `correspondent`
  on the payload.

## Substrate gaps (open at v0)

1. **GLEIF LEIs and BIC codes** — Tomas (Operations & payments
   engineer) follow-on substrate slice. v0 carries `[citation: TBC
   pending Tomas LEI registration]` placeholders. The projection
   surfaces `lei` and `correspondentBankCode` on every
   `ResolvedCorrespondent` so downstream code can read them through
   the same shape once Tomas resolves the placeholders.
2. **Primary-vs-backup contract status check** — neither correspondent
   agreement is countersigned. Imani (Legal-as-code engineer) follow-on
   to confirm execution before live traffic flows. Once confirmed, the
   projection can publish a hardening seed flag and the build-phase /
   live-traffic gate can rely on it.
3. **RAS appetite-line breach detection** — Helena (Chief Risk Officer,
   governance) + Rohan (Risk engineer) own the appetite-line check
   that asserts the observed switch-test fraction falls within the
   5–10% appetite band. v0 records `appetiteBandBreached` on every
   `SwitchTestReport` payload so the breach test has the input it
   needs; the test itself is a Vera Wave-4 #20-ish recon-pipeline
   follow-on.
4. **PR #49 surface alignment** — when Saskia + Kai's M4 FX foundation
   merges (it had not merged at the time this slice scaffolded), the
   `FxTradeBooked` / `FxSettlementInstructed` shapes here may need a
   minor pass to align. Kai follow-on.
5. **FX CDM module barrel exports + permission-policy entries** — the
   permission-policy substrate at
   `prototype/platform/agent-identity/permission-policy.ts` is
   spec-driven (per-agent capability lists derived from §11 of each
   /Team/<Name>.md spec). FX-routing entries appear once Saskia + Kai's
   §11 (Outputs) declares the FX event names; today this slice exposes
   the typed events through the registry, which is what the
   spec-driven derivation reads.

## Branches and PR

- Branch: `claude/saskia-kai-atlas-routing-policy-projection-v0`
- PR: see PR url in the response from the agent run.

## Files

- `prototype/platform/markets/correspondent-routing.ts` — projection.
- `prototype/platform/markets/cdm/fx.ts` — FX CDM v0.
- `prototype/platform/markets/cdm/index.ts` — barrel export updated.
- `prototype/platform/event-store/event-types.ts` — switch-test event family.
- `prototype/platform/event-store/registry.ts` — registry rows.
- `prototype/seeds/correspondent-pair.json` — typed mirror seed.
- `Regulations/_correspondent-pair-registry.md` — canonical register.
- `prototype/tests/correspondent-routing.test.ts` — 21 unit tests.
