---
title: Decisions framework redesign — unified Decision event + single authoring path + full backfill
author: Owen (Company Secretary, governance)
date: 2026-05-16
for: Marc (CEO)
decision-required: true
decision-id: D-DECISIONS-FRAMEWORK-REDESIGN
decision-authority: CEO
decision-category: near-term
decision-owner: Owen (Company Secretary, governance) · Atlas (Core banking platform architect)
decision-for-ceo: Approve the decisions-framework redesign and authorise Atlas to begin Slice A.
decision-recommendation: Approve as specified in the linked plan; Slice A starts immediately.
category: governance
summary: >
  Redesign the decision-recording substrate to one unified Decision event family
  (covering CEO, governance-seat, and agent-autonomous decisions), one canonical
  recordDecision authoring path, an events-only projection, a slug registry with
  auto-suggest, four recon gates, and a one-shot backfill of all 170 historical
  decision IDs. Replaces the current 5-path, 3-source fusion architecture.
supersedes: []
citations:
  - type: Principle
    id: P1
    note: Events are the only source of truth — current markdown-as-authoring path violates
  - type: Principle
    id: P2
    note: Single-graph discipline — one register, one event family
  - type: Decision
    id: D-RMS-PHASE-1
    note: This redesign absorbs and extends Phase 1's pending Decisions register
---

# Decisions framework redesign — CEO decision brief

**Author:** Owen (Company Secretary, governance), co-author Atlas (Core banking platform architect)
**For:** Marc (CEO)
**Plan (authoritative):** [the-current-setup-for-polymorphic-pie.md](/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md)

We are eating our own dog food: the redesign of the decision-recording substrate must itself land as a properly-recorded decision before any code moves.

## 1. Problem

Four recurring instability symptoms confirm the current substrate is unsound (quoted from the plan's Context):

- *Symmetry bug* — approving a decision in markdown + merging the action PR does not emit a `CeoDecision(approve)` event; `D-PRINCIPLES-P2-P6-MERGE` stayed ghost-open until back-recorded.
- *Backfill provenance gap* — events tagged `backfill:owner-inbox-records` are filtered from production replay; 4 historical decisions ghost-opened.
- *Body-scan false positives* — dashboard mined `D-XXX` codes from `decision-required:false` files (fixed PR #386).
- *Mis-attributed events* — `/api/decide` hard-coded an identity; smoke-test events posted under wrong actor.

Plus an ID-collision tail: 170 distinct `D-*` IDs across the corpus, numeric placeholders (`D-01..D-07`), and placeholder shadows (`D-XXX`, `D-IN`, `D-FX-`). No registry, no uniqueness gate.

Root cause is architectural: five authoring paths and a three-source projection fusion (curated JSON cache + filesystem scan + event replay). Drift between any two produces a class of bugs that has no place to live once authoring and projection collapse to events.

## 2. What changes

1. **One `Decision` event family** with `phase` (requested/approved/rejected/deferred/superseded/withdrawn) and `authority` (CEO/Board/AC/BRC/ALCO/CRO/CCO/CFO/COO/CISO/CAE/IO/CoSec/Agent) discriminators. Subsumes `CeoDecision`, the pending RMS `DecisionRequested`, and (by migration) `AgentDecision`.
2. **One `recordDecision` API** at [prototype/runtime/decisions/record.ts](prototype/runtime/decisions/record.ts). Deprecates `recordCeoDecision`, `recordDelegatedDecision`, and direct event construction in `POST /api/decide`. Markdown frontmatter ceases to be an authoring channel.
3. **Events-only projection** at `prototype/projections/decisions.ts`. Kills the filesystem scan and curated JSON cache in [prototype/dashboard/derive.ts](prototype/dashboard/derive.ts). Markdown becomes a render of the projection.
4. **Slug registry + auto-suggest** at `prototype/runtime/decisions/registry.ts`. Format `D-<SCOPE>-<NOUN>[-<QUALIFIER>]`; rejects collisions, near-collisions, prefix shadows, placeholders, and numeric-only IDs.
5. **Four recon gates** wired into `bun run ci`: `recon:decisions-events-only`, `recon:decision-symmetry`, `recon:decision-id-hygiene`, `recon:decision-authority-coverage`.

## 3. Non-CEO decisions become first-class

Today, governance-seat decisions (Helena/CRO calibrating RAS, Owen/CoSec approving a procedure draft, Audit Committee items) and agent-autonomous decisions have no first-class home — they smuggle through `CeoDecision` or remain prose-only. Under the new family, every authority records its own `Decision` events distinguished by `authority` + `authorityRef`. CEO escalations from agent specs (the "Decisions that escalate" section) emit `Decision { authority: 'CEO', phase: 'requested', authorityRef: '<originating-agent>' }` — raised by the agent, decided by Marc, both captured. The dashboard register filters and groups by authority.

## 4. Remediation

One-shot script `prototype/scripts/migrate/backfill-all-decisions.ts` backfills all 170 historical IDs from `Owner Inbox/`, `Owner Inbox/actioned/`, `Team Inbox/actioned/`, and the existing `CeoDecision` / `AgentDecision` streams. Placeholder IDs (`D-XXX`, `D-IN`, `D-FX-`, `D-01..D-07`) are diverted to a manual triage list — Owen brings these to Marc as a one-page mapping for CEO close-out *before* the cutover lands on main. Acceptance: `recon:decisions-events-only` and `recon:decision-symmetry` both green; `decisionsOpen` count matches the pre-migration count ± the triage list.

## 5. Rollout

Four slices, each its own PR, mergeable independently, revertible:

- **Slice A** — `Decision` event type + events-only projection; dashboard switches; recon gates as warnings.
- **Slice B** — `recordDecision` consolidation; `/api/decide` rewrite; recon gates promoted to errors.
- **Slice C** — backfill cutover; manual triage closed; legacy event types aliased.
- **Slice D** — governance-seat activation (Helena/RAS, Owen/CoSec procedure approvals as first non-CEO `Decision` events).

## 6. Decision asked

Approve the redesign as specified in plan file [the-current-setup-for-polymorphic-pie.md](/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md) and authorise Atlas to begin Slice A.

## 7. Substrate gap surfaced

Until Slice A lands the `Decision` event type, this brief is dual-written: the markdown record (this file) plus a future `Decision(requested)` event emitted via `recordDecision` once the type exists. Today, no event exists for `D-DECISIONS-FRAMEWORK-REDESIGN` — that is precisely the gap this very decision will close. Per Principle 1, that is a temporary violation justified only by the circularity: the framework cannot record itself in the framework it is replacing. The Slice-A migration step will emit the `Decision(requested)` and (if approved) `Decision(approved)` events for this decision ID, back-dated to the approval timestamp, as the first canonical entries in the new register.

— Owen (Company Secretary, governance) · Atlas (Core banking platform architect)
