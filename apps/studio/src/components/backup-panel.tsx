import { getSupabase } from "@/lib/supabase";
import { Badge, type Tone } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";

/**
 * Admin-only backup health panel for the dashboard. Reads the latest run per
 * kind from backup_runs (written by the VPS backup script) and flags anything
 * older than its expected cadence — the in-app complement to the external
 * healthchecks.io dead-man's-switch.
 */
const KINDS: { kind: string; label: string; maxAgeHours: number; cadence: string }[] = [
  { kind: "db", label: "Database", maxAgeHours: 26, cadence: "nightly" },
  { kind: "webdav", label: "Shared drive", maxAgeHours: 26, cadence: "nightly" },
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
  // A state colour always comes with its word (spec R4): overdue is warn,
  // never recorded is danger.
  const tone = (state: string): Tone => (state === "ok" ? "ok" : state === "stale" ? "warn" : "danger");

  return (
    <Section
      title="Backups"
      actions={
        <Badge tone={worst ? "warn" : "ok"}>{worst ? "Needs attention" : "All healthy"}</Badge>
      }
    >
      <ul>
        {rows.map((r) => (
          <li
            key={r.kind}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-rule py-2 text-[13px]"
          >
            <span>
              <Badge variant="dot" tone={tone(r.state)}>
                <span className="text-ink">{r.label}</span>
              </Badge>
              <span className="text-[12px] text-meta"> · {r.cadence}</span>
            </span>
            <span
              className={`text-[12px] ${
                r.state === "missing" ? "text-danger" : r.state === "stale" ? "text-warn" : "text-meta"
              }`}
            >
              {r.state === "missing"
                ? "No backup recorded yet"
                : r.state === "stale"
                  ? `Overdue: last run ${ago(r.run!.created_at, now)}`
                  : `Last run ${ago(r.run!.created_at, now)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] leading-[1.4] text-meta">
        Off-site to Vultr object storage (drive encrypted at rest). A missed backup also alerts by
        email via healthchecks.io.
      </p>
    </Section>
  );
}
