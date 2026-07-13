import { notFound } from "next/navigation";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";
import { PieceFormFields } from "@/components/piece-form";
import { savePiece } from "../../actions";

export const metadata = { title: "Edit record" };

export default async function EditPiecePage({
  params,
  searchParams,
}: {
  params: Promise<{ stockNumber: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { stockNumber: raw } = await params;
  const { error } = await searchParams;
  const stockNumber = decodeURIComponent(raw);
  const supabase = await getSupabase();
  const session = await getSession();
  const showFinancials = session ? canSeeFinancials(session.roles) : false;

  const { data: piece } = await supabase
    .from("pieces")
    .select("*")
    .eq("stock_number", stockNumber)
    .maybeSingle();
  if (!piece) notFound();

  const [makers, categories, locations, financials] = await Promise.all([
    supabase.from("makers").select("id, display_name").order("display_name"),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("locations").select("id, code").order("code"),
    showFinancials
      ? supabase.from("piece_financials").select("*").eq("piece_id", piece.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const save = savePiece.bind(null, stockNumber);

  return (
    <form action={save}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-semibold text-ink-strong">
            Edit <span className="font-mono text-[20px]">{piece.stock_number}</span>
          </h1>
          {piece.legacy_stock_number ? (
            <p className="mt-1 font-mono text-[12px] text-ink-soft">
              Legacy number {piece.legacy_stock_number}
              {piece.legacy_stock_number_conflict ? " (duplicated in FileMaker)" : ""}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-fg"
        >
          Save changes
        </button>
      </div>
      {error ? (
        <p className="mt-4 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
          {error}
        </p>
      ) : null}
      <div className="mt-6">
        <PieceFormFields
          piece={piece}
          financials={financials.data}
          makers={(makers.data ?? []).map((m) => ({ id: m.id, label: m.display_name }))}
          categories={(categories.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
          locations={(locations.data ?? []).map((l) => ({ id: l.id, label: l.code }))}
          showFinancials={showFinancials}
        />
      </div>
    </form>
  );
}
