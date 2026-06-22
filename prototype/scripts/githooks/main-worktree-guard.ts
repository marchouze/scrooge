// scripts/githooks/main-worktree-guard.ts
//
// Pure, unit-tested decision function for the fail-closed main-worktree
// write guard. Mutating git operations (commit, rebase, push) that target
// the canonical main worktree (`/Users/marc/code/Bank`) are ABORTED unless
// the actor is an explicitly-allowlisted legitimate writer.
//
// Why this exists: dispatched agents must NEVER operate in the main
// worktree (CLAUDE.md §"Dispatch discipline → Worktree isolation"). Three
// lost-work incidents (2026-05-09) plus a more recent near-miss traced to
// agents committing/rebasing/pushing against `/Users/marc/code/Bank`
// instead of their own dispatched worktree. This guard operationalises the
// existing isolation rule as a fail-closed control (Engineering Charter
// `D-ENGINEERING-INTEGRITY-CHARTER` command 2 — fail-closed by default).
//
// The three legitimate main-worktree writers are the repo-tracked launchd
// jobs that commit scheduler/archive/golden-source outputs to main:
//   - com.scrooge.event-store-archive
//   - com.scrooge.scheduler-tick
//   - com.scrooge.golden-source-integrity-tick
// They opt in by carrying `BANK_ALLOW_MAIN_WORKTREE_WRITE=1` in their
// launchd `<EnvironmentVariables>` block (rendered via install.sh). Marc's
// interactive use is recognised by an attached TTY. Everything else —
// notably a dispatched agent that has wandered into main — is DENIED.
//
// Why a TS module (not pure shell): disciplined, branch-by-branch testable
// decision logic with a single fail-closed default is easy to get wrong in
// `bash` conditionals. The pure function below is unit-tested across every
// branch; the hooks are thin shims that feed it git-resolved inputs.
//
// Authority:
//   - CLAUDE.md §"Dispatch discipline → Worktree isolation" (existing rule).
//   - Engineering Charter D-ENGINEERING-INTEGRITY-CHARTER command 2
//     (fail-closed by default).
//
// Author: Atlas (Core banking platform architect, engineering).

/**
 * The opt-in environment variable a legitimate main-worktree writer must
 * carry. Set to `"1"` in the launchd `<EnvironmentVariables>` block for the
 * three allowlisted jobs. Any other value (or absence) is treated as
 * not-allowlisted — fail-closed.
 */
export const ALLOW_ENV_VAR = "BANK_ALLOW_MAIN_WORKTREE_WRITE";

/**
 * Inputs to the guard decision. All paths are expected to be absolute and
 * already canonicalised by the caller (the hook shim resolves them via
 * `git rev-parse`). Keeping the function pure — no filesystem or git calls
 * — is what makes every branch unit-testable without ever touching the real
 * main worktree.
 */
export interface GuardInput {
  /**
   * Absolute path of the working-tree toplevel the git operation runs in
   * (`git rev-parse --show-toplevel`). For a dispatched agent this is its
   * own worktree; for a main-worktree operation it equals `canonicalMain`.
   */
  readonly worktreeToplevel: string;
  /**
   * Absolute path of the canonical main worktree. Resolved robustly by the
   * caller as the parent directory of `git rev-parse --git-common-dir`
   * (the common git dir is `<main>/.git` for every linked worktree), so it
   * is never a brittle hardcoded literal.
   */
  readonly canonicalMain: string;
  /**
   * Whether the legitimate-writer opt-in env var is set to exactly `"1"`.
   * The caller reads `process.env[ALLOW_ENV_VAR]`.
   */
  readonly allowEnvSet: boolean;
  /**
   * Whether the invoking process has an interactive TTY attached
   * (`process.stdin.isTTY` / `process.stdout.isTTY`). True for Marc's
   * interactive shell; false for launchd jobs and dispatched agents.
   */
  readonly isTty: boolean;
}

/**
 * The guard verdict. `allow === false` means the hook MUST exit non-zero
 * and abort the git operation. `reason` is a human-readable explanation
 * surfaced to the actor (loud, naming the worktree-isolation rule on deny).
 */
export interface GuardDecision {
  readonly allow: boolean;
  readonly reason: string;
}

/**
 * Normalise an absolute path for comparison: strip a single trailing slash
 * (but never reduce the filesystem root `/` to an empty string). The hook
 * shim already passes `git rev-parse` output, which has no trailing slash,
 * but normalising here makes the function robust to callers that don't.
 */
function normalisePath(p: string): string {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

/**
 * Decide whether a mutating git operation may proceed.
 *
 * Branches (in evaluation order):
 *   1. toplevel ≠ canonical main  → ALLOW. Agent worktrees and the
 *      `.dashboard-live` worktree are structurally unaffected — the guard
 *      only ever fires inside `/Users/marc/code/Bank` itself.
 *   2. in main + opt-in env set   → ALLOW. The three launchd allowlist
 *      jobs carry `BANK_ALLOW_MAIN_WORKTREE_WRITE=1`.
 *   3. in main + interactive TTY  → ALLOW. Marc's interactive use.
 *   4. in main + neither          → DENY (fail-closed). Almost certainly a
 *      dispatched agent that strayed into main; abort loudly.
 *
 * The default is DENY: any path not explicitly allowed above is refused.
 */
export function decideMainWorktreeWrite(input: GuardInput): GuardDecision {
  const toplevel = normalisePath(input.worktreeToplevel);
  const canonicalMain = normalisePath(input.canonicalMain);

  // Branch 1 — not the main worktree: never our concern.
  if (toplevel !== canonicalMain) {
    return {
      allow: true,
      reason: `worktree '${toplevel}' is not the canonical main worktree '${canonicalMain}' — guard does not apply`,
    };
  }

  // Branch 2 — legitimate launchd writer (allowlist opt-in).
  if (input.allowEnvSet) {
    return {
      allow: true,
      reason: `main-worktree write permitted: ${ALLOW_ENV_VAR}=1 (allowlisted launchd writer)`,
    };
  }

  // Branch 3 — Marc's interactive use.
  if (input.isTty) {
    return {
      allow: true,
      reason: "main-worktree write permitted: interactive TTY (CEO / human operator)",
    };
  }

  // Branch 4 — fail-closed default: deny.
  return {
    allow: false,
    reason: denyMessage(canonicalMain),
  };
}

/**
 * The loud deny message. Names the worktree-isolation rule and instructs the
 * actor to return to its dispatched worktree. Exported so the hook shim and
 * the tests assert the exact text.
 */
export function denyMessage(canonicalMain: string): string {
  return [
    "",
    "  ┌─────────────────────────────────────────────────────────────────────┐",
    "  │  BLOCKED: mutating git op against the CANONICAL MAIN worktree         │",
    "  └─────────────────────────────────────────────────────────────────────┘",
    "",
    `  This operation targets the main worktree:  ${canonicalMain}`,
    "",
    "  Dispatched agents must NEVER commit, rebase, or push against the main",
    '  worktree (CLAUDE.md §"Dispatch discipline → Worktree isolation"). Three',
    "  lost-work incidents (2026-05-09) plus a near-miss traced to exactly this.",
    "",
    "  What to do:",
    "    • If you are a dispatched agent: `cd` back into YOUR dispatched",
    "      worktree (under .claude/worktrees/…) and run the git op there.",
    "    • This guard is fail-closed by default (Engineering Charter command 2).",
    "",
    `  Legitimate launchd writers carry ${ALLOW_ENV_VAR}=1; Marc's interactive`,
    "  shell is recognised by its TTY. Neither was present, so this is denied.",
    "",
  ].join("\n");
}

/**
 * CLI entry point used by the git hook shims (`.githooks/pre-commit`,
 * `pre-rebase`, and the folded check in `pre-push`). Resolves the live git
 * inputs, calls the pure decision function, prints the reason on deny, and
 * exits 0 (allow) / 1 (deny).
 *
 * Inputs are resolved here (the impure shell):
 *   - worktreeToplevel: `git rev-parse --show-toplevel`
 *   - canonicalMain:    parent dir of `git rev-parse --git-common-dir`
 *   - allowEnvSet:      process.env[ALLOW_ENV_VAR] === "1"
 *   - isTty:            stdin OR stdout is a TTY
 *
 * Kept out of the pure module's test surface — the tests exercise
 * `decideMainWorktreeWrite` directly across every branch and never shell out.
 */
export async function runGuardCli(): Promise<number> {
  const { spawnSync } = await import("node:child_process");
  const { dirname, resolve } = await import("node:path");

  const git = (args: readonly string[]): string => {
    const r = spawnSync("git", [...args], { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(
        `git ${args.join(" ")} failed (status ${String(r.status)}): ${r.stderr ?? ""}`,
      );
    }
    return r.stdout.trim();
  };

  let worktreeToplevel: string;
  let canonicalMain: string;
  try {
    worktreeToplevel = resolve(git(["rev-parse", "--show-toplevel"]));
    // `--git-common-dir` is `<main>/.git` (possibly relative); resolve it,
    // then take its parent — that is the canonical main worktree toplevel.
    const commonDir = resolve(git(["rev-parse", "--git-common-dir"]));
    canonicalMain = dirname(commonDir);
  } catch (err) {
    // Fail-closed on resolution failure: if we cannot prove we are OUTSIDE
    // main, we refuse. A broken git invocation must not silently bypass.
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `main-worktree-guard: could not resolve git worktree paths — failing closed.\n  ${message}\n`,
    );
    return 1;
  }

  const allowEnvSet = process.env[ALLOW_ENV_VAR] === "1";
  const isTty = Boolean(process.stdin.isTTY) || Boolean(process.stdout.isTTY);

  const decision = decideMainWorktreeWrite({
    worktreeToplevel,
    canonicalMain,
    allowEnvSet,
    isTty,
  });

  if (!decision.allow) {
    process.stderr.write(`${decision.reason}\n`);
    return 1;
  }
  return 0;
}

// Direct execution (`bun run …/main-worktree-guard.ts`) runs the CLI. When
// imported (by the tests) this block is skipped, keeping the module pure for
// unit testing.
if (import.meta.main) {
  runGuardCli()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `main-worktree-guard: unexpected error — failing closed.\n  ${message}\n`,
      );
      process.exit(1);
    });
}
