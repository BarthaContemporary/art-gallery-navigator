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
import { Panel, Section } from "@/components/ui/section";
import { Disclosure } from "@/components/ui/collapse";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ChevronRightIcon } from "@/components/ui/icons";
import { sendEmail } from "@/lib/email";
import { PASSWORD_MIN } from "@/lib/auth-rules";
// London time: this page renders on the server, where the zone is UTC.
import { formatCount, formatDate, formatTime } from "@/lib/format";
import { ACTIVITY_ACTION_LABELS, ACTIVITY_ENTITY_LABELS, labelOf } from "@/lib/labels";
import { EmptyState } from "@/components/ui/empty-state";

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

/**
 * Remove every passkey a user has, in both apps: the studio's
 * (webauthn_credentials) and the capture app's (passkeys). A passkey keeps
 * signing in whoever enrolled it whatever the password is, so a reset that
 * left them would leave a door open (security review 2026-10, finding F20).
 */
async function removeAllPasskeys(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<{ count: number; error: string | null }> {
  const [studio, capture] = await Promise.all([
    admin.from("webauthn_credentials").delete({ count: "exact" }).eq("user_id", userId),
    admin.from("passkeys").delete({ count: "exact" }).eq("user_id", userId),
  ]);
  return {
    count: (studio.count ?? 0) + (capture.count ?? 0),
    error: studio.error?.message ?? capture.error?.message ?? null,
  };
}

type AdminPasskey = {
  app: "studio" | "capture";
  id: string;
  user_id: string;
  email: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};

type ActivityRow = {
  id: string | number;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  created_at: string;
};

/** Shown for an account the auth server holds without an email address. */
const NO_EMAIL = "(no email)";

const ROLE_LABELS: Record<string, string> = { admin: "Admin", staff: "Staff", accountant: "Accountant" };
const rolesText = (roles: string[]) =>
  roles.length ? roles.map((r) => ROLE_LABELS[r] ?? r).join(" and ") : "No role";

/** Activity entries logged under a work's id: the record itself and its financials. */
const WORK_ENTITIES = new Set(["pieces", "piece_financials"]);
/** The page an activity entry opens, by its table, for records found by id. */
const ENTITY_PAGES: Record<string, string> = {
  makers: "/makers",
  crm_contacts: "/crm/contacts",
  offers: "/offers",
};

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
    await flashNotice(`Created ${email} (${role}). Password: ${pw}`);
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
    // A reset is what follows a lost device or a suspected break-in, so the
    // user's passkeys go too; they add new ones after signing in again.
    const passkeys = await removeAllPasskeys(admin, userId);
    revalidatePath("/admin");
    await flashNotice(
      passkeys.error
        ? `Password for ${email} reset to: ${pw}. Their passkeys could not be removed (${passkeys.error}); remove them under "Passkeys on all accounts".`
        : passkeys.count
          ? `Password for ${email} reset to: ${pw}. ${passkeys.count} passkey${passkeys.count === 1 ? "" : "s"} removed.`
          : `Password for ${email} reset to: ${pw}`,
    );
    redirect("/admin");
  }

  // Remove one passkey from the list below (either app's).
  async function revokePasskey(formData: FormData) {
    "use server";
    await assertAdmin();
    const id = String(formData.get("id") ?? "");
    const app = String(formData.get("app") ?? "");
    const table = app === "studio" ? "webauthn_credentials" : app === "capture" ? "passkeys" : null;
    if (!id || !table) {
      await flashNotice("Unknown passkey");
      redirect("/admin");
    }
    const admin = createServiceClient();
    const { error, count } = await admin.from(table).delete({ count: "exact" }).eq("id", id);
    revalidatePath("/admin");
    await flashNotice(
      error ? `Could not remove the passkey: ${error.message}` : count ? "Passkey removed." : "That passkey was already gone.",
    );
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
          subject: "Set your password for the Joost van den Bergh studio",
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
  let users: { id: string; email: string | null; roles: string[]; created_at: string }[] = [];
  let outbox: number | null = 0;
  let activity: ActivityRow[] = [];
  let passkeys: AdminPasskey[] = [];
  // Stock numbers of the works named in the activity, to show and link them.
  let stockNumberOf = new Map<string, string>();
  if (isAdmin) {
    const supabase = await getSupabase();
    const admin = createServiceClient();
    const passkeyCols = "id, user_id, device_label, created_at, last_used_at";
    const [
      { data: usersList },
      { data: userRoles },
      { count: outboxCount },
      { data: act },
      { data: studioKeys },
      { data: captureKeys },
    ] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 200 }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("sync_outbox").select("id", { count: "exact", head: true }).is("processed_at", null),
      supabase
        .from("activity_log")
        .select("id, actor_id, entity_type, entity_id, action, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      // Both apps' passkeys, so none can sit on an account unseen.
      admin.from("webauthn_credentials").select(passkeyCols),
      admin.from("passkeys").select(passkeyCols),
    ]);
    const rolesByUser = new Map<string, string[]>();
    (userRoles ?? []).forEach((r) => {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    });
    users = (usersList?.users ?? [])
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        roles: rolesByUser.get(u.id) ?? [],
        created_at: u.created_at,
      }))
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    outbox = outboxCount ?? 0;
    activity = (act ?? []) as ActivityRow[];
    const emailOf = new Map(users.map((u) => [u.id, u.email ?? NO_EMAIL]));
    type Row = Omit<AdminPasskey, "app" | "email">;
    passkeys = [
      ...((studioKeys ?? []) as Row[]).map((k) => ({ ...k, app: "studio" as const })),
      ...((captureKeys ?? []) as Row[]).map((k) => ({ ...k, app: "capture" as const })),
    ]
      .map((k) => ({ ...k, email: emailOf.get(k.user_id) ?? NO_EMAIL }))
      .sort((a, b) => a.email.localeCompare(b.email) || a.created_at.localeCompare(b.created_at));

    // A work's changes (the record or its financials) are logged under the
    // work's id; its stock number names it and opens it.
    const workIds = [
      ...new Set(
        activity
          .filter((a) => a.entity_id && WORK_ENTITIES.has(a.entity_type))
          .map((a) => a.entity_id as string),
      ),
    ];
    if (workIds.length) {
      const { data: works } = await supabase.from("pieces").select("id, stock_number").in("id", workIds);
      stockNumberOf = new Map((works ?? []).map((w) => [w.id as string, w.stock_number as string]));
    }
  }

  const passkeysOf = new Map<string, number>();
  passkeys.forEach((k) => passkeysOf.set(k.user_id, (passkeysOf.get(k.user_id) ?? 0) + 1));
  const actorOf = new Map(users.map((u) => [u.id, u.email ?? NO_EMAIL]));

  /** Where an activity entry's record opens, when it still exists and has a page. */
  function activityHref(a: ActivityRow): string | null {
    if (a.action === "DELETE" || !a.entity_id) return null;
    if (WORK_ENTITIES.has(a.entity_type)) {
      const stock = stockNumberOf.get(a.entity_id);
      return stock ? `/inventory/${encodeURIComponent(stock)}` : null;
    }
    const base = ENTITY_PAGES[a.entity_type];
    return base ? `${base}/${a.entity_id}` : null;
  }

  // The activity by London day, newest first, under "Today", "Yesterday" or the date.
  const today = formatDate(new Date(), "short");
  const yesterday = formatDate(new Date(Date.now() - 86_400_000), "short");
  const activityDays: { day: string; rows: ActivityRow[] }[] = [];
  for (const a of activity) {
    const day = formatDate(a.created_at, "short");
    const last = activityDays[activityDays.length - 1];
    if (last?.day === day) last.rows.push(a);
    else activityDays.push({ day, rows: [a] });
  }
  const dayLabel = (day: string) => (day === today ? "Today" : day === yesterday ? "Yesterday" : day);

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
   *
   * Users and passkeys are lists, not tables, so every row's actions stay in
   * view on a phone instead of scrolling sideways out of it.
   */
  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader title="Admin" meta={`${user.email} · ${rolesText(roles)}`}>
        {isAdmin && notice ? (
          // The outcome of the last admin action, first on the page after its
          // redirect. It may hold a generated password, so it is set in
          // figures that read character by character.
          <Notice tone="info">
            <span className="tabular select-all break-words">{notice}</span>
          </Notice>
        ) : null}
      </PageHeader>

      {/* Your own account: open to everyone */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <Section title="Change your password" meta={`At least ${PASSWORD_MIN} characters. You stay signed in.`}>
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

        <PasskeyManager />
      </div>

      {!isAdmin ? null : (
        <div className="mt-8 space-y-8">
          <Section title="Tools">
            <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {tools.map((t) => (
                <li key={t.href} className="border-b border-rule">
                  <Link href={t.href} className="group flex h-full items-center justify-between gap-3 py-2.5">
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

          <Section title="Users" meta={`${formatCount(users.length)} ${users.length === 1 ? "account" : "accounts"}`}>
            <ul className="divide-y divide-rule border-b border-rule">
              {users.map((u) => {
                const email = u.email ?? NO_EMAIL;
                const keys = passkeysOf.get(u.id) ?? 0;
                const isMe = u.id === user.id;
                return (
                  // Phone: who on one row, the three actions under it. Wider:
                  // one row. Either way the reset form opens under the row.
                  <li
                    key={u.id}
                    className="grid grid-cols-[repeat(3,auto)_minmax(0,1fr)] items-center gap-x-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_minmax(4rem,auto)]"
                  >
                    <div className="col-span-full mb-1.5 min-w-0 sm:col-span-1 sm:mb-0">
                      <p className="truncate text-[13px] text-ink">
                        {email}
                        {isMe ? <span className="text-meta"> (you)</span> : null}
                      </p>
                      <p className="text-[12px] leading-[1.4] text-meta">
                        {rolesText(u.roles)}, since {formatDate(u.created_at, "short")}
                        {keys ? `, ${keys} ${keys === 1 ? "passkey" : "passkeys"}` : null}
                      </p>
                    </div>
                    {/* `contents`: the trigger takes its grid cell and the
                        form a full row of its own below. */}
                    <Disclosure summary="Reset password" className="contents" panelClassName="order-last col-span-full">
                      <form action={resetPassword} className="flex flex-wrap items-end gap-3 pb-1 pt-3">
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="email" value={email} />
                        <Field id={`admin-reset-${u.id}`} label="New password" optional className="w-full sm:w-60">
                          <input
                            id={`admin-reset-${u.id}`}
                            name="password"
                            minLength={PASSWORD_MIN}
                            placeholder="Blank to generate one"
                            aria-describedby={`admin-reset-hint-${u.id}`}
                            className="field"
                          />
                        </Field>
                        <Button type="submit" pendingLabel="Resetting…">
                          Set new password
                        </Button>
                        <p id={`admin-reset-hint-${u.id}`} className="w-full max-w-[65ch] text-[12px] leading-[1.4] text-meta">
                          At least {PASSWORD_MIN} characters, or leave it blank to generate one. The new password
                          is shown once, at the top of this page. A reset also removes all of{" "}
                          {isMe ? "your" : "this user’s"} passkeys, in the studio and the capture app.
                        </p>
                      </form>
                    </Disclosure>
                    {u.email ? (
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
                    ) : (
                      <span />
                    )}
                    {/* A row's destructive action: DeleteListButton draws its first
                        step quiet in danger and keeps its "Yes, delete" step. Not
                        offered on your own account, which cannot delete itself; its
                        column keeps its width so the other rows' actions line up. */}
                    <div className="sm:justify-self-end">
                      {isMe ? null : <DeleteListButton action={deleteUser} id={u.id} name={email} />}
                    </div>
                  </li>
                );
              })}
            </ul>

            <Panel title="Add a user" className="mt-5">
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
                  <input
                    id="admin-add-password"
                    name="password"
                    minLength={PASSWORD_MIN}
                    aria-describedby="admin-add-hint"
                    className="field"
                  />
                </Field>
                <Button type="submit" variant="primary" pendingLabel="Creating…">
                  Create user
                </Button>
              </form>
              <p id="admin-add-hint" className="mt-2 max-w-[65ch] text-[12px] leading-[1.4] text-meta">
                The account works straight away. Leave the password blank to generate one; it is shown once, at
                the top of this page. A password you choose needs at least {PASSWORD_MIN} characters.
              </p>
            </Panel>
          </Section>

          <Section
            title="Passkeys on all accounts"
            meta="Every passkey in the studio and the capture app. Delete any that nobody recognises."
          >
            {passkeys.length === 0 ? (
              <EmptyState compact>No passkeys yet. People add their own under Passkeys above.</EmptyState>
            ) : (
              <ul className="divide-y divide-rule border-b border-rule">
                {passkeys.map((k) => {
                  const appLabel = k.app === "studio" ? "Studio" : "Capture";
                  const device = k.device_label ?? "Passkey";
                  return (
                    <li key={`${k.app}:${k.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-ink">{device}</p>
                        <p className="truncate text-[12px] leading-[1.4] text-meta">
                          {k.email} · {appLabel}
                        </p>
                        <p className="tabular text-[12px] leading-[1.4] text-meta">
                          Added {formatDate(k.created_at, "short")},{" "}
                          {k.last_used_at ? `last used ${formatDate(k.last_used_at, "short")}` : "never used"}
                        </p>
                      </div>
                      <DeleteListButton
                        action={revokePasskey}
                        id={k.id}
                        name={`${device} passkey (${appLabel}) of ${k.email}`}
                        extra={{ app: k.app }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            title="Website sync"
            meta={
              (outbox ?? 0) === 0
                ? "Nothing waiting to go to the website."
                : `${formatCount(outbox ?? 0)} ${outbox === 1 ? "change" : "changes"} waiting to go to the website.`
            }
          >
            <p className="mb-3 max-w-[65ch] text-[13px] leading-[1.45] text-body">
              Web-visible works go to the website as they change, and anything missed follows within 10 minutes.
              A resync sends every web-visible work (with its images), every maker and every website list again,
              for example after the site moves to a new Sanity dataset. It is safe to repeat.
            </p>
            <form action={resyncWebsite}>
              <Button type="submit" pendingLabel="Resyncing…">
                Resync all web-visible works
              </Button>
            </form>
          </Section>

          <Section title="Recent activity" meta="The last 15 changes, newest first, in London time.">
            {activity.length === 0 ? (
              <EmptyState compact>No activity yet.</EmptyState>
            ) : (
              <div className="space-y-4">
                {activityDays.map(({ day, rows }) => (
                  <div key={day}>
                    <h3 className="mb-1 text-[12px] font-medium leading-[1.4] text-meta">{dayLabel(day)}</h3>
                    <ul>
                      {rows.map((a) => {
                        // In the change history's words ("Edited record 2026-0042"),
                        // not the raw SQL action and table name.
                        const stock =
                          a.entity_id && WORK_ENTITIES.has(a.entity_type) ? stockNumberOf.get(a.entity_id) : undefined;
                        const what =
                          `${labelOf(ACTIVITY_ACTION_LABELS, a.action)} ${labelOf(ACTIVITY_ENTITY_LABELS, a.entity_type).toLowerCase()}` +
                          (stock ? (a.entity_type === "piece_financials" ? ` of ${stock}` : ` ${stock}`) : "");
                        const href = activityHref(a);
                        const who = a.actor_id ? (actorOf.get(a.actor_id) ?? "A former user") : "The system";
                        return (
                          <li
                            key={a.id}
                            className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 py-1 text-[13px] sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
                          >
                            <time dateTime={a.created_at} className="tabular text-meta">
                              {formatTime(a.created_at)}
                            </time>
                            <span className="min-w-0 text-body">
                              {href ? (
                                <Link href={href} className="link-plain">
                                  {what}
                                </Link>
                              ) : (
                                what
                              )}
                            </span>
                            <span className="col-start-2 truncate text-[12px] leading-[1.6] text-meta sm:col-start-auto sm:text-right">
                              {who}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
