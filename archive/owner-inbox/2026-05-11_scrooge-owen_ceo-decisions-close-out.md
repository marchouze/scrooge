---
agent: Scrooge
co-author: Owen
trigger: ceo-decisions-close-out
asOf: 2026-05-11T15:34:10.160Z
decision-required: false
---

# CEO-decisions close-out — two ghost-open decisions, 2026-05-11

**From:** Scrooge (Chief of Staff / Orchestrator) on behalf of Marc (CEO).
**Co-author:** Owen (Company Secretary, governance) — CeoDecision-record paperwork.
**Subject:** Audit-trail correction for two `decisionsOpen` entries on the dashboard that were stuck for structural reasons (missing or stale events), not for want of fresh CEO action.

The dashboard projection at `prototype/dashboard/derive.ts::reduceCeoDecisions` resolves a decisionId when it sees a non-`request-revision` `CeoDecision` event for that id (latest-wins-per-key). Both decisions covered here had a missing-or-stale event that the projection couldn't honour. Both are now corrected via canonical event appends through the event-store, per Principle 1 (events are the only source of truth).

## 1 — `D-PRINCIPLES-P2-P6-MERGE` — missing approve event back-recorded

| field | value |
|---|---|
| **eventId** | `05d61218-5e6a-444e-9476-71f6706c1e55` (random — emission via `recordCeoDecision()`) |
| **decisionId** | `D-PRINCIPLES-P2-P6-MERGE` |
| **action** | `approve` |
| **actor** | `{ type: "human", id: "marc@tgv.co.za" }` |
| **asOf** | `2026-05-11T07:44:04.000Z` (PR #215 `mergedAt`) |
| **outcome** | Approve the merge of Principles 2 and 6 into a single Principle 2 (Single-graph discipline), renumbering P7 (autonomous-by-default) to P6. |
| **comment** | Approve event back-recorded: decision was actioned via PR #215 but the typed event was not emitted at the time. Closes the ghost-open state on the dashboard. |
| **sourceDoc** | `Owner Inbox/2026-05-11_owen_d-principles-p2-p6-merge_decision-spec.md` |
| **recordedVia** | `script:close-out-ceo-decisions-2026-05-11` |

Marc (CEO) approved the merge and the work landed via PRs #214 (decision spec), #215 (principles merge collapsing P2 + P6, P7→P6 renumber), and #216 (cross-ref fixup) — all merged on `main` on 2026-05-11. The typed `CeoDecision` event was never emitted at the time. The dashboard projection therefore continued to surface the decision as open. This back-records the event with the correct `asOf` (PR #215 merge timestamp from `gh pr view 215 --json mergedAt`).

**Effect on dashboard:** `D-PRINCIPLES-P2-P6-MERGE` moves from `decisionsOpen` to `decisionsResolved` (verified locally via `bun run scripts/regen-dashboard-cache.ts`; the entry now shows `action: "approve", actionedBy: "marc@tgv.co.za", actionedAt: "2026-05-11T07:44:04.000Z"` in the resolved list).

## 2 — `D-MARKETS-CAPITAL-TIME-SHAPE` — corrective event supersedes smoke-test

| field | value |
|---|---|
| **eventId** | `evt-2026-05-11-d-markets-capital-time-shape-correction` (deterministic — for idempotency) |
| **decisionId** | `D-MARKETS-CAPITAL-TIME-SHAPE` |
| **action** | `request-revision` |
| **actor** | `{ type: "service", id: "agent:scrooge" }` |
| **asOf** | `2026-05-11T08:00:00.000Z` |
| **outcome** | CORRECTION: the prior CeoDecision event on this decisionId (event_id `d935e2bc-bb24-4b45-aac3-ac66014385e1`, emitted 2026-05-07T13:51:16.781Z with `actor.id=marc@tgv.co.za`) was Scrooge's smoke-test of the dashboard `/api/decide` form, mis-attributed to Marc due to the hardcoded actor seam (substrate gap, deferred). This corrective event supersedes the smoke-test via latest-wins-per-key with the correct actor (`agent:scrooge`, service). The underlying decision remains genuinely open — Saskia's §8 capital time-shape (`Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md`) still awaits Marc's actual call. |
| **comment** | Audit-trail correction (Principle 1). Pairs with the markdown mirror at `Owner Inbox/2026-05-07_scrooge_ceo-decision-record_d-markets-capital-time-shape.md` and this close-out brief. The `/api/decide` identity seam is a deferred substrate fix. |
| **sourceDoc** | `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` |
| **recordedVia** | `script:close-out-ceo-decisions-2026-05-11` |

### Approach chosen — (a) corrective event, not (b) spec-surface

The dispatch brief offered two valid approaches:

- **(a) corrective event** — emit a new `CeoDecision` with `action="request-revision"` attributed to `agent:scrooge` that supersedes the smoke-test event via latest-wins-per-key. The decision stays in `decisionsOpen` via the `reopenedFromEvents` fallback in `reduceCeoDecisions`, but now with the correctly-attributed actor.
- **(b) spec-surface** — annotate / re-date Saskia's §8 spec so the Owner-Inbox parser lifts it back into the curated open list, then emit a `request-revision-revoke` / `supersede` action to neutralise the smoke-test.

**Approach (a) chosen.** Reasons:

1. The dashboard projection recognises only `approve | defer | modify | request-revision` (per `prototype/dashboard/types.ts::DecisionAction`). There is no `supersede`, `revoke`, or `request-revision-revoke` action. Approach (b) would have required (i) adding a new action type to the projection, (ii) extending `recordCeoDecision()` and `reduceCeoDecisions()` to handle it, AND (iii) touching the Saskia spec file. Three changes for a one-line audit-trail correction.
2. Approach (a) is one append, idempotent (deterministic event_id), and preserves the smoke-test event in the audit log — which is exactly what a forensic-grade event store wants. A future substrate-gap recon (the `/api/decide` identity seam) needs the smoke-test event to point at; deleting or papering over it would erase the evidence.
3. The projection's `reopenedFromEvents` synthesisation path (per `derive.ts` line 599 onward) is explicitly the right channel for this case — the inline comment at line 603 calls out `D-MARKETS-CAPITAL-TIME-SHAPE` by name as the motivating case.

**Effect on dashboard:** `D-MARKETS-CAPITAL-TIME-SHAPE` continues to appear in `decisionsOpen` (genuinely open) but its triggering event is now the corrective `agent:scrooge` event, not the smoke-test `marc@tgv.co.za` event. Verified locally: `owner: "(reopened)"`, `trigger: "CeoDecision event with action=request-revision at 2026-05-11T08:00:00.000Z"`. Saskia's §8 capital time-shape question stands open and awaits Marc's actual call.

## Substrate-gap items surfaced

These are not blockers for this close-out — they are the structural reasons the close-out was needed in the first place, captured here so the gaps remain on the radar for the engineering substrate.

1. **`dashboard/server.ts::/api/decide` identity seam (deferred per Marc).**
   The endpoint hardcodes `actor: { type: "human", id: "marc@tgv.co.za" }` regardless of the actual caller. Any non-Marc invocation — including Scrooge's smoke-tests, future agent-authored corrections, or non-Marc CEO sessions once the seat passes — is mis-attributed. The fix is a small identity seam (read the actor from a session / auth header). Deferred under the dispatch brief; flagged here so the dashboard substrate-gaps register can pick it up.

2. **`recordCeoDecision()` forces `actor.type="human"`.**
   `prototype/runtime/decisions/record.ts` line 92 hardcodes `actor: { type: "human", id: input.actor }`. Agent-authored corrective events against a CeoDecision currently bypass the helper and construct the `Event` directly (as this script does for #2). That's fine for one-shots, but it means the helper's input-validation and identity-discipline don't apply on the corrective path. A small extension — accept an optional `actorType` field — would close the gap.

3. **Decision-record-to-event symmetry recon (planned).**
   The root cause of both close-outs is the same: a markdown CEO-decision record was authored without a corresponding event, OR an event was authored with a wrong actor and no later corrective event landed. A symmetry recon — "for every decision-record `.md` in `Owner Inbox/` with a `decision-id` frontmatter field, assert there is at least one `CeoDecision` event on the bus with that `decisionId` AND with `actor.type` consistent with the record's `agent:` frontmatter" — would have caught both ghost-open states automatically. Vera (Internal Audit Engineer, audit) is the natural owner; pair with Atlas (Core banking platform architect, substrate) on the event-side query.

## Method — how it was done

1. **Read the projection and event-store schema** (`prototype/dashboard/derive.ts::reduceCeoDecisions`, `prototype/dashboard/types.ts::DecisionAction`, `prototype/platform/event-store/types.ts`, `prototype/runtime/decisions/record.ts`) to confirm available actions (`approve | defer | modify | request-revision`) and the latest-wins-per-key semantic.
2. **Authored a one-shot script** at `prototype/scripts/close-out-ceo-decisions-2026-05-11.ts` following the pattern in `prototype/scripts/backfill-decision-events-2026-05-10.ts` and `prototype/scripts/record-d-party-register-correction.ts`. Idempotent: #1 skips if any `CeoDecision` event exists for the decisionId; #2 uses a deterministic `event_id` so the UNIQUE constraint provides the idempotency guarantee.
3. **Ran the script** twice — first run emitted 2, second run skipped 2 (idempotency confirmed).
4. **Verified** with `bun run scripts/regen-dashboard-cache.ts` then inspected `.local/dashboard-state.json`: `D-PRINCIPLES-P2-P6-MERGE` no longer in `decisionsOpen` (now in `decisionsResolved` with `action: approve, actionedBy: marc@tgv.co.za`); `D-MARKETS-CAPITAL-TIME-SHAPE` still in `decisionsOpen` with the corrective event's `agent:scrooge` actor surfacing through `reopenedFromEvents`.

## References

- Script: `prototype/scripts/close-out-ceo-decisions-2026-05-11.ts`
- Projection: `prototype/dashboard/derive.ts::reduceCeoDecisions` (lines 576–660)
- Decision-record helper: `prototype/runtime/decisions/record.ts`
- D-PRINCIPLES-P2-P6-MERGE spec: `Owner Inbox/2026-05-11_owen_d-principles-p2-p6-merge_decision-spec.md`
- D-MARKETS-CAPITAL-TIME-SHAPE source proposal: `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` (Saskia's §8)
- D-MARKETS-CAPITAL-TIME-SHAPE markdown mirror: `Owner Inbox/2026-05-07_scrooge_ceo-decision-record_d-markets-capital-time-shape.md`
- PR #215 (principles merge): merged `2026-05-11T07:44:04Z`
- Smoke-test event (superseded): `event_id=d935e2bc-bb24-4b45-aac3-ac66014385e1`, emitted `2026-05-07T13:51:16.781Z`
