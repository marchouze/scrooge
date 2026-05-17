---
author: Atlas (Platform Engineer, engineering)
co-author: Kai (Quantitative Markets Architect, engineering)
date: 2026-05-16
decision-required: false
authority: P1-EVENTS-AS-TRUTH
citations:
  - P1-EVENTS-AS-TRUTH
  - Principle 2 (single-graph discipline)
  - Owner Inbox/2026-05-16_vera_overnight-recon.md
  - Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032)
---

# Event-type registry coverage — 143 missing types resolved

## Summary

Vera's overnight recon (2026-05-16) flagged 143 event types referenced in agent-spec
`subscribesTo` fields but absent from `EVENT_TYPE_REGISTRY`
(`platform/event-store/registry.ts`). This brief records the completion of that gap.

**Result:** 0 warn-level violations in `recon:event-type-registry-coverage`. The
registry now covers every type observed in `subscribesTo` and every `eventStore.append`
call site across the codebase.

---

## What was done

A new registry module was added at
`prototype/platform/event-store/registry/missing-types.ts` and wired into the combined
`EVENT_TYPE_REGISTRY` via `registry/index.ts`.

The module registers **142 net-new rows** (143 missing less 1 duplicate — see below)
grouped by domain:

| Domain | Label | Types registered | Primary agents |
|--------|-------|-----------------|----------------|
| A | FX / markets / trading | 29 | Kai, Bea, Rohan, Saskia |
| B | ALM / treasury / liquidity | 14 | Ravi, Eitan, Camille |
| C | Risk | 10 | Helena, Rohan, Nadia |
| D | Accounting / IFRS | 3 | Bea, Camille, Yael |
| E | Compliance / AML / FIC / POPIA | 19 | Zara, Mira, Iris |
| F | Governance / legal / company-secretary | 16 | Owen, Imani, Thandiwe |
| G | Payments / settlement | 6 | Tomas |
| H | Infrastructure / DevSecOps | 21 | Atlas, Devon, Senna, Rashida |
| I | AgentOps / HR / people | 12 | Sade, Nolan, PAX |
| J | Regulatory horizon-scanning | 2 | Mira, Yael |
| K | Client lifecycle / CRM | 6 | Niko, Mira |
| L | Model / quant validation | 1 (deduplicated) | Nadia |
| M | Readiness snapshots | 5 | Ravi, Saskia, Tomas, Imani, Yael |

**Duplicate avoided:** `AgentOpsReadinessSnapshot` was already registered in
`governance.ts` with a typed `payloadSchema` (F-032 closed type, tested in
`tests/event-types-f032-coverage.test.ts`). Adding a schema-less placeholder for it
would have overridden the schema-bearing row (Map last-writer-wins). The duplicate was
excluded from the new module with an explicit comment.

---

## Approach to schemas

All 142 new rows are **envelope-only** (no `payloadSchema`). This is explicitly
tolerated by the registry header:

> "Type not in registry → no-op (build-phase forward compat). Will tighten to
> fail-closed once Vera's #11 / #12 pipelines assert the registry is complete."

Each row uses `RETENTION_CONSERVATIVE_DEFAULT` (5-year floor, `hot-cool-archive`,
citation `ORG-CS3-009` — Banks Act / CS 3/2018 §12) pending domain-specific
classification.

All rows carry a `// TODO F-032:` comment to signal that a typed Zod schema + factory
is needed before commencement-of-trading.

---

## CI gate

`bun run ci` from `prototype/` passes fully:
- 1 688 tests pass, 0 fail
- `recon:event-type-registry-coverage`: 0 warn-level violations (143 → 0)
- Remaining violations in that recon are all `info`-level "no factory" notices,
  which are expected for envelope-only rows and do not block the gate

---

## Substrate gaps (F-032 follow-on)

1. **Schema authoring.** Every new row needs a typed Zod payload schema and a
   `make<Type>` factory before commencement-of-trading. Today: envelope-only.
   Tracked under F-032.

2. **Retention classification.** All rows use `RETENTION_CONSERVATIVE_DEFAULT`.
   Mira (Compliance / RegTech engineer, engineering) should classify each domain
   against the obligations register before licence-day. Vera's Wave-4 #14
   `retention-citation-coverage` recon will surface regressions.

3. **`CEODecision` spelling variant.** `CEODecision` (uppercase variant) is referenced
   in Saskia's metadata alongside the canonical `CeoDecision`. The two are distinct
   strings. The new row is registered as a placeholder; the proper fix is to migrate
   Saskia's metadata to the canonical spelling.

4. **`BacktestTriggered` dual-subscriber pattern.** The type appears in both Rohan
   (trigger source) and Nadia (consumer) metadata. One row is registered; callers
   should ensure both issuers and both subscribers are populated in the row's
   `subscribers` field in a future schema-authoring pass.
