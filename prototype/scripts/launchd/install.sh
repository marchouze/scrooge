#!/usr/bin/env bash
#
# install.sh — install the scrooge scheduler-tick LaunchAgent on macOS.
#
# Slice 1 of D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11).
# Renders com.scrooge.scheduler-tick.plist with absolute paths
# substituted, writes it to ~/Library/LaunchAgents/, and bootstraps
# it via launchctl. Idempotent.
#
# Author: Atlas (Core banking platform architect; substrate)
#
# Usage:
#   bash prototype/scripts/launchd/install.sh
#
# Environment overrides:
#   BUN          path to bun binary           (default: which bun)
#   LOG_DIR      directory for stdout/stderr  (default: ~/Library/Logs/scrooge)
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
# Render the plist with absolute paths substituted.
# --------------------------------------------------------------------
echo "install.sh: rendering plist with"
echo "  BUN_PATH         = ${BUN_PATH}"
echo "  WorkingDirectory = ${PROTOTYPE_DIR}"
echo "  LOG_DIR          = ${LOG_DIR}"

# Use a temp file so a half-written render never overwrites the live
# target. We rely on `mv` being atomic on the same filesystem.
TMP_PLIST="$(mktemp -t com.scrooge.scheduler-tick.plist.XXXXXX)"
trap 'rm -f "${TMP_PLIST}"' EXIT

# Pipe through three sed expressions. Token format chosen to be
# distinct from anything that would appear in real content.
sed \
  -e "s|__BUN_PATH__|${BUN_PATH}|g" \
  -e "s|__WORKING_DIRECTORY__|${PROTOTYPE_DIR}|g" \
  -e "s|__LOG_DIR__|${LOG_DIR}|g" \
  "${TEMPLATE_PLIST}" > "${TMP_PLIST}"

# Sanity-check: verify no tokens remain.
if grep -q "__BUN_PATH__\|__WORKING_DIRECTORY__\|__LOG_DIR__" "${TMP_PLIST}"; then
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

# Move the rendered plist into place.
mv "${TMP_PLIST}" "${TARGET_PLIST}"
trap - EXIT
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
