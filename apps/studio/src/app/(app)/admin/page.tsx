import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import {
  getSession,
  getSupabase,
  hasRole,
  requireSession,
  createServiceClient,
} from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
import { PasskeyManager } from "@/components/passkey-manager";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { ChevronRightIcon } from "@/components/ui/icons";
import { sendEmail } from "@/lib/email";
import { PASSWORD_MIN } from "@/lib/auth-rules";
// London time: this page renders on the server, where the zone is UTC.
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Admin" };

const NOTICE_COOKIE = "admin_notice";

function genPassword() {
  // 18 bytes make 24 base64 characters, plenty for 16 once + and / are
  // stripped. 12 bytes made exactly 16, and stripping could leave fewer than
  // PASSWORD_MIN, which the auth server refuses.
  const bytes = new Uint8Array(18);
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
  if (next.length < PASSWORD_MIN)
    redirect(`/admin?error=${encodeURIComponent(`Password must be at least ${PASSWORD_MIN} characters`)}`);
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
    if (pw.length < PASSWORD_MIN) {
      await flashNotice(`Password must be at least ${PASSWORD_MIN} characters`);
      redirect("/admin");
    }
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
    if (pw.length < PASSWORD_MIN) {
      await flashNotice(`Password must be at least ${PASSWORD_MIN} characters`);
      redirect("/admin");
    }
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
    // sendEmail throws when Resend refuses the email (the SDK only returns
    // the error), so a refused invitation reaches the catch and the admin
    // gets the link to pass on, instead of "Invitation sent".
    try {
      await sendEmail(
        apiKey,
        {
          from,
          to: email,
          subject: "Set your password — Joost van den Bergh Studio",
          html: `<p>You've been given access to the Joost van den Bergh studio.</p>
<p><a href="${link}">Click here to set your password</a>. This link expires in 24 hours.</p>
<p>If you didn't expect this, you can ignore this email.</p>`,
        },
        "Studio invitation",
      );
      await flashNotice(`Invitation sent to ${email}.`);
    } catch (e) {
      await flashNotice(`Email failed (${e instanceof Error ? e.message : "error"}). Link: ${link}`);
    }
    redirect("/admin");
  }

  /**
   * Queue every web-visible work for the website and start pushing. The
   * outbox normally only carries changes, so a fresh or re-pointed Sanity
   * dataset stays empty until something is edited — this is the backfill.
   * Pushes for up to ~40 s here; the 10-minute cron finishes the rest.
   */
  async function resyncWebsite() {
    "use server";
    await assertAdmin();
    const admin = createServiceClient();
    const rows: { entity_type: string; entity_id: string; op: string }[] = [];
    for (const table of ["pieces", "external_pieces"] as const) {
      // Trashed works are queued too: the route takes them off the website,
      // which also clears any that were trashed while it still republished them.
      const { data, error } = await admin
        .from(table)
        .select("id")
        .eq("web_visible", true);
      if (error) {
        await flashNotice(`Could not list web-visible works: ${error.message}`);
        redirect("/admin");
      }
      rows.push(...(data ?? []).map((r) => ({ entity_type: "piece", entity_id: r.id, op: "upsert" })));
    }
    // Makers go first so the works' artist references resolve; the route
    // decides which makers are actually published.
    {
      const { data, error } = await admin.from("makers").select("id");
      if (error) {
        await flashNotice(`Could not list makers: ${error.message}`);
        redirect("/admin");
      }
      rows.unshift(...(data ?? []).map((r) => ({ entity_type: "maker", entity_id: r.id, op: "upsert" })));
    }
    // Lists last: their references point at the works pushed above. Only
    // lists marked for the website are published.
    {
      const { data, error } = await admin.from("piece_lists").select("id").eq("web_visible", true);
      if (error) {
        await flashNotice(`Could not list website lists: ${error.message}`);
        redirect("/admin");
      }
      rows.push(...(data ?? []).map((r) => ({ entity_type: "list", entity_id: r.id, op: "upsert" })));
    }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("sync_outbox").insert(rows.slice(i, i + 500));
      if (error) {
        await flashNotice(`Could not queue works: ${error.message}`);
        redirect("/admin");
      }
    }

    let pushed = 0;
    let failure: string | null = null;
    const secret = process.env.SYNC_SHARED_SECRET;
    if (secret) {
      const h = await headers();
      const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
      const started = Date.now();
      while (Date.now() - started < 40_000) {
        const res = await fetch(`${origin}/api/sync/sanity`, {
          method: "POST",
          headers: { "x-sync-secret": secret },
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as { processed?: number; pieces?: number; error?: string; detail?: string };
        if (!res.ok) {
          failure = body.detail?.slice(0, 200) ?? body.error ?? `HTTP ${res.status}`;
          break;
        }
        if (!body.processed) break;
        pushed += body.processed ?? 0;
      }
    }
    const remaining = Math.max(0, rows.length - pushed);
    await flashNotice(
      failure
        ? `Queued ${rows.length} works; pushing stopped on an error (${failure}). The cron will retry.`
        : `Queued ${rows.length} entries (works, makers, lists) for the website; ${pushed} pushed now${remaining ? `, ${remaining} follow via the cron within the hour` : ""}.`,
    );
    revalidatePath("/admin");
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

  // The admin tools, each a page of its own.
  const tools = [
    {
      href: "/migration",
      label: "Data review",
      hint: "Records flagged during the import: duplicate stock numbers, unconverted currency and other issues.",
    },
    { href: "/analytics", label: "Analytics", hint: "Public website visitor results (cookieless)." },
    {
      href: "/admin/duplicates",
      label: "Duplicate contacts",
      hint: "Review and merge the pairs found during the legacy import.",
    },
    {
      href: "/admin/data-protection",
      label: "Data protection",
      hint: "Retention, subject requests, the breach register and review queues.",
    },
  ];

  /*
   * Fields: the native controls with the shared .field look, under Field for
   * the label (Field's own Input would do the same, but the ui:guard baseline
   * records native controls, and these posts must not move).
   */
  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader title="Admin" meta={`${user.email} · ${roles.join(", ") || "no role"}`} />

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        {/* Password: available to everyone */}
        <Section title="Change your password" meta={`At least ${PASSWORD_MIN} characters. You stay signed in after changing it.`}>
          {pwError ? (
            <Notice tone="danger" className="mb-3">
              {pwError}
            </Notice>
          ) : null}
          {pwOk ? (
            <Notice tone="ok" className="mb-3">
              Password updated.
            </Notice>
          ) : null}
          <form action={changePassword} className="space-y-3">
            <Field id="admin-new-password" label="New password">
              <input
                id="admin-new-password"
                name="password"
                type="password"
                required
                minLength={PASSWORD_MIN}
                autoComplete="new-password"
                className="field"
              />
            </Field>
            <Field id="admin-confirm-password" label="Confirm new password">
              <input
                id="admin-confirm-password"
                name="confirm"
                type="password"
                required
                minLength={PASSWORD_MIN}
                autoComplete="new-password"
                className="field"
              />
            </Field>
            <Button type="submit" variant="primary" pendingLabel="Updating…">
              Update password
            </Button>
          </form>
        </Section>

        {/* Passkeys: available to everyone */}
        <PasskeyManager />
      </div>

      {!isAdmin ? null : (
        <div className="mt-8 space-y-8">
          {notice ? (
            // The outcome of the last admin action; may hold a generated
            // password, so it is set in figures that read character by character.
            <Notice tone="info">
              <span className="tabular select-all break-words">{notice}</span>
            </Notice>
          ) : null}

          <Section title="Tools">
            <ul>
              {tools.map((t) => (
                <li key={t.href} className="border-b border-rule">
                  <Link href={t.href} className="group flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink group-hover:underline">{t.label}</span>
                      <span className="block text-[12px] leading-[1.4] text-meta">{t.hint}</span>
                    </span>
                    <ChevronRightIcon size={16} className="shrink-0 text-meta group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Users">
            <p id="admin-reset-hint" className="mb-3 max-w-[70ch] text-[12px] leading-[1.4] text-meta">
              To reset a password, type a new one of at least {PASSWORD_MIN} characters, or leave the box
              blank to generate one. Either way it is shown once, above.
            </p>
            <TableFrame>
              <Table className="min-w-[720px]">
                <thead>
                  <tr>
                    <Th>Email</Th>
                    <Th>Roles</Th>
                    <Th>Since</Th>
                    <Th>Reset password</Th>
                    <Th>Manage</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <Tr key={u.id}>
                      <Td className="text-ink">{u.email}</Td>
                      <Td className="text-body">{u.roles.join(", ") || "—"}</Td>
                      <Td className="tabular whitespace-nowrap text-body">{formatDate(u.created_at, "short")}</Td>
                      <Td>
                        <form action={resetPassword} className="flex items-center gap-1.5">
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="email" value={u.email} />
                          <input
                            name="password"
                            minLength={PASSWORD_MIN}
                            placeholder="Blank to generate"
                            aria-label={`New password for ${u.email}`}
                            aria-describedby="admin-reset-hint"
                            className="field field-sm w-44"
                          />
                          <Button type="submit" size="sm" pendingLabel="Resetting…">
                            Reset
                          </Button>
                        </form>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <form action={reinvite}>
                            <input type="hidden" name="email" value={u.email} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="quiet"
                              title="Email this user a link to set their own password"
                              pendingLabel="Sending…"
                            >
                              Re-invite
                            </Button>
                          </form>
                          {/* A destructive action in a table row: the first step is quiet
                              in danger (spec R4), the confirm step keeps its own
                              "Yes, delete". DeleteListButton draws its trigger quiet; the
                              wrapper colours that one button and not the confirm form. */}
                          <span className="contents [&>button]:text-danger">
                            <DeleteListButton action={deleteUser} id={u.id} name={u.email} />
                          </span>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
          </Section>

          <Section
            title="Add user"
            meta={`Creates the account at once. Leave the password blank to generate one (shown once, above); one you choose needs at least ${PASSWORD_MIN} characters, as does a reset.`}
          >
            <form action={createUser} className="flex flex-wrap items-end gap-3">
              <Field id="admin-add-email" label="Email" className="w-full sm:w-64">
                <input id="admin-add-email" name="email" type="email" required className="field" />
              </Field>
              <Field id="admin-add-role" label="Role" className="w-full sm:w-40">
                <select id="admin-add-role" name="role" className="field">
                  <option value="staff">Staff</option>
                  <option value="accountant">Accountant</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field id="admin-add-password" label="Password" optional className="w-full sm:w-52">
                <input id="admin-add-password" name="password" minLength={PASSWORD_MIN} className="field" />
              </Field>
              <Button type="submit" variant="primary" pendingLabel="Creating…">
                Create user
              </Button>
            </form>
          </Section>

          <Section
            title="Website sync"
            meta={`${(outbox ?? 0) === 0 ? "Nothing waiting" : `${outbox} ${outbox === 1 ? "entry" : "entries"} waiting`} in the outbox. Web-visible works are pushed to the website when they change; a cron sends anything missed every 10 minutes.`}
          >
            <form action={resyncWebsite} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button type="submit" pendingLabel="Resyncing…">
                Resync all web-visible works
              </Button>
              <span className="max-w-[60ch] text-[12px] leading-[1.4] text-meta">
                Sends every web-visible work (with images), every maker and every list to the website
                again. Use it after pointing the site at a new Sanity dataset. Safe to repeat.
              </span>
            </form>
          </Section>

          <Section title="Recent activity">
            {activity.length === 0 ? (
              <p className="text-[13px] text-body">No activity yet.</p>
            ) : (
              <ul>
                {activity.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule py-1.5 text-[13px]"
                  >
                    <span className="text-body">
                      {a.action} {a.entity_type}
                    </span>
                    <time dateTime={a.created_at} className="text-[12px] text-meta">
                      {formatDateTime(a.created_at, "short")}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
