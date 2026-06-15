# Phase 3d — Credit-Limit / LEX Approval Registry on V2

**Authority:** `D-V1-REMOVAL-PHASE-3D` (CEO-approved 2026-06-15).  
**Engineering Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` (CEO-approved 2026-06-14).  
**Author:** Atlas (Substrate Architect, engineering).  
**Status:** Scaffold — detail will be filled in as implementation proceeds.

---

## 1. Scope

This phase lifts the **approval-registry slice** of the credit-limit / LEX engine onto the
V2 parallel path. Specifically, the three event types that determine the *current standing
state* of each counterparty's credit-limit approval:

| Event type | Role in approval registry |
|---|---|
| `CreditLimitApproved` | Sets the approved limit for a counterparty |
| `CreditLimitLoaded` | Confirms the limit is loaded into the risk engine (effective) |
| `CreditLimitWithdrawn` | Decommissions the limit |

The remaining 10 credit-limit event types (application, extension, analysis, ISDA/CSA
assessment, proposal, annual review, breach, breach-disposal, CRC exception, sub-IG
approval) are **audit-trail / governance flow** types. They do not contribute to the
snapshot shape that pre-deal checks and breach monitors consume. They remain `v1-only`
in this phase — a dedicated slice can lift them in Phase 3e+ when the full lifecycle V2
engine is built.

---

## 2. V2 trigger mapping (event-type level)

Each V2 variant adds `tenantId: TenantId` (from `v2-core/control-plane/tenant`) and
replaces bare integer `limit` fields with `MoneyWire` (decimal-native, major units).
All V2 types carry `schemaVersion: 2`.

### 2.1 CreditLimitApprovedV2

New V2 variant of `CreditLimitApproved`. Registry key changes:

- V1 payload: `limit: number` (minor-unit integer), `currency: string`
- V2 payload: `limit: MoneyWire` (`{ currency, amount: string }` in major units), `currency` field dropped (currency lives inside `MoneyWire`)
- Added: `tenantId: TenantId`, `schemaVersion: 2`
- Retained: `applicationId`, `counterpartyId`, `tenor`, `approvedBy`, `approvalAuthority`, `approvedAt`, `conditions`, `expiryDate`

### 2.2 CreditLimitLoadedV2

New V2 variant of `CreditLimitLoaded`.

- V1 payload: `limit: number` (minor-unit integer), `currency: string`
- V2 payload: `limit: MoneyWire`, `currency` field dropped
- Added: `tenantId: TenantId`, `schemaVersion: 2`
- Retained: `counterpartyId`, `loadedAt`, `effectiveFrom`, `loadedBy`

### 2.3 CreditLimitWithdrawnV2

New V2 variant of `CreditLimitWithdrawn`.

- V1 payload: no money fields — no `MoneyWire` migration needed
- Added: `tenantId: TenantId`, `schemaVersion: 2`
- Retained: `counterpartyId`, `withdrawnReason`, `withdrawnAt`, `withdrawnBy`

---

## 3. V2 approval-registry shape

```
Map<counterpartyId, {
  approvedLimit:      MoneyWire                                    // from CreditLimitApprovedV2
  loadedLimit:        MoneyWire | null                             // from CreditLimitLoadedV2 (null if not yet loaded)
  currentUtilisation: MoneyWire | null                             // placeholder: not computed by this slice
  breachStatus:       "active" | "breached" | "withdrawn" | null  // "withdrawn" from CreditLimitWithdrawnV2
  approvedAt:         string                                        // ISO-8601
  approvalAuthority:  CreditApprovalAuthority
  effectiveFrom:      string | null                                 // from CreditLimitLoadedV2
  expiryDate:         string | null                                 // from CreditLimitApprovedV2
  tenantId:           TenantId
}>
```

Fold rules:
- `CreditLimitApprovedV2` upserts by `counterpartyId`, sets `approvedLimit`, clears `loadedLimit` / `effectiveFrom` / `breachStatus`.
- `CreditLimitLoadedV2` sets `loadedLimit` + `effectiveFrom`, sets `breachStatus` to `"active"` if currently null.
- `CreditLimitWithdrawnV2` sets `breachStatus` to `"withdrawn"`.
- Latest event per counterparty wins for the same event family (approval always supersedes prior approval; load always supersedes prior load).

---

## 4. Parity strategy

The parity gate (`recon:credit-limit-v2-parity`) runs both sides over the same event store:

**V1 side** (fold over existing event types):
- Replay `CreditLimitApproved` → build approval-registry rows with `limit` as `{ currency, amount: minorToMajorString(limit) }`
- Replay `CreditLimitLoaded` → set `loadedLimit` similarly
- Replay `CreditLimitWithdrawn` → set `breachStatus = "withdrawn"`

**V2 side** (fold over new V2 event types):
- `computeCreditLimitRegistryV2()` reads `CreditLimitApprovedV2`, `CreditLimitLoadedV2`, `CreditLimitWithdrawnV2`

**Comparison** is `counterpartyId`-keyed registry snapshot, sorted by key. Fields
compared: `approvedLimit`, `loadedLimit`, `breachStatus`, `effectiveFrom`, `expiryDate`.

**Advisory status:** At Phase 3d the gate is advisory (`ok: true` even with warn violations)
because the dual-run engine is not yet wired into every approval path. The gate becomes
enforcing once `credit-limit-engine-v2.ts` is the sole emitter and V1 approval events are
retired. Advisory → enforcing promotion requires a CEO Decision.

---

## 5. Which event types need schemaVersion: 2 (money-field migration)

| Event type | Money fields migrated |
|---|---|
| `CreditLimitApprovedV2` | `limit` (integer → MoneyWire) |
| `CreditLimitLoadedV2` | `limit` (integer → MoneyWire) |
| `CreditLimitWithdrawnV2` | none (no money fields) |

The other registry types (`CreditLimitApplicationSubmitted`, `CreditLimitExtensionRequested`,
`CreditAnalysisCompleted`, `ISDACSAAssessmentCompleted`, `CreditLimitProposed`,
`CreditLimitAnnualReviewCompleted`, `CreditLimitBreached`, `CreditLimitBreachDisposed`,
`CrcLimitExceptionApproved`, `SubInvestmentGradeCounterpartyApproved`) remain `v1-only` in
this phase. They also contain money-bearing integer fields (`requestedLimit`, `proposedLimit`,
`exposure`, etc.) but those are audit-trail fields, not registry-state fields; they will be
lifted in a dedicated Phase 3e+ slice.

---

## 6. F-032 registration checklist

For each of the three new V2 event types:

1. **event-types barrel** (`platform/event-store/event-types/credit-limit.ts`): new Zod
   schema + factory function + add to `CREDIT_LIMIT_TYPED_EVENT_TYPES`.
2. **registry domain file** (`platform/event-store/registry/credit-limit.ts`): new row with
   `v2Status: "v2-parallel"`, `schemaVersion: 2`.
3. **provenance-category** (`platform/event-store/provenance-category.ts`): map each V2
   type name to `"counterparty"` (these are approval governance events for a counterparty's
   credit relationship — same category as the V1 counterparty events; they are simulated in
   build phase, so `counterparty` maps to `"simulated"` under the default policy, which is
   correct — approval events fire in sim scenarios until licence-day).

   Note: If `"governance"` were more appropriate (these are credit committee decisions),
   we map to `"governance"` (production). However, since the V1 registry marks these as
   `class: "audit"` (not `class: "governance"`), and they will be seeded in simulation
   scenarios, `counterparty` (simulated by default) is the correct category.

---

## 7. Ratchet impact

The V1 ratchet baseline is **585** `v1-only` types (as of 2026-06-15, after Phase 3a).

Adding three new `v2-parallel` types does NOT increase the `v1-only` count — new types
start as `v2-parallel`, not `v1-only`. The ratchet counts only `v1-only` rows; adding
`v2-parallel` rows leaves the count unchanged at 585 or lower. The ratchet gate
(`recon:v1-removal-ratchet`) will continue to pass.

---

## 8. Files produced

| File | Purpose |
|---|---|
| `prototype/docs/phase3d-credit-limit-v2-design.md` | This design doc |
| `prototype/platform/event-store/event-types/credit-limit.ts` | Extended: 3 new V2 schemas + factories |
| `prototype/platform/event-store/registry/credit-limit.ts` | Extended: 3 new V2 registry rows |
| `prototype/platform/event-store/provenance-category.ts` | Extended: 3 new EXACT mappings |
| `prototype/platform/credit-risk/credit-limit-engine-v2.ts` | NEW: V2 approval-engine (dual-run emitters + registry reader) |
| `prototype/platform/projections/credit-limit-registry-v2.ts` | NEW: V2 approval-registry projection (snapshot-cached) |
| `prototype/platform/recon/credit-limit-v2-parity.ts` | NEW: advisory parity gate |
| `prototype/scripts/run-recon-suite.ts` | Wire `recon:credit-limit-v2-parity` into infra suite |
| `prototype/package.json` | Add `recon:credit-limit-v2-parity` script |

---

## 9. Change log

| Date | Author | Change |
|---|---|---|
| 2026-06-15 | Atlas | Scaffold commit — design doc only |
| 2026-06-15 | Atlas | Implementation complete (all 8 files) |
