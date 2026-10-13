import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { NewDocument } from "@/components/new-document";
import { formatCount, formatDate } from "@/lib/format";
import { DOC_TYPE_LABELS as TYPE_LABELS, labelOf } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { SegmentedLinks } from "@/components/ui/chips";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Documents" };

type Row = {
  id: string;
  doc_type: string;
  title: string | null;
  reference: string | null;
  doc_date: string | null;
  document_pieces: { count: number }[];
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabase();

  let query = supabase
    .from("piece_documents")
    .select("id, doc_type, title, reference, doc_date, document_pieces(count)")
    .order("doc_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (sp.type) query = query.eq("doc_type", sp.type);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const filters = [
    { value: "", label: "All", href: "/documents" },
    ...Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l, href: `/documents?type=${v}` })),
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        meta={
          <span className="tabular">
            {formatCount(rows.length)} {rows.length === 1 ? "document" : "documents"}
          </span>
        }
      >
        <p className="max-w-[var(--jvb-measure)] text-[13px] leading-[1.45] text-body">
          Invoices, provenance, correspondence, shipping and insurance. Upload once and link to
          every inventory item it covers.
        </p>
      </PageHeader>

      {/* The upload panel opens in place, full width, above the list. */}
      <div className="mb-4">
        <NewDocument />
      </div>

      <SegmentedLinks aria-label="Document type" items={filters} current={sp.type ?? ""} className="mb-3" />

      <TableFrame bordered>
        <Table className="min-w-[600px]">
          <thead>
            <tr>
              <Th>Type</Th>
              <Th>Title</Th>
              <Th>Date</Th>
              <Th>Reference</Th>
              <Th numeric>Items</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="whitespace-nowrap">
                  <Link href={`/documents/${r.id}`} className="link-plain font-medium text-ink">
                    {labelOf(TYPE_LABELS, r.doc_type)}
                  </Link>
                </Td>
                <Td className="text-body">{r.title ?? "—"}</Td>
                <Td className="tabular whitespace-nowrap text-body">{formatDate(r.doc_date, "numeric")}</Td>
                <Td className="text-body">{r.reference ?? "—"}</Td>
                <Td numeric className="text-body">
                  {r.document_pieces?.[0]?.count ?? 0}
                </Td>
              </Tr>
            ))}
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={5}
                action={
                  sp.type ? (
                    <ButtonLink href="/documents" size="sm">
                      All documents
                    </ButtonLink>
                  ) : undefined
                }
              >
                {sp.type ? "No documents of this type yet." : "No documents yet. Upload one with New document."}
              </EmptyRow>
            ) : null}
          </tbody>
        </Table>
      </TableFrame>
    </div>
  );
}
