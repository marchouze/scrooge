---
title: "PartyKind counterparty-conflation fix"
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-12
decision-required: false
authority: D-PARTY-REGISTER (correction, no new decision required)
---

# PartyKind counterparty-conflation fix

## Summary

`"counterparty"` has been removed from `PartyKind`. The type is now a
three-value union:

```typescript
export type PartyKind = "natural-person" | "legal-entity" | "agent";
```

`"counterparty"` described a *relationship* (the bank's trading/business
relationship with an external organisation), not what an actor intrinsically
*is*. Institutional clients (asset managers, broker-dealers, correspondent
banks) are legal entities. They register as `"legal-entity"` with a
`counterparty-of` relationship edge recorded via `PartyRelationshipAsserted`.
Lifecycle status (`Sounding`, `Prospect`, `KycPassed`, `Active`, `Offboarded`)
is a `PartyClassified` classification — not a kind change.

## Files changed

### Core type substrate

| File | Change |
|---|---|
| `prototype/domains/party/types.ts` | Removed `"counterparty"` from `PartyKind` and `PARTY_KINDS`; removed `CounterpartyAttrs` interface; updated `KindAttributes` discriminated union (3 members, not 4); updated JSDoc comments |
| `prototype/domains/party/schemas.ts` | Removed `counterpartyAttrsSchema`; updated `kindAttributesSchema` discriminated union; updated `partyIdSchema` regex (`natural-person\|legal-entity\|agent`); removed `"counterparty"` from all `allowedSourceKinds` / `allowedTargetKinds` in `RELATIONSHIP_KIND_CONSTRAINTS`; updated `BeneficialOwnerChainAsserted` root-kind check from `"counterparty"` → `"legal-entity"` |
| `prototype/domains/party/index.ts` | Removed `CounterpartyAttrs` from public export surface |
| `prototype/platform/event-store/event-types/index.ts` | Removed `CounterpartyAttrs as PartyCounterpartyAttrs` re-export |
| `prototype/platform/identity/party-projection.ts` | Updated `asPartyKind` guard to three-value check |

### Backfill + seed

| File | Change |
|---|---|
| `prototype/scripts/party-backfill.ts` | `backfillCounterparties`: changed `makePartyId("counterparty", slug)` → `makePartyId("legal-entity", slug)`; updated `PartyRegistered` payload to `kind: "legal-entity"` with `legalEntityAttrs` shape (entityForm `"Pty"`, primaryRegulator `"other"`, regimeAnchor from sector); `backfillSignatories`: changed `makePartyId("counterparty", ...)` → `makePartyId("legal-entity", ...)` for the signatory relationship target |
| `prototype/seeds/party-register.json` | Removed `"counterparty": 0` from `totals`; removed `"counterparty": []` from `partiesByKind` |

### Scenario

| File | Change |
|---|---|
| `prototype/scenarios/05-party-graph-roundtrip.ts` | Step 4 now registers Acme Asset Management as `kind: "legal-entity"` with `legalEntityAttrs`; updated assertion to check `counts2["legal-entity"]` |

### Register (markdown)

| File | Change |
|---|---|
| `Regulations/_party-register.md` | Updated preamble ("four actor kinds" → "three intrinsic actor kinds"); updated URN scheme section to explain counterparty-as-relationship; removed `Counterparty | 0` row from totals table with explanatory note; renamed "Counterparty Parties" section to "Institutional counterparty Parties (registered as `legal-entity`)"; updated "By classification" section |

## Impact

- `PartyKind` is now kind-only: 3 values, not 4.
- `urn:party:counterparty:*` URNs are no longer valid. The `partyIdSchema`
  regex rejects them at append time. No existing seed or event data used
  the counterparty URN shape (all counterparty counts were 0 at v0).
- Institutional clients at onboarding register as `urn:party:legal-entity:<slug>`.
- `RELATIONSHIP_KIND_CONSTRAINTS` retains the semantics of existing entries —
  relationships that previously permitted counterparty source/target now permit
  `legal-entity` (which covers the same actors). The `director-of` / `ubo-of`
  constraints now correctly target `["legal-entity"]` only (natural persons
  may hold governance roles in legal entities, not in other natural persons or
  agents).
- `BeneficialOwnerChainAsserted.rootCounterpartyPartyId` now requires a
  `legal-entity` Party (the root of the UBO chain is always a legal entity).
- CI: `bun run ci` passes (0 fail, all recon pipelines green).

## Substrate gap note

The field `rootCounterpartyPartyId` on `BeneficialOwnerChainAssertedPayload`
retains its name for backcompat with the existing event log (no events of this
type exist at v0; the field name can be renamed in a future PR under PR 5 of
D-PARTY-REGISTER when the first UBO chain example is authored).
