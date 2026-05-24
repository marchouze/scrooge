#!/usr/bin/env bash
#
# install.sh — install Scrooge LaunchAgents on macOS.
#
# Installs two agents:
#   com.scrooge.scheduler-tick      — fires every 60 s (agent scheduler)
#   com.scrooge.event-store-archive — fires every 6 h  (archive threshold check)
#
# Authority: D-AGENT-AUTONOMY-OPERATIONAL (scheduler-tick, 2026-05-11)
#            D-EVENT-STORE-SCALING-PHASE-5 (event-store-archive, 2026-05-24)
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
#   BUN          path to bun binary           (default: which bun)
#   LOG_DIR      directory for stdout/stderr  (default: ~/Library/Logs/scrooge)
#
# .env.local propagation:
#   If `prototype/.env.local` exists, this script extracts whitelisted
#   `BANK_*` keys and injects them into the plist <EnvironmentVariables>
#   dict via the `render-env-block.ts` helper. If absent or empty, the
#   plist installs with PATH only (current behaviour preserved).
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
PROTOTYPE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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
# Both agents use the same env so we render it once.
# --------------------------------------------------------------------
ENV_LOCAL="${PROTOTYPE_DIR}/.env.local"
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
echo "  BUN_PATH         = ${BUN_PATH}"
echo "  WorkingDirectory = ${PROTOTYPE_DIR}"
echo "  LOG_DIR          = ${LOG_DIR}"

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
     | grep -q "__BUN_PATH__\|__WORKING_DIRECTORY__\|__LOG_DIR__\|__ENVIRONMENT_VARIABLES__"; then
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
# Install both agents.
# --------------------------------------------------------------------
install_agent "com.scrooge.scheduler-tick"      "com.scrooge.scheduler-tick.plist"
install_agent "com.scrooge.event-store-archive" "com.scrooge.event-store-archive.plist"

echo ""
echo "install.sh: all agents installed."
echo "  Scheduler logs: tail -f ${LOG_DIR}/scheduler-tick.log"
echo "  Archive logs:   tail -f ${LOG_DIR}/event-store-archive.log"
