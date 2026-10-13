import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { FlashNotice, Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Data protection" };

async function assertAdmin() {
  const s = await getSession();
  if (!s || !hasRole(s.roles, "admin")) throw new Error("Forbidden");
  return s;
}

// Native controls in the shared .field look, labelled by Field (with the id
// passed to both) or by aria-label inside a table row. Native rather than
// Field's Input so the ui:guard baseline of these posts stays as it was.
const field = "field";
const cellField = "field field-sm";

/** How many names a review queue lists before "Show all". */
const QUEUE_SHOWN = 50;
/** How many rows a queue reads; the heading's count is exact either way. */
const QUEUE_FETCH = 500;

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
  searchParams: Promise<{ ran?: string; notice?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) redirect("/");
  const svc = createServiceClient();

  const [
    { data: policies },
    { data: requests },
    { data: breaches },
    { data: review, count: reviewCount },
    { data: kycReview, count: kycCount },
    { data: weakBasis },
  ] = await Promise.all([
      svc.from("retention_policies").select("*").order("mode").order("label"),
      svc.from("dp_requests").select("*").order("completed_at", { nullsFirst: true }).order("due_at").limit(100),
      svc.from("dp_breach_log").select("*").order("discovered_at", { ascending: false }).limit(50),
      // The review queues: an exact count for the heading, and enough rows
      // to list the whole queue (QUEUE_FETCH) behind "Show all".
      svc.from("vw_contacts_for_review").select("*", { count: "exact" }).order("updated_at").limit(QUEUE_FETCH),
      svc
        .from("kyc_profiles")
        .select("id, contact_id, status, verified_at, expires_at, contact:crm_contacts(first_name, last_name)", {
          count: "exact",
        })
        .lt("verified_at", new Date(Date.now() - 1825 * 86_400_000).toISOString())
        .order("verified_at")
        .limit(QUEUE_FETCH),
      // Marketing to someone whose only consent record is the bulk import note
      // and who has never bought from the gallery: neither consent nor the
      // PECR soft opt-in is evidenced. These need a re-permission email or a
      // documented basis before the next campaign.
      svc.rpc("contacts_with_weak_marketing_basis"),
    ]);
  const [{ data: lastRuns }, { count: attestedCount }, { data: attestedSample }] = await Promise.all([
    svc.from("dp_retention_runs").select("ran_at, triggered_by, result").order("ran_at", { ascending: false }).limit(1),
    svc.from("crm_contacts").select("id", { count: "exact", head: true }).eq("consent_evidence->marketing->>version", "legacy-import"),
    svc.from("crm_contacts").select("consent_evidence").eq("consent_evidence->marketing->>version", "legacy-import").limit(1),
  ]);
  const lastRun = (lastRuns ?? [])[0] as { ran_at: string; triggered_by: string; result: Record<string, unknown> } | undefined;
  const attestation = ((attestedSample ?? [])[0] as { consent_evidence?: { marketing?: { attested_by?: string; attested_at?: string } } } | undefined)
    ?.consent_evidence?.marketing;

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
    const s = await assertAdmin();
    const db = createServiceClient();
    const { data, error } = await db.rpc("apply_retention");
    if (error) redirect(`/admin/data-protection?error=${encodeURIComponent(error.message)}`);
    await db.from("dp_retention_runs").insert({ triggered_by: s.user.email ?? "admin", result: data });
    redirect(`/admin/data-protection?ran=${encodeURIComponent(describeRun(data as Record<string, unknown>))}`);
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
    redirect(`/admin/data-protection?notice=${encodeURIComponent(`Recorded on ${targets.length} contact${targets.length === 1 ? "" : "s"}: consent given in the previous system, confirmed by ${s.user.email ?? "you"} today.`)}`);
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
  // London dates: a timestamp late in a summer evening would otherwise print
  // as the previous day here (the server runs on UTC). Bare `date` values
  // (received_at, due_at) print as the day they name.
  const fmtDate = (v: unknown) => (v ? formatDate(String(v), "short") : "—");

  type ReviewContact = { id: string; first_name: string | null; last_name: string | null; updated_at: string };
  type KycRow = {
    id: string;
    contact_id: string;
    verified_at: string | null;
    contact: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
  };
  type WeakRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };
  const queueItem = "border-b border-rule py-1.5";
  const nameLink = "link-plain text-ink";
  const reviewRows = (review ?? []) as ReviewContact[];
  const kycRows = (kycReview ?? []) as KycRow[];
  const weakRows = (weakBasis ?? []) as WeakRow[];
  const reviewTotal = reviewCount ?? reviewRows.length;
  const kycTotal = kycCount ?? kycRows.length;

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/admin", label: "Admin" }}
        title="Data protection"
        meta={
          <>
            Retention, the request and breach registers, and what needs a decision. The procedures
            are in <code className="text-ink">docs/compliance</code> in the repository.
          </>
        }
      />
      <div className="mb-6 space-y-2 empty:hidden">
        <FlashNotice searchParams={sp} />
        {sp.ran ? <Notice tone="ok">Retention ran just now. {sp.ran}</Notice> : null}
      </div>

      <div className="space-y-8">
        {/* ---- retention ---- */}
        <Section
          title="Retention schedule"
          meta={
            <>
              Runs every night. &ldquo;Purge&rdquo; classes are deleted after the period;
              &ldquo;review&rdquo; classes are listed below for a person to decide. The Privacy
              Notice quotes these periods, so change both together.
            </>
          }
          actions={
            <form action={runRetention}>
              <Button type="submit" size="sm" pendingLabel="Running…">
                Run retention now
              </Button>
            </form>
          }
        >
          <p className="mb-3 text-[13px] text-body">
            {lastRun
              ? `Last run ${formatDateTime(lastRun.ran_at, "short")} (${lastRun.triggered_by === "cron" ? "scheduled" : lastRun.triggered_by}): ${describeRun(lastRun.result)}`
              : "Not run yet. The first scheduled run is tonight at 03:30 UTC."}
          </p>
          <TableFrame>
            <Table className="min-w-[640px]">
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Keep for</Th>
                  <Th>Then</Th>
                  <Th>Basis</Th>
                </tr>
              </thead>
              <tbody>
                {((policies ?? []) as { key: string; label: string; days: number; mode: string; basis: string | null }[]).map((p) => (
                  <Tr key={p.key} className="align-top">
                    <Td className="align-top text-ink">{p.label}</Td>
                    <Td className="align-top">
                      <form action={updatePolicy} className="flex items-center gap-1.5">
                        <input type="hidden" name="key" value={p.key} />
                        <input
                          name="days"
                          type="number"
                          min={1}
                          max={7300}
                          defaultValue={p.days}
                          aria-label={`Days to keep: ${p.label}`}
                          className={`${cellField} tabular w-20`}
                        />
                        <span className="text-body">days</span>
                        <Button type="submit" size="sm" variant="quiet">
                          Save
                        </Button>
                      </form>
                    </Td>
                    <Td className="align-top text-body">{p.mode === "purge" ? "Deleted" : "Reviewed"}</Td>
                    <Td className="align-top text-body">{p.basis}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        </Section>

        {/* ---- review queues ---- */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Section
            title={`Contacts to review (${reviewTotal})`}
            meta="No consent, no legal hold, nothing attached, untouched for the period above. Erase from the contact page, or keep by adding a note."
          >
            <Queue
              total={reviewTotal}
              empty="Nothing due."
              items={reviewRows.map((c) => (
                <li key={c.id} className={queueItem}>
                  <Link href={`/crm/contacts/${c.id}`} className={nameLink}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"}
                  </Link>
                  <span className="tabular text-[12px] text-meta"> · {fmtDate(c.updated_at)}</span>
                </li>
              ))}
            />
          </Section>
          <Section
            title={`AML records past five years (${kycTotal})`}
            meta="Verified more than five years ago. Keep only while the relationship continues; otherwise delete the documents and checks."
          >
            <Queue
              total={kycTotal}
              empty="Nothing due."
              items={kycRows.map((k) => {
                const c = Array.isArray(k.contact) ? k.contact[0] : k.contact;
                return (
                  <li key={k.id} className={queueItem}>
                    <Link href={`/crm/contacts/${k.contact_id}`} className={nameLink}>
                      {[c?.first_name, c?.last_name].filter(Boolean).join(" ") || "Contact"}
                    </Link>
                    <span className="text-[12px] text-meta"> · verified {fmtDate(k.verified_at)}</span>
                  </li>
                );
              })}
            />
          </Section>
          <Section
            title={`Marketing without evidenced basis (${weakRows.length})`}
            meta="Emailable contacts whose only consent record is the import note and who have never bought from the gallery. Send a re-permission email, or untick marketing consent."
          >
            {attestedCount ? (
              <Notice tone="ok" className="mb-2">
                Legacy consent recorded on {attestedCount} contacts
                {attestation?.attested_by ? ` by ${attestation.attested_by}` : ""}
                {attestation?.attested_at ? ` on ${formatDate(attestation.attested_at, "short")}` : ""}.
              </Notice>
            ) : null}
            {weakRows.length > 0 ? (
              <form action={attestLegacyConsent} className="mb-2">
                {/* A long label: it wraps inside the column rather than overflowing. */}
                <Button
                  type="submit"
                  size="sm"
                  wrap
                  title="Records, under your login and today's date, that these contacts consented in the previous system"
                  pendingLabel="Recording…"
                >
                  Record: all imported contacts consented in the previous system
                </Button>
              </form>
            ) : null}
            <Queue
              total={weakRows.length}
              empty="None."
              items={weakRows.map((c) => (
                <li key={c.id} className={queueItem}>
                  <Link href={`/crm/contacts/${c.id}`} className={nameLink}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed"}
                  </Link>
                </li>
              ))}
            />
          </Section>
        </div>

        {/* ---- requests ---- */}
        <Section
          title="Data-subject requests"
          meta="One month to respond from the day received (extendable by two months for complex requests: note it here). Requests tied to a contact are logged from the contact page."
        >
          <form action={addRequest} className="mb-4 flex flex-wrap items-end gap-3">
            <Field id="dp-request-name" label="Name" className="w-full sm:w-44">
              <input id="dp-request-name" name="subject_name" className={field} />
            </Field>
            <Field id="dp-request-kind" label="Request" className="w-full sm:w-40">
              <select id="dp-request-kind" name="kind" className={field}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field id="dp-request-received" label="Received" className="w-full sm:w-40">
              <input id="dp-request-received" type="date" name="received_at" defaultValue={today} className={field} />
            </Field>
            <Field id="dp-request-channel" label="Channel" className="w-full sm:w-36">
              <input id="dp-request-channel" name="channel" className={field} />
            </Field>
            <Field id="dp-request-notes" label="Notes" className="w-full sm:w-56">
              <input id="dp-request-notes" name="notes" className={field} />
            </Field>
            <Button type="submit" variant="primary" pendingLabel="Logging…">
              Log request
            </Button>
          </form>
          <p id="dp-outcome-hint" className="mb-2 text-[12px] leading-[1.4] text-meta">
            To close a request, note its outcome (what was sent, erased or refused) and press Complete; left
            blank, it is recorded as &ldquo;Completed&rdquo;.
          </p>
          <TableFrame>
            <Table className="min-w-[680px]">
              <thead>
                <tr>
                  <Th>Who</Th>
                  <Th>Request</Th>
                  <Th>Received</Th>
                  <Th>Due</Th>
                  <Th>Outcome</Th>
                </tr>
              </thead>
              <tbody>
                {[...openRequests, ...closedRequests].map((r) => {
                  const overdue = !r.completed_at && String(r.due_at) < today;
                  return (
                    <Tr key={String(r.id)} flagged={overdue}>
                      <Td className="align-top text-ink">
                        {r.contact_id ? (
                          <Link href={`/crm/contacts/${r.contact_id}`} className="link-plain">
                            {String(r.subject_name ?? "Contact")}
                          </Link>
                        ) : (
                          String(r.subject_name ?? "—")
                        )}
                        {r.notes ? <span className="block text-[12px] text-meta">{String(r.notes)}</span> : null}
                      </Td>
                      <Td className="align-top text-body">
                        {KIND_LABEL[String(r.kind)] ?? String(r.kind)}
                        {r.channel ? ` · ${r.channel}` : ""}
                      </Td>
                      <Td className="tabular whitespace-nowrap align-top text-body">{fmtDate(r.received_at)}</Td>
                      <Td className="align-top">
                        {/* Overdue is warn, with the word (spec R4). */}
                        <span className={`tabular whitespace-nowrap ${overdue ? "font-medium text-warn" : "text-body"}`}>
                          {fmtDate(r.due_at)}
                        </span>
                        {overdue ? (
                          <Badge tone="warn" size="xs" className="ml-1.5">
                            Overdue
                          </Badge>
                        ) : null}
                      </Td>
                      <Td className="align-top">
                        {r.completed_at ? (
                          <span className="text-body">
                            Done {fmtDate(r.completed_at)}
                            {r.outcome ? ` · ${r.outcome}` : ""}
                          </span>
                        ) : (
                          <form action={completeRequest} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={String(r.id)} />
                            <input
                              name="outcome"
                              placeholder="Optional"
                              aria-label={`Outcome: ${String(r.subject_name ?? "request")}`}
                              aria-describedby="dp-outcome-hint"
                              className={`${cellField} w-36`}
                            />
                            <Button type="submit" size="sm" pendingLabel="Saving…">
                              Complete
                            </Button>
                          </form>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
                {(requests ?? []).length === 0 ? <EmptyRow colSpan={5}>No requests logged.</EmptyRow> : null}
              </tbody>
            </Table>
          </TableFrame>
        </Section>

        {/* ---- breaches ---- */}
        <Section
          title="Breach register"
          meta={
            <>
              Record every personal-data breach, reportable or not (Art. 33(5)). A breach likely to
              risk people&rsquo;s rights must be reported to the ICO within 72 hours of discovery; if
              the risk is high, tell the people affected as well.
            </>
          }
        >
          <form action={addBreach} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field id="dp-breach-occurred" label="Occurred">
              <input id="dp-breach-occurred" type="datetime-local" name="occurred_at" className={field} />
            </Field>
            <Field id="dp-breach-people" label="People affected">
              <input id="dp-breach-people" type="number" name="people_affected" min={0} className={field} />
            </Field>
            <Field id="dp-breach-risk" label="Likely risk">
              <select id="dp-breach-risk" name="likely_risk" className={field}>
                <option value="unlikely">Unlikely</option>
                <option value="possible">Possible</option>
                <option value="likely">Likely: report to the ICO</option>
                <option value="high">High: report and notify people</option>
              </select>
            </Field>
            <Field id="dp-breach-what" label="What happened" className="md:col-span-3">
              <textarea id="dp-breach-what" name="description" required rows={2} className={field} />
            </Field>
            <Field id="dp-breach-data" label="Data involved" className="md:col-span-2">
              <input id="dp-breach-data" name="data_affected" className={field} />
            </Field>
            <Field id="dp-breach-actions" label="Actions taken" className="md:col-span-3">
              <textarea id="dp-breach-actions" name="actions_taken" rows={2} className={field} />
            </Field>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink md:col-span-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" name="reported_to_ico" className="h-4 w-4" /> Reported to the ICO
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" name="subjects_notified" className="h-4 w-4" /> People affected notified
              </label>
              <Button type="submit" variant="primary" className="sm:ml-auto" pendingLabel="Recording…">
                Record breach
              </Button>
            </div>
          </form>
          <ul className="text-[13px]">
            {((breaches ?? []) as Record<string, unknown>[]).map((b) => (
              <li key={String(b.id)} className="border-b border-rule py-2">
                <p className="text-ink">
                  <span className="tabular text-meta">{fmtDate(b.discovered_at)} · </span>
                  {String(b.description)}
                </p>
                <p className="mt-0.5 text-[12px] text-meta">
                  {b.data_affected ? `${b.data_affected} · ` : ""}
                  {b.people_affected ? `${b.people_affected} people · ` : ""}risk {String(b.likely_risk ?? "—")} ·{" "}
                  {b.reported_to_ico ? `reported to the ICO ${fmtDate(b.reported_at)}` : "not reported"} ·{" "}
                  {b.subjects_notified ? "people notified" : "people not notified"}
                  {b.actions_taken ? ` · ${b.actions_taken}` : ""}
                </p>
              </li>
            ))}
            {(breaches ?? []).length === 0 ? <li className="py-2 text-body">No breaches recorded.</li> : null}
          </ul>
        </Section>
      </div>
    </div>
  );
}

/**
 * A review queue: the whole list, the first QUEUE_SHOWN names at once and
 * the rest behind "Show all" (a <details>, so no script and no URL state).
 * When the queue is longer than what was read, the line says how many are
 * listed of how many there are.
 */
function Queue({ items, total, empty }: { items: React.ReactNode[]; total: number; empty: string }) {
  if (items.length === 0) return <p className="py-1.5 text-[13px] text-body">{empty}</p>;
  const first = items.slice(0, QUEUE_SHOWN);
  const rest = items.slice(QUEUE_SHOWN);
  const listed = items.length < total ? (
    <p className="pt-1.5 text-[12px] leading-[1.4] text-meta">
      The first {items.length} of {total} are listed here.
    </p>
  ) : null;
  return (
    <div className="text-[13px]">
      <ul>{first}</ul>
      {rest.length > 0 ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 py-1.5 text-[12px] leading-[1.4] text-body hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="tabular text-meta group-open:hidden">
              {first.length} of {items.length} shown ·
            </span>
            <span className="font-medium underline underline-offset-2 group-open:hidden">Show all</span>
            <span className="hidden font-medium underline underline-offset-2 group-open:inline">
              Show the first {first.length} only
            </span>
          </summary>
          <ul>{rest}</ul>
        </details>
      ) : null}
      {listed}
    </div>
  );
}

const RUN_LABEL: Record<string, string> = {
  email_events: "email events",
  offer_views: "offer page views",
  campaign_recipients: "newsletter send records",
  enquiries: "enquiries",
  appointments: "appointments",
  unconfirmed_signups: "unconfirmed sign-ups",
  activity_log: "change-log entries",
};

/** "Deleted 12 enquiries and 3 appointments" / "Nothing was old enough to delete". */
function describeRun(result: Record<string, unknown> | null | undefined): string {
  const parts = Object.entries(result ?? {})
    .filter(([k, v]) => k in RUN_LABEL && typeof v === "number" && v > 0)
    .map(([k, v]) => `${v} ${RUN_LABEL[k]}`);
  if (parts.length === 0) return "Nothing was old enough to delete.";
  return `Deleted ${parts.join(", ")}.`;
}
