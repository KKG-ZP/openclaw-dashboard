#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="openclaw-dashboard"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_FILE="$UNIT_DIR/${SERVICE_NAME}.service"

if systemctl --user is-active --quiet "$SERVICE_NAME"; then
  systemctl --user stop "$SERVICE_NAME"
fi

if systemctl --user is-enabled --quiet "$SERVICE_NAME"; then
  systemctl --user disable "$SERVICE_NAME"
fi

if [ -f "$UNIT_FILE" ]; then
  rm -f "$UNIT_FILE"
fi

systemctl --user daemon-reload
echo "Removed: $SERVICE_NAME"
