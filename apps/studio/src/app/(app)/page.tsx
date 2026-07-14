import Link from "next/link";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";

export default async function Dashboard() {
  const supabase = await getSupabase();
  const session = await getSession();
  const financials = session ? canSeeFinancials(session.roles) : false;

  const [pieces, inStock, contacts, activity] = await Promise.all([
    supabase.from("pieces").select("id", { count: "exact", head: true }),
    supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_stock"),
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
    supabase
      .from("activity_log")
      .select("id, entity_type, entity_id, action, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const stats = [
    { label: "Records", value: pieces.count ?? 0, href: "/inventory" },
    { label: "In stock", value: inStock.count ?? 0, href: "/inventory?status=in_stock" },
    { label: "Contacts", value: contacts.count ?? 0, href: "/crm/contacts" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[11px] border border-line bg-line sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-cell px-4 py-4 hover:bg-control">
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              {s.label}
            </div>
            <div className="mt-1 font-mono text-[26px] text-ink-strong">{s.value}</div>
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Recent activity
        </h2>
        <ul className="mt-3 space-y-2">
          {(activity.data ?? []).map((a) => (
            <li key={a.id} className="grid grid-cols-[14px_1fr] items-baseline gap-2">
              <span
                aria-hidden
                className="mt-1 inline-block h-[7px] w-[7px] rounded-full bg-[var(--jvb-dot-mid)]"
              />
              <div>
                <span className="text-[13.5px] text-ink-body">
                  {a.action} {a.entity_type}
                </span>
                <span className="ml-2 font-mono text-[11px] text-ink-soft">
                  {new Date(a.created_at).toLocaleString("en-GB")}
                </span>
              </div>
            </li>
          ))}
          {(activity.data ?? []).length === 0 ? (
            <li className="text-[13px] text-ink-muted">No activity yet.</li>
          ) : null}
        </ul>
      </section>

      {!financials ? (
        <p className="mt-8 text-[12px] text-ink-soft">
          Financial figures are hidden for your role.
        </p>
      ) : null}
    </div>
  );
}
