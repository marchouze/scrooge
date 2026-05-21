---
title: "Team Inbox stale-files investigation — 5 Owen authority briefs (PR #649 finding)"
author: Owen (Company Secretary, governance)
authored-on: 2026-05-21
workstream: WS-RMS-HYGIENE
brief: brief:owen:investigate-remediate-5-stale-team-inbox-authori:2026-05-21
citations:
  - urn:decision:D-RMS-PHASE-2
  - urn:decision:D-RMS-PHASE-3
  - urn:decision:D-RMS-PHASE-4
---

# Team Inbox stale-files investigation — 5 Owen authority briefs

**Author:** Owen (Company Secretary, governance)
**Date:** 2026-05-21
**Brief ref:** brief:owen:investigate-remediate-5-stale-team-inbox-authori:2026-05-21
**Workstream:** WS-RMS-HYGIENE
**Authority:** Owen — CoSec governance / procedure register authority

---

## Summary

PR #649's CI note flagged 5 files reported by `recon:rms-briefs-parity` under the path prefix `Team Inbox/...`:

- `Team Inbox/2026-05-18_owen_authority-brief-cae-thandiwe.md`
- `Team Inbox/2026-05-18_owen_authority-brief-cco-zara.md`
- `Team Inbox/2026-05-18_owen_authority-brief-cfo-camille.md`
- `Team Inbox/2026-05-18_owen_authority-brief-ciso-rashida.md`
- `Team Inbox/2026-05-18_owen_authority-brief-coo-devon.md`

Per RMS Phase 4 (D-RMS-PHASE-4, 2026-05-18) the live `Team Inbox/` directory was retired and all files moved to `archive/team-inbox/`. Any "Team Inbox" file post-Phase-4 should therefore be anomalous.

**Finding: the files are NOT stale on disk.** They are correctly archived; the recon-reported `Team Inbox/...` path prefix is a misleading label produced by the recon code itself, not a real on-disk location.

**Event-level remediation IS required, however.** The 5 backing `AgentBriefIssued` events were originally emitted only into the production daemon's event-store (commit `a71c066e`, 2026-05-18) and were never written into a deterministic CI/worktree backfill script. Each fresh checkout (CI container or new agent worktree) therefore re-derives the empty-store recon posture: 5 `warn`-level violations downgraded by the empty-store auto-rule. As soon as any agent emits even one `AgentBriefIssued` event in the worktree, the empty-store rule no longer applies and the 5 historical files become `fail`-level violations. This investigation re-encountered exactly that failure mode while emitting the brief lifecycle events for this run, so the fix is now committed: a re-runnable `backfill:authority-briefs-2026-05-18` script wired into `bun run ci`.

---

## Investigation

### 1. On-disk location

```
$ find . -path ./node_modules -prune -o -name '2026-05-18_owen_authority-brief-*' -print
./archive/team-inbox/2026-05-18_owen_authority-brief-ciso-rashida.md
./archive/team-inbox/2026-05-18_owen_authority-brief-cfo-camille.md
./archive/team-inbox/2026-05-18_owen_authority-brief-cae-thandiwe.md
./archive/team-inbox/2026-05-18_owen_authority-brief-cco-zara.md
./archive/team-inbox/2026-05-18_owen_authority-brief-coo-devon.md
```

All 5 files exist only at `archive/team-inbox/...`. No `Team Inbox/` directory exists in the worktree (correctly so — D-RMS-PHASE-4).

### 2. Git history

The files were first added to the repository in PR #515 (`feat(governance): operationalise decision-authority routing — 5 governance seats`, merged 2026-05-18 at 07:16 SAST). They were authored to `Team Inbox/...` on the PR branch, then bulk-moved with the rest of legacy inbox content to `archive/team-inbox/` by PR #523 (`chore(rms): Phase 4 inbox archive — move Owner Inbox + Team Inbox files to archive/`, merged 2026-05-18 at 08:21 SAST). The squash-merged commit (`332f6961`) shows the net add at the archive path because the Phase-4 move closed the gap before the squash.

### 3. Backing events

Commit `a71c066e` (`fix(recon): rms-briefs-parity — index issuedBy as well as issuedTo; backfill 5 Owen authority briefs`, 2026-05-18 16:38 SAST) backfilled `AgentBriefIssued` events for all 5 brief refs:

- `brief:owen:authority-brief-cae-thandiwe:2026-05-18`
- `brief:owen:authority-brief-cco-zara:2026-05-18`
- `brief:owen:authority-brief-cfo-camille:2026-05-18`
- `brief:owen:authority-brief-ciso-rashida:2026-05-18`
- `brief:owen:authority-brief-coo-devon:2026-05-18`

The same commit also patched the recon matcher to index `issuedBy.name` (Owen authored these briefs, so the second filename segment is `owen` not the recipient agent's slug).

### 4. Why the recon flagged them in PR #649

The recon file `prototype/platform/recon/rms-briefs-parity.ts` (D-RMS-PHASE-2 gate) was correctly updated to scan `archive/team-inbox/` after Phase 4. However:

- Line 166: `const teamInboxDir = resolve(repoRoot, "archive", "team-inbox");` — reads the right directory.
- Line 201: `` const filePath = `Team Inbox/${filename}`; `` — reports the legacy path prefix in violation `subject`.

The recon was therefore reading post-Phase-4 archived files but labelling them with the pre-Phase-4 `Team Inbox/...` path. In the PR #649 fresh worktree (`event.db` empty, no replicated events from `origin/main`) the heuristic matcher had no events to match against and emitted 5 `warn`-severity violations. With `ok: true` (warnings only), CI did not fail — but the report text gave the misleading impression that 5 stale `Team Inbox/` files needed remediation.

Confirmed by running the recon in this worktree (also empty event-store, same fresh-runner posture):

```
{"asserted":5,"violations":5,"ok":true,"msg":"RMS briefs parity passed",...}
```

---

## Classification (per brief taxonomy A/B/C/D)

All 5 files are a **hybrid A + C**:

- **Class A on disk (DELIVERED-ARCHIVED):** Live record at the correct RMS-Phase-4 location (`archive/team-inbox/`). No `Team Inbox/` directory pollution — the legacy path string in the recon report is cosmetic only.
- **Class C on events (DRAFTED-NEVER-EVENTED in a fresh store):** No deterministic backfill exists for the 5 `AgentBriefIssued` events. The daemon's event-store carries them (emitted by commit `a71c066e` on 2026-05-18), but every fresh worktree / CI container starts empty and cannot re-derive them.

The hybrid status is the substrate-level lesson: an event-only emit is only durable if it is *also* committed as a re-runnable backfill script (matching the pattern used by `backfill:decisions`, `backfill:policy-activations`, `backfill:policy-documents`).

---

## Remediation

**File-system action: NONE.** The 5 files are at the correct location. No janitorial PR moving or deleting files is required.

**Event-store remediation: SHIPPED in this PR.**

- `prototype/scripts/backfill-authority-briefs-2026-05-18.ts` — idempotent backfill emitting 5 `AgentBriefIssued` events (one per archived authority brief), keyed by `briefId`, body sourced from the on-disk markdown so the BLAKE3 hash matches the canonical document store entry.
- `prototype/package.json` — script alias `backfill:authority-briefs-2026-05-18` + addition to the `ci` chain immediately after `backfill:policy-activations` and before `recon`. CI now re-derives the 5 events on every fresh checkout; `recon:rms-briefs-parity` matches them deterministically (5 asserted / 0 violations).

**Recon cosmetic clarification:** the path-label inconsistency in `rms-briefs-parity.ts` is logged below as a substrate gap. It is not in this brief's remit to fix; flagging only.

**Investigation deliverable:** this record, filed via `RecordFiled` at `archive/owner-inbox/2026-05-21_owen_team-inbox-stale-files-investigation.md`.

---

## Substrate gaps surfaced

### Gap 1 — Recon path labels lag the archive move

`prototype/platform/recon/rms-briefs-parity.ts` scans `archive/team-inbox/` (line 166) but reports violations under the legacy `Team Inbox/${filename}` prefix (line 201). Identical pattern likely in sibling reconciliations that pre-date D-RMS-PHASE-4 (e.g. `dashboard-derivation-recon.ts` and `decision-event-recon.ts` still carry the `Team Inbox/actioned/*` prose-comment reference). The label should match the actual scanned path so investigators do not chase a phantom directory.

### Gap 2 — Fresh-worktree empty event-store produces unstable recon outcomes

Agent worktrees boot with empty `prototype/.local/event.db`. Recon pipelines that match markdown files to historical events (here: `rms-briefs-parity`; likely sister: `rms-documents-parity`) cannot find the events because they live on the production daemon's event-store, not the worktree's. The fresh-runner empty-store auto-downgrade (all violations → `warn`, `ok: true`) is the right safety net for *truly* empty stores, but it produces an unstable signal: as soon as a worktree emits any single event of the same kind, the empty-store rule disengages and all historically un-evented files become `fail`-level violations.

This investigation hit that exact instability — emitting just the `AgentBriefIssued` event for this brief flipped the 5 historical files from `warn` to `fail`. The proper fix (and the one this PR ships for the 5 authority briefs) is **always pair an event-only emit with a re-runnable backfill script wired into CI**; the empty-store auto-downgrade should be a tripwire, not load-bearing semantics. Sister recon pipelines should be audited for the same pattern (`rms-documents-parity` first; any other recon that pattern-matches event-store contents against on-disk markdown second).

Atlas (Core banking platform architect, engineering) is running in parallel under `brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21` and is shipping the equivalent pattern for `RecordFiled(documents)`. The two backfill scripts share the same structural lesson.

### Gap 3 — Agent worktrees inherit branch artefacts that look like authoring drift

This is the gap the brief specifically asked me to surface. When a worktree starts from a stale branch (e.g. an agent's prior dispatch branch that pre-dates a structural change such as Phase 4), the agent can find paths in their worktree that no longer exist on `origin/main`. In PR #649 the surface was not a true stale path (files were already archived on `main`), but the symmetric risk — an agent re-discovering a legacy path that *does* still exist on its branch — remains real. Mitigation candidates: (a) post-checkout hook that verifies `origin/main` parity for archive-controlled directories, (b) agent dispatch prompt boilerplate that runs `git fetch origin main && git diff --diff-filter=A main -- 'Team Inbox/' 'Owner Inbox/'` as a pre-flight, (c) recon pipeline `archive-discipline` that fails on any tracked file outside the allowed in-tree paths.

---

## Citations

- `urn:decision:D-RMS-PHASE-2` — events-first dispatch (2026-05-17).
- `urn:decision:D-RMS-PHASE-3` — RecordFiled-backed deliverables (2026-05-17).
- `urn:decision:D-RMS-PHASE-4` — full archive cutover (2026-05-18; PR #523, PR #525).
- Commit `a71c066e` — 5-brief backfill + recon matcher fix (2026-05-18).
- PR #515 — origin of the 5 authority briefs (`feat(governance): operationalise decision-authority routing — 5 governance seats`).
- PR #649 — surfaced the cosmetic finding (`feat(policy): complete top-5 policy gaps from 2026-05-21 audit`).
