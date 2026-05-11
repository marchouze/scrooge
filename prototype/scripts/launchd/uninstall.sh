#!/usr/bin/env bash
#
# uninstall.sh — remove the scrooge scheduler-tick LaunchAgent on macOS.
#
# Slice 1 of D-AGENT-AUTONOMY-OPERATIONAL.
# Idempotent: safe to run when nothing is installed.
#
# Author: Atlas (Core banking platform architect; substrate)
#
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "uninstall.sh: macOS only; on Linux use" >&2
  echo "  systemctl --user disable --now com.scrooge.scheduler-tick.timer" >&2
  exit 2
fi

LABEL="com.scrooge.scheduler-tick"
TARGET_PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
DOMAIN_TARGET="gui/$(id -u)/${LABEL}"

if launchctl print "${DOMAIN_TARGET}" >/dev/null 2>&1; then
  echo "uninstall.sh: bootout ${DOMAIN_TARGET}"
  launchctl bootout "${DOMAIN_TARGET}" || true
else
  echo "uninstall.sh: ${DOMAIN_TARGET} not loaded; skipping bootout"
fi

if [[ -f "${TARGET_PLIST}" ]]; then
  echo "uninstall.sh: rm ${TARGET_PLIST}"
  rm -f "${TARGET_PLIST}"
else
  echo "uninstall.sh: ${TARGET_PLIST} absent; skipping rm"
fi

echo "uninstall.sh: done."
echo "  Logs at ~/Library/Logs/scrooge/ are NOT removed; rm them manually if desired."
