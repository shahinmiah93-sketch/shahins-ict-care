#!/usr/bin/env bash
# Shahin's ICT Care — fresh Ubuntu VPS (22.04 / 24.04) setup.
# Installs Node.js 22, the website as a service that starts on boot and restarts if it crashes,
# cloudflared (the tunnel connector, connected later with the token), a firewall and daily backups.
# Safe to run again. Usage (as root):  bash setup-vps.sh
set -euo pipefail

APP_DIR=/opt/shahins-ict-care
APP_USER=sic

echo "== packages =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw unzip

echo "== Node.js 22 =="
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== app user and folder =="
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "== website service =="
cat >/etc/systemd/system/shahins-ict-care.service <<EOF
[Unit]
Description=Shahin's ICT Care website
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.mjs
Environment=NODE_ENV=production PORT=8090
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable shahins-ict-care >/dev/null

echo "== cloudflared =="
if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" >/etc/apt/sources.list.d/cloudflared.list
  apt-get update -y
  apt-get install -y cloudflared
fi
cloudflared --version

echo "== firewall: only SSH comes in (the website is reached through the tunnel) =="
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null
ufw status | head -5

echo "== daily backup of data/ (kept 14 days) at 03:30 =="
mkdir -p /var/backups/shahins-ict-care
cat >/etc/cron.d/shahins-ict-care-backup <<'EOF'
30 3 * * * root tar -czf /var/backups/shahins-ict-care/data-$(date +\%F).tar.gz -C /opt/shahins-ict-care data && find /var/backups/shahins-ict-care -name 'data-*.tar.gz' -mtime +14 -delete
EOF

echo "== done =="
