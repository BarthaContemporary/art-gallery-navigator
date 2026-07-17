import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";
import { PieceFormFields } from "@/components/piece-form";
import { savePiece } from "../actions";

export const metadata = { title: "New record" };

export default async function NewPiecePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await getSupabase();
  const session = await getSession();
  const showFinancials = session ? canSeeFinancials(session.roles) : false;

  const [makers, categories, locations, originRegions] = await Promise.all([
    supabase.from("makers").select("id, display_name, life_dates").order("display_name"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("locations").select("id, code").order("code"),
    supabase.from("origin_regions").select("name").eq("is_active", true).order("sort_order"),
  ]);

  const save = savePiece.bind(null, null);

  return (
    <form action={save}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-semibold text-ink-strong">New record</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            The stock number is assigned automatically on save.
          </p>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-fg"
        >
          Create record
        </button>
      </div>
      {error ? (
        <p className="mt-4 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
          {error}
        </p>
      ) : null}
      <div className="mt-6">
        <PieceFormFields
          piece={null}
          financials={null}
          makers={(makers.data ?? []).map((m) => ({
            id: m.id,
            label: m.life_dates ? `${m.display_name} (${m.life_dates})` : m.display_name,
          }))}
          categories={(categories.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
          locations={(locations.data ?? []).map((l) => ({ id: l.id, label: l.code }))}
          originRegions={(originRegions.data ?? []).map((o) => o.name as string)}
          showFinancials={showFinancials}
        />
      </div>
    </form>
  );
}
