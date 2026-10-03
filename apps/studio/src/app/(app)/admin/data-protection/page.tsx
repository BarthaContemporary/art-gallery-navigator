import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";

export const metadata = { title: "Data protection" };

async function assertAdmin() {
  const s = await getSession();
  if (!s || !hasRole(s.roles, "admin")) throw new Error("Forbidden");
  return s;
}

const field = "rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body";
const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const btn = "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong";
const primary = "rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg";

const KIND_LABEL: Record<string, string> = {
  access: "Access", erasure: "Erasure", rectification: "Rectification", restriction: "Restriction",
  objection: "Objection", portability: "Portability", withdraw_consent: "Withdraw consent", other: "Other",
};

/**
 * Admin → Data protection: the accountability page. Retention periods and
 * their enforcement, the registers the ICO expects (requests, breaches), and
 * the review queues that need a human decision.
 */
export default async function DataProtectionPage({
  searchParams,
}: {
  searchParams: Promise<{ ran?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) redirect("/");
  const svc = createServiceClient();

  const [{ data: policies }, { data: requests }, { data: breaches }, { data: review }, { data: kycReview }, { data: weakBasis }] =
    await Promise.all([
      svc.from("retention_policies").select("*").order("mode").order("label"),
      svc.from("dp_requests").select("*").order("completed_at", { nullsFirst: true }).order("due_at").limit(100),
      svc.from("dp_breach_log").select("*").order("discovered_at", { ascending: false }).limit(50),
      svc.from("vw_contacts_for_review").select("*").order("updated_at").limit(100),
      svc
        .from("kyc_profiles")
        .select("id, contact_id, status, verified_at, expires_at, contact:crm_contacts(first_name, last_name)")
        .lt("verified_at", new Date(Date.now() - 1825 * 86_400_000).toISOString())
        .limit(50),
      // Marketing to someone whose only consent record is the bulk import note
      // and who has never bought from the gallery: neither consent nor the
      // PECR soft opt-in is evidenced. These need a re-permission email or a
      // documented basis before the next campaign.
      svc.rpc("contacts_with_weak_marketing_basis"),
    ]);

  async function updatePolicy(formData: FormData) {
    "use server";
    await assertAdmin();
    const key = String(formData.get("key") ?? "");
    const days = Math.max(1, Math.min(7300, Number(formData.get("days") ?? 0) || 0));
    await createServiceClient().from("retention_policies").update({ days, updated_at: new Date().toISOString() }).eq("key", key);
    revalidatePath("/admin/data-protection");
  }

  async function runRetention() {
    "use server";
    await assertAdmin();
    const { data, error } = await createServiceClient().rpc("apply_retention");
    if (error) redirect(`/admin/data-protection?error=${encodeURIComponent(error.message)}`);
    redirect(`/admin/data-protection?ran=${encodeURIComponent(JSON.stringify(data))}`);
  }

  /**
   * The gallery attests that every contact imported from the previous system
   * had given full marketing consent there. Records that attestation — with
   * the attesting user and date — as the consent evidence on each imported
   * contact that has none, so the basis is documented rather than implied.
   */
  async function attestLegacyConsent() {
    "use server";
    const s = await assertAdmin();
    const svc2 = createServiceClient();
    const { data: rows } = await svc2
      .from("crm_contacts")
      .select("id, consent_date, consent_source")
      .eq("marketing_consent", true)
      .is("erased_at", null)
      .is("consent_evidence", null);
    const targets = ((rows ?? []) as { id: string; consent_date: string | null; consent_source: string | null }[]).filter(
      (r) => !r.consent_source || /^pre-existing/i.test(r.consent_source) || /import/i.test(r.consent_source),
    );
    const attestedAt = new Date().toISOString();
    for (const r of targets) {
      const at = r.consent_date ?? "2026-07-01T00:00:00.000Z";
      await svc2
        .from("crm_contacts")
        .update({
          consent_source: "Consent given in the previous system (FileMaker) and carried over at import, July 2026; confirmed by the gallery",
          consent_date: at,
          consent_evidence: {
            marketing: {
              version: "legacy-import",
              form: "previous_system",
              text: "Full marketing consent recorded in the previous gallery system before import",
              at,
              attested_by: s.user.email ?? s.user.id,
              attested_at: attestedAt,
              note: "The gallery confirms that every contact imported from the previous system had given full marketing consent there.",
            },
          },
        })
        .eq("id", r.id);
    }
    redirect(`/admin/data-protection?ran=${encodeURIComponent(`Legacy consent recorded on ${targets.length} contacts`)}`);
  }

  async function addRequest(formData: FormData) {
    "use server";
    const s = await assertAdmin();
    const received = String(formData.get("received_at") ?? "") || new Date().toISOString().slice(0, 10);
    const due = new Date(received);
    due.setMonth(due.getMonth() + 1);
    await createServiceClient().from("dp_requests").insert({
      subject_name: String(formData.get("subject_name") ?? "").trim() || null,
      kind: String(formData.get("kind") ?? "other"),
      channel: String(formData.get("channel") ?? "").trim() || null,
      received_at: received,
      due_at: due.toISOString().slice(0, 10),
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: s.user.id,
    });
    revalidatePath("/admin/data-protection");
  }

  async function completeRequest(formData: FormData) {
    "use server";
    await assertAdmin();
    await createServiceClient()
      .from("dp_requests")
      .update({ completed_at: new Date().toISOString(), outcome: String(formData.get("outcome") ?? "").trim() || "Completed" })
      .eq("id", String(formData.get("id") ?? ""));
    revalidatePath("/admin/data-protection");
  }

  async function addBreach(formData: FormData) {
    "use server";
    const s = await assertAdmin();
    await createServiceClient().from("dp_breach_log").insert({
      occurred_at: String(formData.get("occurred_at") ?? "") || null,
      description: String(formData.get("description") ?? "").trim(),
      data_affected: String(formData.get("data_affected") ?? "").trim() || null,
      people_affected: Number(formData.get("people_affected") ?? 0) || null,
      likely_risk: String(formData.get("likely_risk") ?? "") || null,
      reported_to_ico: formData.get("reported_to_ico") === "on",
      reported_at: formData.get("reported_to_ico") === "on" ? new Date().toISOString() : null,
      subjects_notified: formData.get("subjects_notified") === "on",
      actions_taken: String(formData.get("actions_taken") ?? "").trim() || null,
      created_by: s.user.id,
    });
    revalidatePath("/admin/data-protection");
  }

  const today = new Date().toISOString().slice(0, 10);
  const openRequests = ((requests ?? []) as Record<string, unknown>[]).filter((r) => !r.completed_at);
  const closedRequests = ((requests ?? []) as Record<string, unknown>[]).filter((r) => r.completed_at);
  const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("en-GB") : "—");

  return (
    <div className="max-w-[1000px]">
      <Link href="/admin" className="text-[12.5px] text-ink-soft">
        ← Admin
      </Link>
      <h1 className="mt-2 text-[22px] font-semibold text-ink-strong">Data protection</h1>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        Retention, the request and breach registers, and what needs a decision. The procedures are in{" "}
        <code>docs/compliance</code> in the repository.
      </p>
      {sp.error ? <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{sp.error}</p> : null}
      {sp.ran ? (
        <p className="mt-3 rounded-lg border border-line bg-band px-3 py-2 font-mono text-[11.5px] text-ink-body">
          Retention run: {sp.ran}
        </p>
      ) : null}

      {/* ---- retention ---- */}
      <section className="mt-6 rounded-[11px] border border-line bg-cell p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink-strong">Retention schedule</h2>
          <form action={runRetention}>
            <button type="submit" className={btn}>Run retention now</button>
          </form>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">
          Runs every night. “Purge” classes are deleted after the period; “review” classes are listed below for a person to decide. The Privacy Notice quotes these periods — change both together.
        </p>
        <table className="mt-3 w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="py-2 pr-3 font-medium">Data</th>
              <th className="py-2 pr-3 font-medium">Keep for</th>
              <th className="py-2 pr-3 font-medium">Then</th>
              <th className="py-2 font-medium">Basis</th>
            </tr>
          </thead>
          <tbody>
            {((policies ?? []) as { key: string; label: string; days: number; mode: string; basis: string | null }[]).map((p) => (
              <tr key={p.key} className="border-b border-line-soft last:border-0 align-top">
                <td className="py-2 pr-3 text-ink-body">{p.label}</td>
                <td className="py-2 pr-3">
                  <form action={updatePolicy} className="flex items-center gap-1.5">
                    <input type="hidden" name="key" value={p.key} />
                    <input name="days" type="number" min={1} max={7300} defaultValue={p.days} className={`${field} w-20`} />
                    <span className="text-ink-soft">days</span>
                    <button type="submit" className="text-[11.5px] text-ink-soft underline hover:text-ink-strong">save</button>
                  </form>
                </td>
                <td className="py-2 pr-3 text-ink-muted">{p.mode === "purge" ? "deleted" : "reviewed"}</td>
                <td className="py-2 text-ink-muted">{p.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---- review queues ---- */}
      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-[11px] border border-line bg-cell p-4">
          <h2 className="text-[13px] font-semibold text-ink-strong">Contacts to review ({(review ?? []).length})</h2>
          <p className="mt-1 text-[12px] text-ink-soft">No consent, no legal hold, nothing attached, untouched for the period above. Erase from the contact page or keep by adding a note.</p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-[12.5px]">
            {((review ?? []) as { id: string; first_name: string | null; last_name: string | null; updated_at: string }[]).map((c) => (
              <li key={c.id}>
                <Link href={`/crm/contacts/${c.id}`} className="text-ink-body hover:text-oranje">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"}
                </Link>
                <span className="text-ink-faint"> · {fmtDate(c.updated_at)}</span>
              </li>
            ))}
            {(review ?? []).length === 0 ? <li className="text-ink-soft">Nothing due.</li> : null}
          </ul>
        </div>
        <div className="rounded-[11px] border border-line bg-cell p-4">
          <h2 className="text-[13px] font-semibold text-ink-strong">AML records past five years ({(kycReview ?? []).length})</h2>
          <p className="mt-1 text-[12px] text-ink-soft">Verified more than five years ago. Keep only while the relationship continues; otherwise delete the documents and checks.</p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-[12.5px]">
            {((kycReview ?? []) as { id: string; contact_id: string; verified_at: string | null; contact: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null }[]).map((k) => {
              const c = Array.isArray(k.contact) ? k.contact[0] : k.contact;
              return (
                <li key={k.id}>
                  <Link href={`/crm/contacts/${k.contact_id}`} className="text-ink-body hover:text-oranje">
                    {[c?.first_name, c?.last_name].filter(Boolean).join(" ") || "Contact"}
                  </Link>
                  <span className="text-ink-faint"> · verified {fmtDate(k.verified_at)}</span>
                </li>
              );
            })}
            {(kycReview ?? []).length === 0 ? <li className="text-ink-soft">Nothing due.</li> : null}
          </ul>
        </div>
        <div className="rounded-[11px] border border-line bg-cell p-4">
          <h2 className="text-[13px] font-semibold text-ink-strong">Marketing without evidenced basis ({(weakBasis ?? []).length})</h2>
          <p className="mt-1 text-[12px] text-ink-soft">
            Emailable contacts whose only consent record is the import note and who have never bought from the gallery. Send a re-permission email, or untick marketing consent.
          </p>
          {(weakBasis ?? []).length > 0 ? (
            <form action={attestLegacyConsent} className="mt-2">
              <button type="submit" className={btn} title="Records, under your login and today's date, that these contacts consented in the previous system">
                Record: all imported contacts consented in the previous system
              </button>
            </form>
          ) : null}
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-[12.5px]">
            {((weakBasis ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map((c) => (
              <li key={c.id}>
                <Link href={`/crm/contacts/${c.id}`} className="text-ink-body hover:text-oranje">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed"}
                </Link>
              </li>
            ))}
            {(weakBasis ?? []).length === 0 ? <li className="text-ink-soft">None.</li> : null}
          </ul>
        </div>
      </section>

      {/* ---- requests ---- */}
      <section className="mt-6 rounded-[11px] border border-line bg-cell p-4">
        <h2 className="text-[13px] font-semibold text-ink-strong">Data-subject requests</h2>
        <p className="mt-1 text-[12px] text-ink-soft">One month to respond from the day received (extendable by two months for complex requests — note it here). Requests tied to a contact are logged from the contact page.</p>
        <form action={addRequest} className="mt-3 flex flex-wrap items-end gap-2">
          <label className={label}>Name<input name="subject_name" className={`${field} mt-1 block w-44`} /></label>
          <label className={label}>Request
            <select name="kind" className={`${field} mt-1 block`}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={label}>Received<input type="date" name="received_at" defaultValue={today} className={`${field} mt-1 block`} /></label>
          <label className={label}>Channel<input name="channel" className={`${field} mt-1 block w-36`} /></label>
          <label className={label}>Notes<input name="notes" className={`${field} mt-1 block w-56`} /></label>
          <button type="submit" className={primary}>Log</button>
        </form>
        <table className="mt-3 w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="py-2 pr-3 font-medium">Who</th><th className="py-2 pr-3 font-medium">Request</th><th className="py-2 pr-3 font-medium">Received</th><th className="py-2 pr-3 font-medium">Due</th><th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {[...openRequests, ...closedRequests].map((r) => {
              const overdue = !r.completed_at && String(r.due_at) < today;
              return (
                <tr key={String(r.id)} className="border-b border-line-soft last:border-0 align-top">
                  <td className="py-2 pr-3 text-ink-body">
                    {r.contact_id ? <Link href={`/crm/contacts/${r.contact_id}`} className="hover:text-oranje">{String(r.subject_name ?? "Contact")}</Link> : String(r.subject_name ?? "—")}
                    {r.notes ? <span className="block text-[11.5px] text-ink-soft">{String(r.notes)}</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{KIND_LABEL[String(r.kind)] ?? String(r.kind)}{r.channel ? ` · ${r.channel}` : ""}</td>
                  <td className="py-2 pr-3 text-ink-muted">{fmtDate(r.received_at)}</td>
                  <td className={`py-2 pr-3 ${overdue ? "font-semibold text-danger" : "text-ink-muted"}`}>{fmtDate(r.due_at)}{overdue ? " · overdue" : ""}</td>
                  <td className="py-2">
                    {r.completed_at ? (
                      <span className="text-ink-soft">Done {fmtDate(r.completed_at)}{r.outcome ? ` · ${r.outcome}` : ""}</span>
                    ) : (
                      <form action={completeRequest} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={String(r.id)} />
                        <input name="outcome" placeholder="Outcome" className={`${field} w-36`} />
                        <button type="submit" className="text-[11.5px] text-ink-soft underline hover:text-ink-strong">complete</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {(requests ?? []).length === 0 ? <tr><td colSpan={5} className="py-3 text-ink-soft">No requests logged.</td></tr> : null}
          </tbody>
        </table>
      </section>

      {/* ---- breaches ---- */}
      <section className="mt-6 rounded-[11px] border border-line bg-cell p-4">
        <h2 className="text-[13px] font-semibold text-ink-strong">Breach register</h2>
        <p className="mt-1 text-[12px] text-ink-soft">
          Record every personal-data breach, reportable or not (Art. 33(5)). A breach likely to risk people’s rights must be reported to the ICO within 72 hours of discovery; if the risk is high, tell the people affected as well.
        </p>
        <form action={addBreach} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className={label}>Occurred<input type="datetime-local" name="occurred_at" className={`${field} mt-1 block w-full`} /></label>
          <label className={label}>People affected<input type="number" name="people_affected" min={0} className={`${field} mt-1 block w-full`} /></label>
          <label className={label}>Likely risk
            <select name="likely_risk" className={`${field} mt-1 block w-full`}>
              <option value="unlikely">Unlikely</option><option value="possible">Possible</option><option value="likely">Likely — report to ICO</option><option value="high">High — report and notify people</option>
            </select>
          </label>
          <label className={`${label} md:col-span-3`}>What happened<textarea name="description" required rows={2} className={`${field} mt-1 block w-full`} /></label>
          <label className={`${label} md:col-span-2`}>Data involved<input name="data_affected" className={`${field} mt-1 block w-full`} /></label>
          <label className={`${label} md:col-span-3`}>Actions taken<textarea name="actions_taken" rows={2} className={`${field} mt-1 block w-full`} /></label>
          <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-ink-body md:col-span-3">
            <label className="flex items-center gap-1.5"><input type="checkbox" name="reported_to_ico" /> Reported to the ICO</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="subjects_notified" /> People affected notified</label>
            <button type="submit" className={`${primary} ml-auto`}>Record breach</button>
          </div>
        </form>
        <ul className="mt-3 space-y-2 text-[12.5px]">
          {((breaches ?? []) as Record<string, unknown>[]).map((b) => (
            <li key={String(b.id)} className="rounded-lg border border-line-soft px-3 py-2">
              <p className="text-ink-body"><span className="text-ink-faint">{fmtDate(b.discovered_at)} · </span>{String(b.description)}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-soft">
                {b.data_affected ? `${b.data_affected} · ` : ""}{b.people_affected ? `${b.people_affected} people · ` : ""}risk {String(b.likely_risk ?? "—")} · {b.reported_to_ico ? `reported to ICO ${fmtDate(b.reported_at)}` : "not reported"} · {b.subjects_notified ? "people notified" : "people not notified"}
                {b.actions_taken ? ` · ${b.actions_taken}` : ""}
              </p>
            </li>
          ))}
          {(breaches ?? []).length === 0 ? <li className="text-ink-soft">No breaches recorded.</li> : null}
        </ul>
      </section>
    </div>
  );
}
