import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { buildContactExport } from "@/lib/contact-export";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, ButtonLink } from "@/components/ui/button";
import { ArrowLeftIcon, DownloadIcon, PrintIcon } from "@/components/ui/icons";

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
    // Timestamps in London time, as the gallery recorded them; the server runs
    // on UTC, which put summer entries an hour out on the copy the person gets.
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v, "numeric", { seconds: true });
    return String(v);
  };
  // Each record as label-value pairs. Not the shared Section component: that
  // name is the container below.
  const DataSection = ({ title, rows }: { title: string; rows: Record<string, unknown>[] }) => (
    <Section title={title} className="break-inside-avoid">
      {rows.length === 0 ? (
        <p className="text-[13px] leading-[1.45] text-body">None held.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <dl
              key={i}
              className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-1 border border-rule px-3 py-2 text-[13px] leading-[1.45] sm:grid-cols-[180px_minmax(0,1fr)]"
            >
              {Object.entries(r)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-meta">{k.replace(/_/g, " ")}</dt>
                    <dd className="break-words text-ink">{fmt(v)}</dd>
                  </div>
                ))}
            </dl>
          ))}
        </div>
      )}
    </Section>
  );

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      {/* The back link and the actions stay off the printed copy, so the
          person receives the record and nothing of the studio around it.
          PageHeader's own back link cannot be hidden in print, hence this
          one above it. */}
      <Link
        href={`/crm/contacts/${id}`}
        className="mb-1 inline-flex items-center gap-1 text-[12px] leading-[1.4] text-meta hover:text-ink print:hidden"
      >
        <ArrowLeftIcon size={14} />
        {name}
      </Link>
      <PageHeader
        title={`Personal data held about ${name}`}
        meta={`Prepared ${formatDateTime(data.exported_at, "numeric", { seconds: true })}`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <ButtonLink href={`/api/crm/contacts/${id}/export`} native icon={<DownloadIcon size={14} />}>
              Download JSON
            </ButtonLink>
            <PrintButton />
          </div>
        }
      >
        <div className="max-w-[var(--jvb-measure)] space-y-2 text-[13px] leading-[1.45] text-body">
          <p>
            This is the complete record held in the gallery system, for a subject access request under Article 15 UK
            GDPR.
          </p>
          {data.legal_holds.length > 0 ? (
            <p>Records we must keep by law: {data.legal_holds.join("; ")}.</p>
          ) : null}
        </div>
      </PageHeader>
      <div className="space-y-6">
        <DataSection title="Contact details" rows={[data.contact]} />
        <DataSection title="Marketing consent" rows={[data.consent]} />
        <DataSection title="Notes of contact with the gallery" rows={data.interactions} />
        <DataSection title="Mailing lists" rows={data.lists.length ? [{ lists: data.lists }] : []} />
        <DataSection title="Newsletters received" rows={data.newsletters} />
        <DataSection title="Private offers" rows={data.offers} />
        <DataSection title="Private offer page views" rows={data.offer_views} />
        <DataSection title="Enquiries" rows={data.enquiries} />
        <DataSection title="Appointments" rows={data.appointments} />
        <DataSection title="Purchases from the gallery" rows={data.purchases} />
        <DataSection title="Sales to the gallery" rows={data.sales_to_gallery} />
        <DataSection title="Consignments" rows={data.consignments} />
        <DataSection title="Anti-money-laundering checks" rows={data.aml} />
        <DataSection title="Previous data-protection requests" rows={data.requests} />
      </div>
    </div>
  );
}

function PrintButton() {
  return (
    <form action="javascript:window.print()">
      <Button type="submit" variant="primary" icon={<PrintIcon size={14} />}>
        Print or save as PDF
      </Button>
    </form>
  );
}
