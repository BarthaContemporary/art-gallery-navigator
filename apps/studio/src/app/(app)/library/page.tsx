import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Inventory Lists & Docs" };

async function count(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  table: string,
): Promise<number | null> {
  const { count: c } = await supabase.from(table).select("id", { count: "exact", head: true });
  return c ?? null;
}

export default async function LibraryPage() {
  const supabase = await getSupabase();
  const [lists, shipments, documents, makers, locations] = await Promise.all([
    count(supabase, "piece_lists"),
    count(supabase, "shipments"),
    count(supabase, "piece_documents"),
    count(supabase, "makers"),
    count(supabase, "locations"),
  ]);

  const cards: { href: string; title: string; desc: string; count: number | null }[] = [
    { href: "/inventory/lists", title: "Inventory lists", desc: "Saved and live views of your inventory.", count: lists },
    { href: "/shipments", title: "Shipments", desc: "Import, export and temporary-export records, with paperwork.", count: shipments },
    { href: "/documents", title: "Documents", desc: "Invoices, provenance, shipping, insurance & correspondence — shared across works.", count: documents },
    { href: "/makers", title: "Makers", desc: "The maker directory with native names and life dates.", count: makers },
    { href: "/locations", title: "Locations", desc: "Storage, gallery and other locations.", count: locations },
  ];

  return (
    <div className="max-w-[760px]">
      <h1 className="text-[22px] font-semibold text-ink-strong">Inventory Lists &amp; Docs</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Lists, shipments, documents and reference data in one place.
      </p>

      <div className="mt-5 space-y-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-center justify-between gap-4 rounded-[11px] border border-line bg-cell px-5 py-4 hover:border-line-control"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-semibold text-ink-strong">{c.title}</h2>
                {c.count != null ? (
                  <span className="font-mono text-[12px] text-ink-soft">{c.count}</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">{c.desc}</p>
            </div>
            <span aria-hidden className="shrink-0 text-[18px] text-ink-soft">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
