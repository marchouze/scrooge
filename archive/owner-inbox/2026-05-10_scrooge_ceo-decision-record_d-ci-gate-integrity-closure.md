---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T00:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-CI-GATE-INTEGRITY closure, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

## Outcome

- **Decision IDs resolved:** `D-CI-GATE-INTEGRITY` (the parent finding from Vera (Internal audit / continuous-assurance engineer)) — both halves now closed. **Supersedes** `D-CI-GITHUB-PLAN-UPGRADE-DEFER` (the earlier-2026-05-10 defer record at PR #104) by satisfying its named auto-clear trigger.
- **Title:** D-CI-GATE-INTEGRITY closed — substrate-fix landed; enforcement enabled via repo-visibility shift
- **Action:** approve (closure)
- **Source proposals:**
  - [Owner Inbox/2026-05-10_vera_ci-gate-integrity-finding.md](Owner%20Inbox/2026-05-10_vera_ci-gate-integrity-finding.md) (the parent finding, PR #103)
  - [Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-ci-github-plan-upgrade-defer.md](Owner%20Inbox/2026-05-10_scrooge_ceo-decision-record_d-ci-github-plan-upgrade-defer.md) (the earlier-day defer, PR #104, now superseded)
- **Outcome:** D-CI-GATE-INTEGRITY is fully resolved. Both halves of Vera's recommendation (Option (i) substrate-fix + Option (iii) enforcement-enable) are now in place:
  - **Substrate-fix half** — Atlas (Core banking platform architect)'s PR #105 (merged 2026-05-10) fixed all four pre-existing CI failures: biome lint in `derive-dashboard-state-2026-05-09-fais-posture-a.ts`; mandate-ownership pipeline parser; Rohan (Risk engineer) backtest-harness severity bands; Vera overnight-recon handler. `bun run ci` now exit 0 on main. The actual root cause of failures 3+4 was singleton-eventStore test pollution, fixed structurally via `bun test --isolate` + per-process tmp DB (Vera's downstream-of-2 hypothesis was wrong; Atlas corrected the cascade attribution in #105).
  - **Enforcement-enable half** — Marc (CEO) made the repo public 2026-05-10 ("github is now public"). This was one of the two named auto-clear triggers in D-CI-GITHUB-PLAN-UPGRADE-DEFER. Branch protection on main enabled immediately via `gh api -X PUT repos/marchouze/scrooge/branches/main/protection` with `required_status_checks: { strict: true, contexts: ["ci"] }`, `allow_force_pushes: false`, `allow_deletions: false`, `enforce_admins: false` (admin-override retained for emergencies; single-CEO bank).
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "github is now public" — chat-intake 2026-05-10 (terse trigger of the auto-clear).
- **Authority chain:** Operational-substrate / IT-general-control. Resolves Principle 4 (security designed-in) gap on automated SDLC enforcement. Closes Vera Wave-4 audit finding; the gap is no longer reportable as an open IT-general-control deficiency.

## Why this is the closure record (and not a new defer)

The earlier-2026-05-10 record `D-CI-GITHUB-PLAN-UPGRADE-DEFER` (PR #104) explicitly named four re-litigation triggers, of which "Repo-visibility shift" was a self-clearing condition: *"if the repo is made public for any reason ... branch protection comes free and this defer auto-clears."* Marc satisfied that condition the same day. Per the no-pause rule (`feedback_no_pause_rule.md`), the auto-clear triggers downstream enforcement-enable work without further confirmation.

## Follow-on routes recorded

- `agent:Vera (Internal audit / continuous-assurance engineer)` — close the Wave-4 finding entry (D-CI-GATE-INTEGRITY); update audit-attestation evidence with the closure-record citation. Verify on next overnight-recon that protection is still active (state-drift monitor).
- `agent:Atlas (Core banking platform architect)` — substrate-state row update: branch-protection now under "wired" rather than "deferred" in `prototype/seeds/dashboard-state.json` substrate-state.
- `agent:Senna (Security engineer)` — IT-general-control register: the SDLC-automated-gate control is now fully implemented; cite this closure in the SDLC controls evidence pack.
- `agent:Owen (Company Secretary, governance)` — governance-framework substrate: the operating-rule "red CI blocks merge" is now enforced rather than discipline-only; reflect in the governance framework's IT-general-controls section.
- `agent:Scrooge (Chief of Staff / Orchestrator)` — drop the manual red-CI-blocks-merge gate from dispatch operating rules; GitHub now enforces. Memory entry `project_github_plan_upgrade_pending.md` updated to RESOLVED.

## Substrate gaps surfaced (small, all bounded)

1. **Admin-override path** — `enforce_admins: false` means admins can bypass the gate in emergencies. For a single-CEO bank this is the right setting (no other admin to consult); at licence-day with multiple human admins, this should flip to `enforce_admins: true` with a documented break-glass procedure. Owen + Devon (COO, governance) substrate slice; pre-licence-day.
2. **No required reviews** — single-CEO operating model doesn't fit PR-review requirement; at licence-day with NEDs and multi-human governance, a `required_pull_request_reviews` policy on main becomes appropriate. Owen pre-licence-day.
3. **Other branch protection** — release branches do not yet exist; when introduced post-licence-day, the protection setup in this record is the template.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; this markdown mirrors. Memory entry `project_github_plan_upgrade_pending.md` (renamed-in-content to RESOLVED) carries the cross-session state.

—Scrooge (Chief of Staff / Orchestrator)
