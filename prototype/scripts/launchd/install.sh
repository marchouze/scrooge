#!/usr/bin/env bash
#
# install.sh — install the scrooge scheduler-tick LaunchAgent on macOS.
#
# Slice 1 of D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11).
# Renders com.scrooge.scheduler-tick.plist with absolute paths
# substituted, writes it to ~/Library/LaunchAgents/, and bootstraps
# it via launchctl. Idempotent.
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
TEMPLATE_PLIST="${SCRIPT_DIR}/com.scrooge.scheduler-tick.plist"

if [[ ! -f "${TEMPLATE_PLIST}" ]]; then
  echo "install.sh: missing template plist at ${TEMPLATE_PLIST}" >&2
  exit 1
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

LABEL="com.scrooge.scheduler-tick"
TARGET_PLIST="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
DOMAIN_TARGET="gui/$(id -u)/${LABEL}"

# --------------------------------------------------------------------
# Resolve .env.local and render the <EnvironmentVariables> dict body.
# --------------------------------------------------------------------
ENV_LOCAL="${PROTOTYPE_DIR}/.env.local"
ENV_BLOCK_RENDERER="${SCRIPT_DIR}/render-env-block.ts"

if [[ ! -f "${ENV_BLOCK_RENDERER}" ]]; then
  echo "install.sh: missing env-block renderer at ${ENV_BLOCK_RENDERER}" >&2
  exit 1
fi

ENV_BLOCK_TMP="$(mktemp -t scheduler-tick-env-block.XXXXXX)"
# shellcheck disable=SC2064
trap "rm -f '${ENV_BLOCK_TMP}'" EXIT

if [[ -f "${ENV_LOCAL}" ]]; then
  echo "install.sh: reading .env.local at ${ENV_LOCAL}"
else
  echo "install.sh: WARNING — ${ENV_LOCAL} does not exist." >&2
  echo "             Plist will install with PATH-only env. Any handler" >&2
  echo "             that needs a BANK_* env var (e.g. devon:fx-twelvedata-" >&2
  echo "             ingest reading BANK_TWELVEDATA_API_KEY) will be a" >&2
  echo "             SubstrateAlert candidate at next fire." >&2
fi

# Run the TS renderer. It always writes a complete env-block (PATH plus
# any BANK_* keys) to stdout and prints diagnostics — counts + key NAMES
# only, never values — to stderr.
if ! "${BUN_PATH}" run "${ENV_BLOCK_RENDERER}" "${ENV_LOCAL}" > "${ENV_BLOCK_TMP}"; then
  echo "install.sh: env-block renderer failed; refusing to install." >&2
  exit 1
fi

# --------------------------------------------------------------------
# Render the plist with absolute paths + env block substituted.
# --------------------------------------------------------------------
echo "install.sh: rendering plist with"
echo "  BUN_PATH         = ${BUN_PATH}"
echo "  WorkingDirectory = ${PROTOTYPE_DIR}"
echo "  LOG_DIR          = ${LOG_DIR}"
echo "  ENV_LOCAL        = ${ENV_LOCAL}"

# Use a temp file so a half-written render never overwrites the live
# target. We rely on `mv` being atomic on the same filesystem.
TMP_PLIST="$(mktemp -t com.scrooge.scheduler-tick.plist.XXXXXX)"
# shellcheck disable=SC2064
trap "rm -f '${TMP_PLIST}' '${ENV_BLOCK_TMP}'" EXIT

# Render the plist. Path tokens go through sed; the env block goes
# through awk so its contents (which may include `&`, `|`, `<`, `>`)
# are not re-interpreted as sed replacement metacharacters.
sed \
  -e "s|__BUN_PATH__|${BUN_PATH}|g" \
  -e "s|__WORKING_DIRECTORY__|${PROTOTYPE_DIR}|g" \
  -e "s|__LOG_DIR__|${LOG_DIR}|g" \
  "${TEMPLATE_PLIST}" \
| awk -v block_file="${ENV_BLOCK_TMP}" '
    /^[[:space:]]*__ENVIRONMENT_VARIABLES__[[:space:]]*$/ {
      while ((getline line < block_file) > 0) print line
      close(block_file)
      next
    }
    { print }
  ' \
> "${TMP_PLIST}"

# Sanity-check: verify no tokens remain (skip XML comment lines which may
# mention token names as documentation prose).
if grep -v "^\s*<!--\|^\s*-\s\|^\s*\*" "${TMP_PLIST}" | grep -q "__BUN_PATH__\|__WORKING_DIRECTORY__\|__LOG_DIR__\|__ENVIRONMENT_VARIABLES__"; then
  echo "install.sh: token substitution failed; rendered plist still" >&2
  echo "contains placeholders. Refusing to install." >&2
  exit 1
fi

# Optional plutil lint if available.
if command -v plutil >/dev/null 2>&1; then
  if ! plutil -lint "${TMP_PLIST}" >/dev/null; then
    echo "install.sh: plutil -lint failed on rendered plist" >&2
    exit 1
  fi
fi

# --------------------------------------------------------------------
# Idempotent bootstrap.
# --------------------------------------------------------------------
already_loaded=0
if launchctl print "${DOMAIN_TARGET}" >/dev/null 2>&1; then
  already_loaded=1
fi

# If the rendered plist matches the live one byte-for-byte AND the
# job is loaded, we're done.
if [[ "${already_loaded}" -eq 1 && -f "${TARGET_PLIST}" ]] \
  && cmp -s "${TMP_PLIST}" "${TARGET_PLIST}"; then
  echo "install.sh: already installed and up-to-date — nothing to do."
  echo "  launchctl print ${DOMAIN_TARGET}"
  exit 0
fi

# If loaded but the plist differs, bootout first so bootstrap is clean.
if [[ "${already_loaded}" -eq 1 ]]; then
  echo "install.sh: existing job detected — bootout, then re-bootstrap"
  launchctl bootout "${DOMAIN_TARGET}" || true
fi

# Move the rendered plist into place. ENV_BLOCK_TMP is still owned by
# the trap and will be cleaned at exit.
mv "${TMP_PLIST}" "${TARGET_PLIST}"
# shellcheck disable=SC2064
trap "rm -f '${ENV_BLOCK_TMP}'" EXIT
chmod 0644 "${TARGET_PLIST}"

# Bootstrap.
echo "install.sh: bootstrapping ${DOMAIN_TARGET}"
launchctl bootstrap "gui/$(id -u)" "${TARGET_PLIST}"

# Verify.
if launchctl print "${DOMAIN_TARGET}" >/dev/null 2>&1; then
  echo "install.sh: installed."
  echo "  Verify: launchctl print ${DOMAIN_TARGET}"
  echo "  Logs:   tail -f ${LOG_DIR}/scheduler-tick.log"
else
  echo "install.sh: bootstrap reported success but launchctl print failed." >&2
  exit 1
fi
