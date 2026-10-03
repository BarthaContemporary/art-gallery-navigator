import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { buildContactExport } from "@/lib/contact-export";

export const metadata = { title: "Personal data" };

/**
 * Printable copy of everything held about a contact — the document that
 * answers a subject access request. Print to PDF from the browser.
 */
export default async function ContactDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) redirect(`/crm/contacts/${id}`);
  const data = await buildContactExport(createServiceClient(), id);
  if (!data) notFound();

  const name = [data.contact.first_name, data.contact.last_name].filter(Boolean).join(" ") || "Contact";
  const fmt = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (Array.isArray(v)) return v.length ? v.map(fmt).join(", ") : "—";
    if (typeof v === "object") return JSON.stringify(v);
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-GB");
    return String(v);
  };
  const Section = ({ title, rows }: { title: string; rows: Record<string, unknown>[] }) => (
    <section className="mt-6 break-inside-avoid">
      <h2 className="text-[13px] font-semibold text-ink-strong">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-[12.5px] text-ink-soft">None held.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <dl key={i} className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-0.5 rounded-lg border border-line-soft px-3 py-2 text-[12.5px]">
              {Object.entries(r)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-soft">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-ink-body">{fmt(v)}</dd>
                  </div>
                ))}
            </dl>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="max-w-[900px]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/crm/contacts/${id}`} className="text-[12.5px] text-ink-soft">
          ← {name}
        </Link>
        <div className="flex gap-2">
          <a href={`/api/crm/contacts/${id}/export`} className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid">
            Download JSON
          </a>
          <PrintButton />
        </div>
      </div>
      <h1 className="mt-3 text-[22px] font-semibold text-ink-strong">Personal data held about {name}</h1>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        Prepared {new Date(data.exported_at).toLocaleString("en-GB")}. This is the complete record held in the gallery system,
        for a subject access request under Article 15 UK GDPR.
      </p>
      {data.legal_holds.length > 0 ? (
        <p className="mt-2 text-[12.5px] text-ink-body">
          Records we must keep by law: {data.legal_holds.join("; ")}.
        </p>
      ) : null}
      <Section title="Contact details" rows={[data.contact]} />
      <Section title="Marketing consent" rows={[data.consent]} />
      <Section title="Notes of contact with the gallery" rows={data.interactions} />
      <Section title="Mailing lists" rows={data.lists.length ? [{ lists: data.lists }] : []} />
      <Section title="Newsletters received" rows={data.newsletters} />
      <Section title="Private offers" rows={data.offers} />
      <Section title="Enquiries" rows={data.enquiries} />
      <Section title="Appointments" rows={data.appointments} />
      <Section title="Purchases from the gallery" rows={data.purchases} />
      <Section title="Sales to the gallery" rows={data.sales_to_gallery} />
      <Section title="Consignments" rows={data.consignments} />
      <Section title="Anti-money-laundering checks" rows={data.aml} />
      <Section title="Previous data-protection requests" rows={data.requests} />
    </div>
  );
}

function PrintButton() {
  return (
    <form action="javascript:window.print()">
      <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg">
        Print / save as PDF
      </button>
    </form>
  );
}
