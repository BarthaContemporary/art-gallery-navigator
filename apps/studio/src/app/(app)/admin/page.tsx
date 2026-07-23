import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { Resend } from "resend";
import {
  getSession,
  getSupabase,
  hasRole,
  requireSession,
  createServiceClient,
} from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";

export const metadata = { title: "Admin" };

const NOTICE_COOKIE = "admin_notice";

function genPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64").replace(/[+/=]/g, "").slice(0, 16);
}

/** Re-check admin inside every privileged Server Action — the page-level
 *  guard does NOT protect the actions (they are independently callable POSTs). */
async function assertAdmin() {
  const s = await getSession();
  if (!s || !hasRole(s.roles, "admin")) throw new Error("Forbidden");
}

/** Flash a (possibly sensitive) notice via a short-lived httpOnly cookie so
 *  generated passwords never land in the URL / browser history / access logs. */
async function flashNotice(message: string) {
  const c = await cookies();
  c.set(NOTICE_COOKIE, message, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/admin",
    maxAge: 30,
  });
}

// Everyone can change their own password.
async function changePassword(formData: FormData) {
  "use server";
  await requireSession();
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 10) redirect("/admin?error=Password+must+be+at+least+10+characters");
  if (next !== confirm) redirect("/admin?error=Passwords+do+not+match");
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  redirect("/admin?ok=1");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { user, roles } = await requireSession();
  const isAdmin = hasRole(roles, "admin");
  const { error: pwError, ok: pwOk } = await searchParams;
  const notice = (await cookies()).get(NOTICE_COOKIE)?.value ?? null;

  async function createUser(formData: FormData) {
    "use server";
    await assertAdmin();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "staff");
    if (!["staff", "accountant", "admin"].includes(role)) {
      await flashNotice("Invalid role");
      redirect("/admin");
    }
    if (!email) {
      await flashNotice("Email required");
      redirect("/admin");
    }
    const pw = String(formData.get("password") ?? "").trim() || genPassword();
    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
    });
    if (error || !data.user) {
      await flashNotice(error?.message ?? "Create failed");
      redirect("/admin");
    }
    await admin.from("user_roles").upsert(
      { user_id: data.user!.id, role },
      { onConflict: "user_id,role" },
    );
    revalidatePath("/admin");
    await flashNotice(`Created ${email} (${role}) — password: ${pw}`);
    redirect("/admin");
  }

  async function resetPassword(formData: FormData) {
    "use server";
    await assertAdmin();
    const userId = String(formData.get("user_id") ?? "");
    const email = String(formData.get("email") ?? "");
    const pw = String(formData.get("password") ?? "").trim() || genPassword();
    const admin = createServiceClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: pw });
    if (error) {
      await flashNotice(error.message);
      redirect("/admin");
    }
    await flashNotice(`Password for ${email} reset to: ${pw}`);
    redirect("/admin");
  }

  // Re-invite: email the user a link to set their own password.
  async function reinvite(formData: FormData) {
    "use server";
    await assertAdmin();
    const email = String(formData.get("email") ?? "").trim();
    if (!email) {
      await flashNotice("Email required");
      redirect("/admin");
    }
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const redirectTo = `${proto}://${host}/set-password`;

    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    const link = data?.properties?.action_link;
    if (error || !link) {
      await flashNotice(`Could not create invite link: ${error?.message ?? "unknown error"}`);
      redirect("/admin");
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Joost van den Bergh <noreply@web.joostvandenbergh.com>";
    if (!apiKey) {
      await flashNotice(`Email not configured. Send this link to ${email}: ${link}`);
      redirect("/admin");
    }
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to: email,
        subject: "Set your password — Joost van den Bergh Studio",
        html: `<p>You've been given access to the Joost van den Bergh studio.</p>
<p><a href="${link}">Click here to set your password</a>. This link expires in 24 hours.</p>
<p>If you didn't expect this, you can ignore this email.</p>`,
      });
      await flashNotice(`Invitation sent to ${email}.`);
    } catch (e) {
      await flashNotice(`Email failed (${e instanceof Error ? e.message : "error"}). Link: ${link}`);
    }
    redirect("/admin");
  }

  async function deleteUser(formData: FormData) {
    "use server";
    await assertAdmin();
    const me = await getSession();
    const userId = String(formData.get("id") ?? "");
    if (!userId) redirect("/admin");
    if (me?.user.id === userId) {
      await flashNotice("You can't delete your own account.");
      redirect("/admin");
    }
    const admin = createServiceClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      await flashNotice(error.message);
      redirect("/admin");
    }
    await admin.from("user_roles").delete().eq("user_id", userId);
    revalidatePath("/admin");
    await flashNotice("User deleted.");
    redirect("/admin");
  }

  // Admin-only data used by the sections further down.
  let users: { id: string; email: string; roles: string[]; created_at: string }[] = [];
  let outbox: number | null = 0;
  let activity: { id: string | number; entity_type: string; action: string; created_at: string }[] = [];
  if (isAdmin) {
    const supabase = await getSupabase();
    const admin = createServiceClient();
    const [{ data: usersList }, { data: userRoles }, { count: outboxCount }, { data: act }] =
      await Promise.all([
        admin.auth.admin.listUsers({ perPage: 200 }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("sync_outbox").select("id", { count: "exact", head: true }).is("processed_at", null),
        supabase
          .from("activity_log")
          .select("id, entity_type, action, created_at")
          .order("created_at", { ascending: false })
          .limit(15),
      ]);
    const rolesByUser = new Map<string, string[]>();
    (userRoles ?? []).forEach((r) => {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    });
    users = (usersList?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "—",
      roles: rolesByUser.get(u.id) ?? [],
      created_at: u.created_at,
    }));
    outbox = outboxCount ?? 0;
    activity = (act ?? []) as typeof activity;
  }

  return (
    <div className="max-w-[900px]">
      <h1 className="text-[22px] font-semibold text-ink-strong">Admin</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        {user.email} · {roles.join(", ") || "no role"}
      </p>

      {/* Password — available to everyone */}
      <form action={changePassword} className="mt-6 max-w-md rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">Change your password</h2>
        {pwError ? (
          <p className="mt-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            {pwError}
          </p>
        ) : null}
        {pwOk ? (
          <p className="mt-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            Password updated.
          </p>
        ) : null}
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          New password
          <input name="password" type="password" required minLength={10} autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px]" />
        </label>
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Confirm new password
          <input name="confirm" type="password" required minLength={10} autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px]" />
        </label>
        <button type="submit" className="mt-5 rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-fg">
          Update password
        </button>
        <p className="mt-3 text-[12px] text-ink-soft">Minimum 10 characters. You stay signed in after changing it.</p>
      </form>

      {!isAdmin ? null : (
        <>
          {notice ? (
            <p className="mt-8 rounded-lg border border-line bg-band px-3 py-2 font-mono text-[12.5px] text-ink-body">
              {notice}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-2 text-[12.5px]">
            <a href="/migration" className="text-ink-mid hover:text-oranje">
              Data review — flagged import records (duplicates, unconverted currency…) →
            </a>
            <a href="/analytics" className="text-ink-mid hover:text-oranje">
              Analytics — public website visitor results (cookieless) →
            </a>
            <a href="/admin/duplicates" className="text-ink-mid hover:text-oranje">
              Duplicate contacts — review &amp; merge pairs found during the legacy import →
            </a>
          </div>

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
                    <th className="px-4 py-2.5 font-medium">Manage</th>
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
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <form action={reinvite}>
                            <input type="hidden" name="email" value={u.email} />
                            <button
                              type="submit"
                              className="text-[12px] font-medium text-primary"
                              title="Email this user a link to set their own password"
                            >
                              Re-invite
                            </button>
                          </form>
                          <DeleteListButton action={deleteUser} id={u.id} name={u.email} />
                        </div>
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

          <section className="mt-8">
            <h2 className="text-[13px] font-semibold text-ink-strong">Recent activity</h2>
            <ul className="mt-3 space-y-2">
              {activity.map((a) => (
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
              {activity.length === 0 ? (
                <li className="text-[13px] text-ink-muted">No activity yet.</li>
              ) : null}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
