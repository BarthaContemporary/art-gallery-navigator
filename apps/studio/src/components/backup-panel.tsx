import { getSupabase } from "@/lib/supabase";

/**
 * Admin-only backup health panel for the dashboard. Reads the latest run per
 * kind from backup_runs (written by the VPS backup script) and flags anything
 * older than its expected cadence — the in-app complement to the external
 * healthchecks.io dead-man's-switch.
 */
const KINDS: { kind: string; label: string; maxAgeHours: number; cadence: string }[] = [
  { kind: "db", label: "Database", maxAgeHours: 26, cadence: "nightly" },
  { kind: "webdav", label: "Shared drive", maxAgeHours: 26, cadence: "nightly" },
  { kind: "storage", label: "Image storage", maxAgeHours: 24 * 8, cadence: "weekly" },
];

type Run = { kind: string; status: string; created_at: string; size_bytes: number | null };

function ago(iso: string, now: number): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export async function BackupPanel() {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("backup_runs")
    .select("kind, status, created_at, size_bytes")
    .order("created_at", { ascending: false })
    .limit(60);

  const latest = new Map<string, Run>();
  for (const r of (data ?? []) as Run[]) if (!latest.has(r.kind)) latest.set(r.kind, r);
  const now = Date.now();

  const rows = KINDS.map((k) => {
    const run = latest.get(k.kind);
    const ageMs = run ? now - new Date(run.created_at).getTime() : Infinity;
    const stale = ageMs > k.maxAgeHours * 3600_000;
    const state: "ok" | "stale" | "missing" = !run ? "missing" : stale ? "stale" : "ok";
    return { ...k, run, state };
  });

  const worst = rows.some((r) => r.state !== "ok");
  const dot = (state: string) =>
    state === "ok" ? "var(--jvb-status-green, #4E7A51)" : state === "stale" ? "#C9992B" : "#C0392B";

  return (
    <div className="rounded-[11px] border border-line bg-cell p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink-strong">Backups</h2>
        <span className={`text-[11px] ${worst ? "text-oranje" : "text-ink-soft"}`}>
          {worst ? "Needs attention" : "All healthy"}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.kind} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: dot(r.state) }} />
              <span className="text-[13px] text-ink-body">{r.label}</span>
              <span className="text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">{r.cadence}</span>
            </span>
            <span className="text-[11.5px] text-ink-soft">
              {r.state === "missing"
                ? "No backup recorded yet"
                : r.state === "stale"
                  ? `Overdue — last ${ago(r.run!.created_at, now)}`
                  : `${ago(r.run!.created_at, now)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-ink-soft">
        Off-site to Vultr object storage (drive encrypted at rest). A missed backup also alerts by
        email via healthchecks.io.
      </p>
    </div>
  );
}
