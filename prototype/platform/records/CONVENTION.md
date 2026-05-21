---
title: RecordFiled manifest replay convention
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-21
authority: D-RMS-RECORDFILED-MANIFEST
brief: brief:atlas:auto-wire-one-shot-recordfiled-scripts-into-the-:2026-05-21
supersedes-pattern: one-shot-recordfiled-scripts
---

# RecordFiled manifest replay convention

**Standing authority:** `D-RMS-RECORDFILED-MANIFEST` (CEO-approved 2026-05-21)
**Engineering authority:** Devon (COO, governance) — engineering substrate routing per CLAUDE.md.

## Why this convention exists

Between 2026-05-17 and 2026-05-21, four separate one-shot scripts were authored
to emit `RecordFiled(documents)` events that needed to survive a fresh-runner
replay:

| Script | Records | Wired into `migrate:decisions-backfill`? |
|---|---|---|
| `scripts/migrate/backfill-recordfiled-documents-2026-05-17.ts` | 8 | yes |
| `scripts/migrate/backfill-recordfiled-2026-05-21-owen-investigation.ts` | 1 | yes |
| `scripts/file-atlas-policy-next-review-convention-extension.ts` | 1 | **no — missed** |

The "missed" line is the proof. Every one-shot script carries ~150 lines of
boilerplate AND a package.json line; the boilerplate is mechanical, the
package.json line is brittle and easy to forget. The triple-line authoring
pattern was not converging — that is what this convention retires.

## The convention

There is **one canonical mechanism** for `RecordFiled` events that need to
hydrate on fresh runners (CI, new clones, ephemeral workers):

1. **Append an entry to** `prototype/scripts/migrate/recordfiled-manifest.json`.
2. **Done.** The replay script `prototype/scripts/migrate/replay-recordfiled-manifest.ts`
   is wired ONCE into `migrate:decisions-backfill` and reads the manifest on
   every fresh-runner pass.

The replay script is idempotent on `recordId`. Existing events are skipped,
missing source files non-zero-exit so CI surfaces gaps loudly. The manifest
schema is documented inline in the manifest file (`comment` field) and is
lightly validated at load time.

## What you do NOT do

- ❌ Do **not** write a new one-shot script in `scripts/migrate/`.
- ❌ Do **not** add a new line to `migrate:decisions-backfill` in `package.json`.
- ❌ Do **not** inline-emit a `RecordFiled` event in a script that only runs
      once and is then orphaned (the failure mode that produced the
      Owen-investigation gap on 2026-05-21).

If the only RecordFiled emission needed is a `close-run` deliverable for an
agent dispatch, the existing `dispatch:close-run` CLI handles it via
`--deliverable <path>`. No manifest entry is needed in that case — the
close-run event hydrates from the event log directly.

The manifest covers the **gap case**: events that were authored outside of a
close-run flow (backfills, inline filings, historical reconstruction).

## When to add a manifest entry

Add an entry when:

1. A `RecordFiled(documents)` (or other-register) event was authored inline
   inside a one-off script or REPL session, AND
2. The event must survive a fresh-runner replay (i.e. it is materially load-
   bearing for recon, registers, or downstream projections).

## How to add a manifest entry

```jsonc
{
  "recordId":       "record:documents:<author>:<slug>:<date>",
  "sourcePath":     "<repo-relative path to body markdown>",
  "asOf":           "<ISO timestamp; deterministic — use frontmatter date if available>",
  "registerKey":    "documents",
  "classification": "<governance-seat | engineering-seat | ...>",
  "retention": {
    "citationRef":   "<retention citation>",
    "minimumYears":  <int>,
    "archivalTier":  "<hot | cool | cold>"
  },
  "actor":    { "type": "service", "id": "agent:<slug>:<seat-class>" },
  "entity":   "BANK-ZA-001",  /* optional, defaults BANK-ZA-001 */
  "metadata": {
    "title":    "<human-readable title>",
    "path":     "<recon match key — usually Owner Inbox/<filename>>",
    "category": "<grouping>",
    "author":   "<full name + position on first mention>",
    "date":     "<YYYY-MM-DD>"
  },
  "citations": ["<upstream urns / decision IDs / brief IDs>"]
}
```

Run `bun run scripts/migrate/replay-recordfiled-manifest.ts` locally to verify
the entry replays cleanly, then `bun run ci` from `prototype/`.

## Migrating away from the three old scripts

The three pre-convention scripts are retired in the same PR that lands this
convention. Their entries are preserved in the manifest under their original
`recordId`s, so idempotency holds: events already in production event stores
are not re-emitted; fresh runners hydrate them via the manifest pass.

## Future extensions

- The manifest currently only carries `registerKey: documents` entries. It
  generalises trivially to other register keys (`briefs`, `correspondence`,
  `agent-runs`, `feedback`, `workstreams`, `decisions`) — the helper accepts
  any RMS register key. No schema change is needed when those use-cases
  arise.
- A future recon pipeline (`recon:recordfiled-manifest-coverage`) can assert
  that every inline `recordFiled(...)` call site in the codebase outside of
  `replay-recordfiled-manifest.ts` and `dispatch:close-run` is either a
  same-session emit (test, scenario seed) or covered by a manifest entry.
  Not in scope for this PR; logged as a substrate gap.
