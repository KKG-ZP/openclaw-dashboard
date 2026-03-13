#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="openclaw-dashboard"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_FILE="$UNIT_DIR/${SERVICE_NAME}.service"

mkdir -p "$UNIT_DIR"

cat > "$UNIT_FILE" <<EOF
[Unit]
Description=OpenClaw Dashboard Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$DASHBOARD_DIR
ExecStart=/usr/bin/env node --expose-gc server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=44132
Environment=HOST=127.0.0.1
Environment=ENDPOINT_CACHE_MAX_ENTRIES=200
Environment=ENDPOINT_CACHE_SWEEP_MS=60000
Environment=WARMUP_BASE_MS=30000
Environment=WARMUP_MAX_MS=120000
Environment=MEMORY_SOFT_LIMIT_MB=512
Environment=MEMORY_GUARD_INTERVAL_MS=30000
Environment=MEMORY_GUARD_COOLDOWN_MS=180000

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

echo "Installed and started: $SERVICE_NAME"
echo "Status: systemctl --user status $SERVICE_NAME"
echo "Logs:   journalctl --user -u $SERVICE_NAME -f"
