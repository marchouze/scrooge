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

**Finding: the files are NOT stale and require NO file-system remediation.** They are correctly archived; the recon-reported `Team Inbox/...` path prefix is a misleading label produced by the recon code itself, not a real on-disk location.

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

All 5 files are **Class A — DELIVERED-ARCHIVED**:

1. Live record under correct RMS-Phase-4 location (`archive/team-inbox/`).
2. Backing `AgentBriefIssued` events were emitted by the 2026-05-18 backfill (commit `a71c066e`) and exist in the canonical event store on `origin/main` / the daemon-served event.db.
3. No `Team Inbox/` directory pollution — the legacy path string in the recon report is cosmetic.
4. Substrate-only artefact (fresh-worktree empty event-store) caused them to surface as `warn` in PR #649.

---

## Remediation

**File-system action: NONE.** The 5 files are at the correct location. No janitorial PR moving or deleting files is required.

**Recon cosmetic clarification:** the path-label inconsistency in `rms-briefs-parity.ts` is logged below as a substrate gap. It is not in this brief's remit to fix; flagging only.

**Investigation deliverable:** this record, filed via `RecordFiled` at `archive/owner-inbox/2026-05-21_owen_team-inbox-stale-files-investigation.md`.

---

## Substrate gaps surfaced

### Gap 1 — Recon path labels lag the archive move

`prototype/platform/recon/rms-briefs-parity.ts` scans `archive/team-inbox/` (line 166) but reports violations under the legacy `Team Inbox/${filename}` prefix (line 201). Identical pattern likely in sibling reconciliations that pre-date D-RMS-PHASE-4 (e.g. `dashboard-derivation-recon.ts` and `decision-event-recon.ts` still carry the `Team Inbox/actioned/*` prose-comment reference). The label should match the actual scanned path so investigators do not chase a phantom directory.

### Gap 2 — Fresh-worktree empty event-store produces misleading "warn" surfaces

Agent worktrees boot with empty `prototype/.local/event.db`. Recon pipelines that match markdown files to historical events (here: `rms-briefs-parity`; likely sister: `rms-documents-parity`) cannot find the events because they live on the production daemon's event-store, not the worktree's. The fresh-runner empty-store posture (auto-downgrade to `warn`) is the right safety net, but the surface still looks like a real finding to humans / Scrooge skimming PR CI output. Consider one of: (a) recon outputs that explicitly tag the "empty store, warn-only" posture in the human-readable `msg`, (b) a boot-time replay-from-main into the local event.db, or (c) running these specific recons only on the daemon and skipping them in worktrees.

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
