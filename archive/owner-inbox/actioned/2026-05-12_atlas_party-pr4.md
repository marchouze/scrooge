---
title: "Party register PR 4 — legacy deprecation + PartyId tightening"
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-12
decision-required: false
authority: D-PARTY-REGISTER
---

# Party register PR 4 — completion brief

## Step 1: Legacy event-type deprecation

**Finding: deprecation already landed on main.**

Investigation of `prototype/platform/event-store/registry.ts` confirmed that
both legacy registration event types were already marked `status: "deprecated"`
with `supersededBy: "PartyRegistered"` under prior Party PRs:

- `AgentRegistered` — deprecated; `supersededBy: "PartyRegistered"`. Historical
  events remain in the log (Principle 1 / append-only). No new emissions.
- `LegalEntityRegistered` — deprecated; `supersededBy: "PartyRegistered"`.
  Historical events remain in the log. No new emissions.

No additional legacy party-registration types were found outside the canonical
`domains/party/` family and the `event-types/` modules.

**Recon assertion (P4) already in place.** `platform/recon/event-type-registry-coverage.ts`
runs a fail-level check (`P4 — no new eventStore.append call sites emit a deprecated type`)
that reads deprecated types directly from `EVENT_TYPE_REGISTRY`. Any future
`eventStore.append` call referencing `AgentRegistered` or `LegalEntityRegistered`
will produce a `severity: "fail"` recon violation. This assertion is wired into
`bun run ci` (`recon:event-type-registry-coverage`).

## Step 2: `personId` and `reviewerId` → `PartyId`

**Finding: type change already in `domains/customer/types.ts`.**

`prototype/domains/customer/types.ts` already carried the tightened types:

```typescript
// KycCompletedPayload
reviewerId: PartyId;

// AuthorisedSignatoryPayload
personId: PartyId;
```

with `import type { PartyId } from "../party"` in place.

**Call-sites updated.** Seven files previously used non-URN strings (e.g.
`"mira@bank.local"`, `"p1"`, `"SYN-PERSON-HF-001"`, `"party:natural-person:..."`)
via `as PartyId` type coercions. All updated to proper `urn:party:natural-person:...`
URNs in this PR:

| File | Fields updated |
|------|---------------|
| `tests/customer.test.ts` | `reviewerId`, `personId` (×2) |
| `scenarios/02-onboard-counterparty.ts` | `reviewerId`, `personId` (×2) |
| `scenarios/03-fx-end-to-end-rehearsal.ts` | `reviewerId` |
| `scenarios/03-rehearsal-asset-manager.ts` | `reviewerId`, `personId` |
| `scenarios/04-rehearsal-hedge-fund.ts` | `reviewerId`, `personId` |
| `scenarios/05-rehearsal-market-maker.ts` | `reviewerId` |
| `platform/lifecycle/onboarding-orchestrator.test.ts` | `REVIEWER_ID`, `PERSON_ID` constants (missing `urn:` prefix) |

## CI gate

`bun run ci` passes (TypeScript, Biome lint, all tests, all recon pipelines including
`recon:event-type-registry-coverage` P4 deprecated-emission assertion).

## Substrate gaps surfaced

None in this PR. The deprecated-emission recon (P4) is the enforcement mechanism;
no further substrate changes are required.
