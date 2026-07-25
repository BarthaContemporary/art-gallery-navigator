# Backup systemd timers

These units replace the crontab entries that drove `infra/scripts/backup.sh`.
Timers are used instead of cron because a cron failure is silent (as happened
on 2026-07-25, when the DB cron pointed at a stale script and the dump went 30h
stale unnoticed). With timers:

- failures are visible in `journalctl -u <unit>`;
- `Persistent=true` runs a job that was missed while the box was powered down
  on the next boot, instead of skipping it;
- `HOME=/root` is pinned so `rclone`/`docker compose` find their config (a
  systemd service does not inherit root's login environment).

| Unit | Schedule | Job |
|------|----------|-----|
| `jvb-backup-db.timer`      | daily 02:30 UTC       | `backup.sh db` (Postgres dump) |
| `jvb-backup-webdav.timer`  | daily 03:00 UTC       | `backup.sh webdav-sync` |
| `jvb-backup-storage.timer` | weekly Sun 03:30 UTC  | `backup.sh storage-sync` (optional) |

The `db` job still writes to the `backup_runs` table and pings healthchecks.io,
so the studio dashboard's Backups panel is unchanged.

## Install / migrate from cron (run as root on the VPS)

```bash
# 1. Copy the unit files into place.
install -m 0644 /opt/jvb/infra/systemd/jvb-backup-db.service     /etc/systemd/system/
install -m 0644 /opt/jvb/infra/systemd/jvb-backup-db.timer       /etc/systemd/system/
install -m 0644 /opt/jvb/infra/systemd/jvb-backup-webdav.service /etc/systemd/system/
install -m 0644 /opt/jvb/infra/systemd/jvb-backup-webdav.timer   /etc/systemd/system/
systemctl daemon-reload

# 2. Prove the services work under systemd BEFORE trusting the timers
#    (this is where a HOME/rclone misconfig would surface).
systemctl start jvb-backup-db.service
journalctl -u jvb-backup-db.service -n 20 --no-pager    # expect "db backup complete"

# 3. Enable the timers.
systemctl enable --now jvb-backup-db.timer jvb-backup-webdav.timer

# 4. Retire the cron lines the timers now own.
crontab -l | grep -v 'backup.sh' | crontab -

# 5. Confirm the next fire times.
systemctl list-timers 'jvb-*' --no-pager
```

### Optional: weekly storage replica

Only enable after a manual test confirms the replica bucket + rclone remote:

```bash
systemctl start jvb-backup-storage.service
journalctl -u jvb-backup-storage.service -n 20 --no-pager
install -m 0644 /opt/jvb/infra/systemd/jvb-backup-storage.service /etc/systemd/system/
install -m 0644 /opt/jvb/infra/systemd/jvb-backup-storage.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now jvb-backup-storage.timer
```

## Verify / troubleshoot

```bash
systemctl list-timers 'jvb-*'          # next + last run per timer
systemctl status jvb-backup-db.timer   # is the timer active
journalctl -u jvb-backup-db.service    # full run history + any errors
```
