// scripts/record-d-scheduler-deploy-decouple.ts
//
// Records D-SCHEDULER-DEPLOY-DECOUPLE — Marc's in-session approval (2026-06-22)
// that the launchd scheduler must deploy from a CLEAN origin/main-pinned worktree
// (mirroring the dashboard's `.dashboard-live` topology), and that the scheduler
// tick must STOP committing event-derived `archive/owner-inbox/*.md` renders to
// the canonical main worktree.
//
// Scope approved:
//   (1) The scheduler-tick job runs from a dedicated CLEAN worktree
//       (`.scheduler-live`) kept pinned to origin/main by a new
//       `com.scrooge.scheduler-autopull` launchd job (`git fetch origin main &&
//       git reset --hard origin/main`), modelled on `com.scrooge.dashboard-
//       autopull`. The interval-driven tick then runs the latest merged code
//       without any in-process self-update.
//   (2) `scripts/scheduler-tick.ts` no longer runs in-process `git fetch origin
//       main` / `git rebase origin/main` / `git pull --rebase`. That self-update
//       (a side-effect of the render-commit push) wedged on accumulated render
//       conflicts and stranded the fleet on STALE code.
//   (3) The scheduler tick no longer git-commits derived `archive/owner-inbox/*.md`
//       renders to main. Markdown is a render of events, never the canonical
//       artefact (Principle 1); RMS Phase 4 already made the registers canonical
//       and archived the inbox dirs, so nothing load-bearing reads those renders
//       from the git tree.
//   (4) Because no installed launchd job now writes to the main worktree, the
//       `BANK_ALLOW_MAIN_WORKTREE_WRITE=1` allowlist opt-in is no longer injected
//       into any rendered plist. The fail-closed `.githooks` guard stays in force
//       as a general control; Marc's interactive TTY is the only recognised
//       legitimate main-worktree writer.
//
// Idempotent on (decisionId, phase, as_of) with a FIXED `asOf` so the
// ci:migrate replay is byte-stable. Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing
// principal. Engineering build decision in the build phase → CEO authority,
// `engineering` category (decision-authority-routing table).
//
// Authority: CLAUDE.md §"Session delegation"; D-ENGINEERING-INTEGRITY-CHARTER;
//   Principles/1-events-are-truth.md.
// brief: brief:atlas:decouple-scheduler-deploy-from-main-worktree-sto:2026-06-22
// Author: Atlas (Core banking platform architect, engineering).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

// Fixed instants so the ci:migrate replay is byte-stable. The decision-symmetry
// recon gate requires every closed decision to carry a `requested` phase before
// its terminal phase (D-DECISIONS-FRAMEWORK-REDESIGN) — emit both.
const REQUESTED = "2026-06-22T15:08:00.000Z";
const APPROVED = "2026-06-22T15:10:00.000Z";

const base = {
  decisionId: "D-SCHEDULER-DEPLOY-DECOUPLE",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Scheduler deploys from a clean origin/main-pinned worktree; stop git-committing derived archive renders",
  category: "engineering" as const,
  recommendation:
    "Run the launchd scheduler-tick job from a dedicated CLEAN worktree (.scheduler-live) kept pinned to origin/main by a new com.scrooge.scheduler-autopull job (git fetch origin main && git reset --hard origin/main), modelled on com.scrooge.dashboard-autopull. Remove scheduler-tick.ts's in-process git fetch/rebase/pull self-update (the autopull mirror replaces it). Stop git-committing event-derived archive/owner-inbox/*.md renders to the main worktree — write deliverable renders only to disk / the document store, never to a git-tracked path. Because no installed launchd job then writes to main, drop the BANK_ALLOW_MAIN_WORKTREE_WRITE=1 allowlist opt-in from all rendered plists (the fail-closed .githooks guard stays in force; Marc's interactive TTY remains the only recognised legitimate main-worktree writer). Update install.sh, the plist templates, and the launchd README accordingly.",
  rationale:
    "com.scrooge.scheduler-tick ran from the MAIN worktree and self-updated its code in-process via git fetch origin main + git pull --rebase, run as a side-effect of committing derived archive/owner-inbox/*.md renders to main every tick. The render commits accumulated (38 seen) and conflicted on rebase, wedging the rebase so the fleet ran STALE code until a manual reset --hard origin/main. This is the same anti-pattern that forced the dashboard onto a dedicated .dashboard-live worktree. Committing event-derived markdown to git also violates Principle 1 (events are the only source of truth; markdown is a render, never the canonical artefact) — and RMS Phase 4 already made the RMS registers canonical and archived the inbox directories, so nothing load-bearing reads those renders from the git tree. Decoupling deploy onto a clean autopull-pinned worktree removes the staleness failure mode entirely and aligns the scheduler with the dashboard topology.",
  sourceDocHashes: [],
  citations: ["D-ENGINEERING-INTEGRITY-CHARTER", "Principles/1-events-are-truth.md"],
  recordedVia: "scrooge:session-delegation",
};

// Symmetric phase chain: requested → approved (idempotent on the fixed instants).
requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-SCHEDULER-DEPLOY-DECOUPLE" },
    null,
    2,
  ),
);
