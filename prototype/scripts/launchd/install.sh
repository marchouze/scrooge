#!/usr/bin/env bash
#
# install.sh — install Scrooge LaunchAgents on macOS.
#
# Installs four agents:
#   com.scrooge.scheduler-tick             — fires every 60 s (agent scheduler)
#   com.scrooge.scheduler-autopull         — every 30 s; pins .scheduler-live to origin/main
#   com.scrooge.event-store-archive        — fires every 6 h  (archive threshold check)
#   com.scrooge.golden-source-integrity-tick — fires daily (shared-store golden-source assertion)
#
# Authority: D-AGENT-AUTONOMY-OPERATIONAL (scheduler-tick, 2026-05-11)
#            D-SCHEDULER-DEPLOY-DECOUPLE (scheduler-autopull + clean-worktree run, 2026-06-22)
#            D-EVENT-STORE-SCALING-PHASE-5 (event-store-archive, 2026-05-24)
#            D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION (golden-source-integrity-tick, 2026-06-13)
#
# Author: Atlas (Core banking platform architect; substrate).
# Co-author: Devon (Chief Operating Officer, governance) — .env.local
# propagation (2026-05-21 brief: `brief:devon:twelve-data-ingest-
# propagate-bank-twelvedata-api:2026-05-21`).
#
# Usage:
#   bash prototype/scripts/launchd/install.sh
#
# Environment overrides:
#   BUN                  path to bun binary           (default: which bun)
#   LOG_DIR              directory for stdout/stderr  (default: ~/Library/Logs/scrooge)
#   SCHEDULER_LIVE_DIR   the clean origin/main-pinned scheduler worktree
#                        (default: <canonical-main>/.scheduler-live, derived
#                         from `git rev-parse --git-common-dir`).
#
# Clean-worktree deploy topology (D-SCHEDULER-DEPLOY-DECOUPLE):
#   The scheduler-tick job runs from a DEDICATED CLEAN worktree
#   (`.scheduler-live`) that the companion `com.scrooge.scheduler-autopull`
#   agent keeps pinned to origin/main (`git fetch origin main && git reset
#   --hard origin/main`). This mirrors the dashboard's `.dashboard-live` +
#   `com.scrooge.dashboard-autopull` topology. The scheduler-tick no longer
#   self-updates its own code in-process, and no longer commits derived
#   archive renders to the main worktree.
#
# .env.local propagation:
#   If `prototype/.env.local` exists, this script extracts whitelisted
#   `BANK_*` keys and injects them into the plist <EnvironmentVariables>
#   dict via the `render-env-block.ts` helper. If absent or empty, the
#   plist installs with PATH only (current behaviour preserved).
#
# Main-worktree write-guard opt-in (NO LONGER NEEDED — D-SCHEDULER-DEPLOY-DECOUPLE):
#   After the deploy decouple, NONE of these jobs commit to the canonical main
#   worktree: scheduler-tick performs zero git ops; scheduler-autopull only
#   `reset --hard`s the serve-only `.scheduler-live` worktree; event-store-archive
#   writes only to the gitignored `~/.local/share/bank/archives/` store; and
#   golden-source-integrity-tick emits events only (its hash is never committed,
#   `data/documents/*` is gitignored). The `BANK_ALLOW_MAIN_WORKTREE_WRITE=1`
#   allowlist opt-in is therefore NO LONGER injected into any plist. The
#   fail-closed `.githooks` guard (`scripts/githooks/main-worktree-guard.ts`)
#   stays in force as a general control; Marc's interactive TTY remains the only
#   recognised legitimate main-worktree writer.
#   Authority: D-SCHEDULER-DEPLOY-DECOUPLE; CLAUDE.md §"Dispatch discipline →
#   Worktree isolation"; Engineering Charter D-ENGINEERING-INTEGRITY-CHARTER cmd 2.
#
set -euo pipefail

# --------------------------------------------------------------------
# Sanity: macOS only.
# --------------------------------------------------------------------
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "install.sh: this is the macOS launchd installer; on Linux use" >&2
  echo "  systemctl --user enable --now com.scrooge.scheduler-tick.timer" >&2
  echo "(see README.md)." >&2
  exit 2
fi

# --------------------------------------------------------------------
# Resolve paths.
# --------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The worktree the installer is being RUN from. Templates + the env-block are
# read from here; the installed jobs, however, run from the clean autopulled
# .scheduler-live worktree (resolved below) so they always execute origin/main.
INSTALLER_PROTOTYPE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# --------------------------------------------------------------------
# Resolve the clean origin/main-pinned scheduler worktree.
#   - Override with SCHEDULER_LIVE_DIR=/abs/path.
#   - Default: <canonical-main>/.scheduler-live, where <canonical-main> is the
#     parent of `git rev-parse --git-common-dir` (the common git dir is
#     `<main>/.git` for every linked worktree). Derivation — no brittle literal
#     (Engineering Charter command 4: source, don't hardcode).
# The launchd jobs run from $SCHEDULER_LIVE_DIR/prototype so the companion
# com.scrooge.scheduler-autopull agent's `git reset --hard origin/main` keeps
# their code current (D-SCHEDULER-DEPLOY-DECOUPLE).
# --------------------------------------------------------------------
if [[ -z "${SCHEDULER_LIVE_DIR:-}" ]]; then
  COMMON_GIT_DIR="$(cd "${INSTALLER_PROTOTYPE_DIR}" && git rev-parse --git-common-dir 2>/dev/null || true)"
  if [[ -z "${COMMON_GIT_DIR}" ]]; then
    echo "install.sh: cannot resolve git common dir; set SCHEDULER_LIVE_DIR=/abs/path" >&2
    exit 1
  fi
  # `--git-common-dir` may be relative to INSTALLER_PROTOTYPE_DIR — resolve it.
  COMMON_GIT_DIR="$(cd "${INSTALLER_PROTOTYPE_DIR}" && cd "${COMMON_GIT_DIR}" && pwd)"
  CANONICAL_MAIN="$(dirname "${COMMON_GIT_DIR}")"
  SCHEDULER_LIVE_DIR="${CANONICAL_MAIN}/.scheduler-live"
fi

# WorkingDirectory for every launchd job: the prototype dir INSIDE the clean
# live worktree. The autopull agent keeps this checkout pinned to origin/main.
PROTOTYPE_DIR="${SCHEDULER_LIVE_DIR}/prototype"

# The autopull helper script lives in the live worktree too (so it is itself
# kept current by the mirror).
SCHEDULER_AUTOPULL_SCRIPT="${PROTOTYPE_DIR}/scripts/launchd/scrooge-scheduler-autopull.sh"

if [[ ! -d "${SCHEDULER_LIVE_DIR}" ]]; then
  echo "install.sh: WARNING — scheduler-live worktree '${SCHEDULER_LIVE_DIR}' does not exist yet." >&2
  echo "             Create it before the jobs can run, e.g.:" >&2
  echo "               git -C '${CANONICAL_MAIN:-/Users/marc/code/Bank}' worktree add --detach '${SCHEDULER_LIVE_DIR}' origin/main" >&2
  echo "             Templates + env are still read from the installer worktree;" >&2
  echo "             the jobs simply won't tick until the live worktree exists." >&2
fi

# Resolve bun. Honour BUN override if set.
BUN_PATH="${BUN:-$(command -v bun || true)}"
if [[ -z "${BUN_PATH}" ]]; then
  echo "install.sh: cannot find 'bun' on PATH; set BUN=/path/to/bun" >&2
  exit 1
fi
if [[ ! -x "${BUN_PATH}" ]]; then
  echo "install.sh: bun at '${BUN_PATH}' is not executable" >&2
  exit 1
fi

LOG_DIR="${LOG_DIR:-${HOME}/Library/Logs/scrooge}"
mkdir -p "${LOG_DIR}"

LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
mkdir -p "${LAUNCH_AGENTS_DIR}"

# --------------------------------------------------------------------
# Resolve .env.local and render the shared <EnvironmentVariables> block.
# All agents use the same env so we render it once.
#
# `.env.local` is gitignored, so the freshly-created `.scheduler-live` worktree
# will NOT contain it. Read it from the installer worktree (where Marc keeps it).
# The BANK_* keys are injected into the plist env block from here. NON-BANK keys
# (e.g. GEMINI_API_KEY / ANTHROPIC_API_KEY) are loaded by Bun from the job's CWD
# at process start, so a copy of `.env.local` must also be present at
# $PROTOTYPE_DIR/.env.local — see the deploy runbook (copy/symlink step).
# --------------------------------------------------------------------
ENV_LOCAL="${INSTALLER_PROTOTYPE_DIR}/.env.local"
ENV_BLOCK_RENDERER="${SCRIPT_DIR}/render-env-block.ts"

if [[ ! -f "${ENV_BLOCK_RENDERER}" ]]; then
  echo "install.sh: missing env-block renderer at ${ENV_BLOCK_RENDERER}" >&2
  exit 1
fi

ENV_BLOCK_TMP="$(mktemp -t scrooge-env-block.XXXXXX)"
trap "rm -f '${ENV_BLOCK_TMP}'" EXIT

if [[ -f "${ENV_LOCAL}" ]]; then
  echo "install.sh: reading .env.local at ${ENV_LOCAL}"
else
  echo "install.sh: WARNING — ${ENV_LOCAL} does not exist." >&2
  echo "             Plists will install with PATH-only env." >&2
fi

if ! "${BUN_PATH}" run "${ENV_BLOCK_RENDERER}" "${ENV_LOCAL}" > "${ENV_BLOCK_TMP}"; then
  echo "install.sh: env-block renderer failed; refusing to install." >&2
  exit 1
fi

echo "install.sh: rendering plists with"
echo "  BUN_PATH            = ${BUN_PATH}"
echo "  SCHEDULER_LIVE_DIR  = ${SCHEDULER_LIVE_DIR}"
echo "  WorkingDirectory    = ${PROTOTYPE_DIR}  (inside the clean live worktree)"
echo "  AutopullScript      = ${SCHEDULER_AUTOPULL_SCRIPT}"
echo "  LOG_DIR             = ${LOG_DIR}"

# --------------------------------------------------------------------
# Shared render-and-bootstrap function.
#   $1 — label (e.g. com.scrooge.scheduler-tick)
#   $2 — template plist filename (basename only)
# --------------------------------------------------------------------
install_agent() {
  local label="$1"
  local template_name="$2"
  local template="${SCRIPT_DIR}/${template_name}"
  local target="${LAUNCH_AGENTS_DIR}/${label}.plist"
  local domain="gui/$(id -u)/${label}"

  if [[ ! -f "${template}" ]]; then
    echo "install.sh: missing template at ${template}" >&2
    return 1
  fi

  local tmp
  tmp="$(mktemp -t "${label}.plist.XXXXXX")"
  # Clean up temp file on function exit (not process exit — the outer
  # trap handles ENV_BLOCK_TMP).
  # shellcheck disable=SC2064
  trap "rm -f '${tmp}'" RETURN

  sed \
    -e "s|__BUN_PATH__|${BUN_PATH}|g" \
    -e "s|__WORKING_DIRECTORY__|${PROTOTYPE_DIR}|g" \
    -e "s|__LOG_DIR__|${LOG_DIR}|g" \
    -e "s|__SCHEDULER_AUTOPULL_SCRIPT__|${SCHEDULER_AUTOPULL_SCRIPT}|g" \
    -e "s|__SCHEDULER_LIVE_DIR__|${SCHEDULER_LIVE_DIR}|g" \
    "${template}" \
  | awk -v block_file="${ENV_BLOCK_TMP}" '
      /^[[:space:]]*__ENVIRONMENT_VARIABLES__[[:space:]]*$/ {
        while ((getline line < block_file) > 0) print line
        close(block_file)
        next
      }
      { print }
    ' \
  > "${tmp}"

  if grep -v "^\s*<!--\|^\s*-\s\|^\s*\*" "${tmp}" \
     | grep -q "__BUN_PATH__\|__WORKING_DIRECTORY__\|__LOG_DIR__\|__ENVIRONMENT_VARIABLES__\|__SCHEDULER_AUTOPULL_SCRIPT__\|__SCHEDULER_LIVE_DIR__"; then
    echo "install.sh: token substitution failed for ${label}" >&2
    return 1
  fi

  if command -v plutil >/dev/null 2>&1; then
    if ! plutil -lint "${tmp}" >/dev/null; then
      echo "install.sh: plutil -lint failed for ${label}" >&2
      return 1
    fi
  fi

  local already_loaded=0
  if launchctl print "${domain}" >/dev/null 2>&1; then
    already_loaded=1
  fi

  if [[ "${already_loaded}" -eq 1 && -f "${target}" ]] && cmp -s "${tmp}" "${target}"; then
    echo "install.sh: ${label} — already installed and up-to-date."
    return 0
  fi

  if [[ "${already_loaded}" -eq 1 ]]; then
    echo "install.sh: ${label} — bootout existing, then re-bootstrap"
    launchctl bootout "${domain}" || true
  fi

  mv "${tmp}" "${target}"
  chmod 0644 "${target}"

  echo "install.sh: bootstrapping ${label}"
  launchctl bootstrap "gui/$(id -u)" "${target}"

  if launchctl print "${domain}" >/dev/null 2>&1; then
    echo "install.sh: ${label} — installed."
  else
    echo "install.sh: ${label} — bootstrap reported success but launchctl print failed." >&2
    return 1
  fi
}

# --------------------------------------------------------------------
# Install all agents.
# --------------------------------------------------------------------
install_agent "com.scrooge.scheduler-tick"             "com.scrooge.scheduler-tick.plist"
# Companion autopull: pins .scheduler-live to origin/main every 30s so the
# interval-driven scheduler-tick runs the latest merged code
# (D-SCHEDULER-DEPLOY-DECOUPLE). It carries an inline env dict (no
# __ENVIRONMENT_VARIABLES__ token) and performs NO main-worktree write.
install_agent "com.scrooge.scheduler-autopull"         "com.scrooge.scheduler-autopull.plist"
install_agent "com.scrooge.event-store-archive"        "com.scrooge.event-store-archive.plist"
# Daily shared-store golden-source integrity assertion
# (D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION).
install_agent "com.scrooge.golden-source-integrity-tick" "com.scrooge.golden-source-integrity-tick.plist"

echo ""
echo "install.sh: all agents installed."
echo "  Scheduler logs:  tail -f ${LOG_DIR}/scheduler-tick.log"
echo "  Autopull logs:   tail -f ${LOG_DIR}/scheduler-autopull.log"
echo "  Archive logs:   tail -f ${LOG_DIR}/event-store-archive.log"
