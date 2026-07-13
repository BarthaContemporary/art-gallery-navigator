#!/usr/bin/env bash
# ===========================================================================
# provision.sh — one-time(ish) setup of a fresh Ubuntu 24.04 Vultr VPS for
# the self-hosted Supabase stack (BUILD_PLAN §2).
#
# Run as root on the new instance:
#   scp provision.sh root@<ip>: && ssh root@<ip> 'bash provision.sh'
#
# The script is idempotent-ish: every block either checks before acting or
# uses operations that are safe to repeat, so re-running after a partial
# failure is fine.
#
# AFTER it completes:
#   1. Confirm you can SSH as $DEPLOY_USER on port $SSH_PORT BEFORE closing
#      your root session (the old port 22 is no longer allowed by UFW).
#   2. Clone the repo and bring up the stack (see "clone note" at the bottom
#      and infra/README.md).
# ===========================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Tunables — review before running.
# ---------------------------------------------------------------------------
DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-2222}"          # non-default port cuts drive-by noise
SSH_PUBKEY="${SSH_PUBKEY:-}"          # optional: pubkey for the deploy user;
                                      # defaults to root's authorized_keys

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# Base packages + full upgrade.
# ---------------------------------------------------------------------------
apt-get update
apt-get -y upgrade
apt-get -y install ca-certificates curl gnupg ufw fail2ban \
  unattended-upgrades apt-listchanges rclone

# ---------------------------------------------------------------------------
# Deploy user — day-to-day work never happens as root. Gets sudo and (later)
# the docker group. Password login stays disabled; keys only.
# ---------------------------------------------------------------------------
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"

# Seed the deploy user's authorized_keys (from $SSH_PUBKEY or root's keys).
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
if [[ -n "$SSH_PUBKEY" ]]; then
  echo "$SSH_PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
elif [[ -f /root/.ssh/authorized_keys ]]; then
  cat /root/.ssh/authorized_keys >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
sort -u -o "/home/$DEPLOY_USER/.ssh/authorized_keys" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

# ---------------------------------------------------------------------------
# SSH hardening — drop-in config (survives package upgrades, easy to review):
# custom port, keys only, no root login. sshd is validated before restart so
# a typo cannot lock us out with a broken daemon.
# ---------------------------------------------------------------------------
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<EOF
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
X11Forwarding no
MaxAuthTries 4
AllowUsers $DEPLOY_USER
EOF
sshd -t
# Ubuntu 24.04 uses ssh.socket activation by default; override the port there
# too, otherwise systemd keeps listening on 22.
mkdir -p /etc/systemd/system/ssh.socket.d
cat > /etc/systemd/system/ssh.socket.d/listen.conf <<EOF
[Socket]
ListenStream=
ListenStream=$SSH_PORT
EOF
systemctl daemon-reload
systemctl restart ssh.socket ssh

# ---------------------------------------------------------------------------
# UFW — default deny inbound; only HTTP/HTTPS (Caddy) and our SSH port.
# Postgres/Kong/Studio are never exposed: they bind to 127.0.0.1 in compose.
# ---------------------------------------------------------------------------
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp comment 'caddy http (acme + redirect)'
ufw allow 443/tcp comment 'caddy https'
ufw allow "$SSH_PORT"/tcp comment 'ssh (custom port)'
ufw --force enable

# ---------------------------------------------------------------------------
# fail2ban — ban brute-forcers on the custom SSH port.
# ---------------------------------------------------------------------------
cat > /etc/fail2ban/jail.local <<EOF
[sshd]
enabled  = true
port     = $SSH_PORT
maxretry = 4
bantime  = 1h
findtime = 15m
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ---------------------------------------------------------------------------
# Unattended upgrades — security patches apply automatically. Reboots stay
# manual (we want to schedule Postgres downtime ourselves).
# ---------------------------------------------------------------------------
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades

# ---------------------------------------------------------------------------
# Docker Engine + compose plugin — from Docker's official apt repo (the
# Ubuntu 'docker.io' package lags and lacks the compose v2 plugin).
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get -y install docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
# Deploy user drives the stack without sudo. NOTE: docker group membership is
# root-equivalent — acceptable here because $DEPLOY_USER is the sole admin.
usermod -aG docker "$DEPLOY_USER"

# ---------------------------------------------------------------------------
# Caddy — runs on the HOST (not in compose) as TLS terminator / reverse
# proxy for kong + studio. Official Caddy apt repo.
# ---------------------------------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get -y install caddy
fi
systemctl enable --now caddy

# ---------------------------------------------------------------------------
# Kernel tuning — Postgres in a container wants memory overcommit enabled
# (otherwise fork()s under memory pressure fail spuriously).
# ---------------------------------------------------------------------------
cat > /etc/sysctl.d/99-jvb.conf <<'EOF'
vm.overcommit_memory = 1
EOF
sysctl --system >/dev/null

# ---------------------------------------------------------------------------
# Clone note — the app repo is private; we do NOT clone here because that
# needs a deploy key/token decided at handover. As $DEPLOY_USER:
#
#   sudo install -d -o deploy -g deploy /opt/jvb
#   git clone git@github.com:<org>/<repo>.git /opt/jvb     # via deploy key
#   cd /opt/jvb/infra/compose
#   cp .env.example .env && chmod 600 .env                 # fill in secrets
#   sudo cp Caddyfile /etc/caddy/Caddyfile                 # set real domains
#   sudo systemctl reload caddy
#   docker compose up -d
#
# Full runbook: infra/README.md
# ---------------------------------------------------------------------------

echo "----------------------------------------------------------------------"
echo "Provisioning complete."
echo "  * SSH:    port $SSH_PORT, user $DEPLOY_USER, keys only, root disabled"
echo "  * UFW:    80, 443, $SSH_PORT/tcp only"
echo "  * Docker: $(docker --version)"
echo "  * Caddy:  $(caddy version)"
echo "VERIFY ssh -p $SSH_PORT $DEPLOY_USER@<ip> works BEFORE closing this session."
echo "----------------------------------------------------------------------"
