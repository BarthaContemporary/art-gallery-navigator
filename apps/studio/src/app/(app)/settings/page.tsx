import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, getSupabase, hasRole, createServiceClient } from "@/lib/supabase";

export const metadata = { title: "Settings" };

function genPassword() {
  // 16 URL-safe chars
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64").replace(/[+/=]/g, "").slice(0, 16);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) redirect("/");
  const { notice } = await searchParams;

  const supabase = await getSupabase();
  const admin = createServiceClient();

  const [{ data: usersList }, { data: roles }, { data: outbox }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("sync_outbox").select("id", { count: "exact", head: true }).is("processed_at", null),
  ]);

  const rolesByUser = new Map<string, string[]>();
  (roles ?? []).forEach((r) => {
    rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
  });
  const users = (usersList?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "—",
    roles: rolesByUser.get(u.id) ?? [],
    created_at: u.created_at,
  }));

  async function createUser(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "staff");
    if (!email) redirect("/settings?notice=Email+required");
    const pw = String(formData.get("password") ?? "").trim() || genPassword();
    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
    });
    if (error || !data.user) redirect(`/settings?notice=${encodeURIComponent(error?.message ?? "Create failed")}`);
    await admin.from("user_roles").upsert(
      { user_id: data.user.id, role },
      { onConflict: "user_id,role" },
    );
    revalidatePath("/settings");
    redirect(`/settings?notice=${encodeURIComponent(`Created ${email} (${role}) — password: ${pw}`)}`);
  }

  async function resetPassword(formData: FormData) {
    "use server";
    const userId = String(formData.get("user_id") ?? "");
    const email = String(formData.get("email") ?? "");
    const pw = String(formData.get("password") ?? "").trim() || genPassword();
    const admin = createServiceClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: pw });
    if (error) redirect(`/settings?notice=${encodeURIComponent(error.message)}`);
    redirect(`/settings?notice=${encodeURIComponent(`Password for ${email} reset to: ${pw}`)}`);
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold text-ink-strong">Settings</h1>

      {notice ? (
        <p className="mt-4 rounded-lg border border-line bg-band px-3 py-2 font-mono text-[12.5px] text-ink-body">
          {notice}
        </p>
      ) : null}

      <section className="mt-6">
        <h2 className="text-[13px] font-semibold text-ink-strong">Users</h2>
        <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
          <table className="w-full min-w-[560px] bg-cell text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Roles</th>
                <th className="px-4 py-2.5 font-medium">Since</th>
                <th className="px-4 py-2.5 font-medium">Reset password</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5 text-[13.5px] text-ink-body">{u.email}</td>
                  <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">{u.roles.join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink-soft">
                    {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-2">
                    <form action={resetPassword} className="flex items-center gap-1.5">
                      <input type="hidden" name="user_id" value={u.id} />
                      <input type="hidden" name="email" value={u.email} />
                      <input
                        name="password"
                        placeholder="new (blank = generate)"
                        className="w-40 rounded-md border border-line-control bg-control px-2 py-1 text-[12px]"
                      />
                      <button type="submit" className="rounded-md border border-line-control bg-control px-2 py-1 text-[11px] font-medium text-ink-mid">
                        Reset
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-ink-strong">Add user</h2>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          Creates the account immediately. Leave the password blank to auto-generate one (shown once above).
        </p>
        <form action={createUser} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Email
            <input name="email" type="email" required className="mt-1 block w-64 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
          </label>
          <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Role
            <select name="role" className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]">
              <option value="staff">Staff</option>
              <option value="accountant">Accountant</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Password (optional)
            <input name="password" className="mt-1 block w-48 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
          </label>
          <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
            Create user
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-ink-strong">Website sync</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          {(outbox ?? 0) === 0 ? "No pending" : `${outbox} pending`} outbox entries. Web-visible pieces are pushed to
          Sanity on change; a cron drains any misses every 10 minutes.
        </p>
      </section>
    </div>
  );
}
