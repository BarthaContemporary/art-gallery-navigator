import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, getSupabase, hasRole } from "@/lib/supabase";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) redirect("/");

  const supabase = await getSupabase();
  const [{ data: profiles }, { data: roles }, { data: invitations }, { data: outbox }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("invitations").select("id, email, role, accepted_at, created_at").order("created_at", { ascending: false }),
      supabase.from("sync_outbox").select("id", { count: "exact", head: true }).is("processed_at", null),
    ]);

  const rolesByUser = new Map<string, string[]>();
  (roles ?? []).forEach((r) => {
    rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
  });

  async function invite(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("invitations").insert({
      email,
      role: String(formData.get("role") ?? "staff"),
      invited_by: user?.id,
    });
    // Sending the invite email via Resend is wired in the invite API route (Phase 0 stub).
    revalidatePath("/settings");
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold text-ink-strong">Settings</h1>

      <section className="mt-6">
        <h2 className="text-[13px] font-semibold text-ink-strong">Users</h2>
        <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
          <table className="w-full min-w-[420px] bg-cell text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Roles</th>
                <th className="px-4 py-2.5 font-medium">Since</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((p) => (
                <tr key={p.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5 text-[13.5px] text-ink-body">{p.full_name ?? p.id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">
                    {(rolesByUser.get(p.id) ?? ["—"]).join(", ")}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink-soft">
                    {new Date(p.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-ink-strong">Invitations</h2>
        <form action={invite} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Email
            <input name="email" type="email" className="mt-1 block w-72 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
          </label>
          <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Role
            <select name="role" className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]">
              <option value="staff">Staff</option>
              <option value="accountant">Accountant</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
            Invite
          </button>
        </form>
        <ul className="mt-3 space-y-1.5">
          {(invitations ?? []).map((i) => (
            <li key={i.id} className="text-[13px] text-ink-body">
              {i.email} — {i.role}
              <span className="ml-2 font-mono text-[11px] text-ink-soft">
                {i.accepted_at ? "accepted" : "pending"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-ink-strong">Website sync</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          {outbox === null ? "—" : ""}Pending outbox entries are pushed to Sanity by the sync
          endpoint; a cron drains missed entries every 10 minutes.
        </p>
      </section>
    </div>
  );
}
