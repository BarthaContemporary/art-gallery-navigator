import { BuyerSelect } from "@/components/buyer-select";
import { CategorySelect } from "@/components/category-select";
import { MakerSelect } from "@/components/maker-select";
import { OriginSelect } from "@/components/origin-select";
import { DimensionsFields } from "@/components/dimensions-fields";
import { FinancialsFields } from "@/components/financials-fields";
import { RepeatableList } from "@/components/repeatable-list";

type Option = { id: string; label: string };

const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";
const label =
  "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const panel = "rounded-[11px] border border-line bg-cell p-5";

export function PieceFormFields({
  piece,
  financials,
  makers,
  categories,
  locations,
  originRegions,
  showFinancials,
  buyerName,
}: {
  piece: Record<string, unknown> | null;
  financials: Record<string, unknown> | null;
  makers: Option[];
  categories: Option[];
  locations: Option[];
  originRegions: string[];
  showFinancials: boolean;
  buyerName?: string | null;
}) {
  const v = (k: string) => (piece?.[k] as string | number | null) ?? "";
  const f = (k: string) => (financials?.[k] as string | number | null) ?? "";
  const list = (k: string): string[] => {
    const raw = piece?.[k];
    if (Array.isArray(raw)) return raw.map((x) => String(x));
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x));
      } catch {
        /* fall through */
      }
    }
    return [];
  };
  const s = (getter: (k: string) => string | number | null, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, String(getter(k) ?? "")]));

  const dimDefaults = s(v, [
    "height_cm", "width_cm", "depth_cm", "length_cm", "diameter_cm", "weight_g", "dimensions_display",
  ]);
  const finDefaults = s(f, [
    "purchase_date", "purchase_cost", "purchase_currency", "purchase_cost_gbp",
    "restoration_cost_gbp", "other_costs_gbp", "marked_price_gbp",
    "sold_date", "sold_price", "sell_currency", "sold_price_gbp", "vat_treatment",
  ]);

  return (
    <div className="space-y-5">
      {/* Cataloguing — full width */}
      <section className={panel}>
        <h2 className="text-[13px] font-semibold text-ink-strong">Cataloguing</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex gap-4 sm:col-span-2">
            <label className={`${label} flex-1`}>
              Title
              <input name="title" defaultValue={v("title")} className={field} />
            </label>
            <label className={`${label} w-32 shrink-0`}>
              Year
              <input name="year" defaultValue={v("year")} className={field} placeholder="2024-26" />
            </label>
          </div>
          <div className={label}>
            Maker
            <MakerSelect options={makers} defaultId={String(v("maker_id")) || null} />
          </div>
          <div className={label}>
            Category
            <CategorySelect options={categories} defaultId={String(v("category_id")) || null} />
          </div>
          <label className={label}>
            Medium
            <input name="medium" defaultValue={v("medium")} className={field} />
          </label>
          <label className={label}>
            Period
            <input name="period" defaultValue={v("period")} className={field} placeholder="Shōwa, c. 1960" />
          </label>
          <div className={label}>
            Origin / region
            <OriginSelect options={originRegions} defaultValue={String(v("origin_region"))} />
          </div>
          <label className={label}>
            Status
            <select name="status" defaultValue={v("status") || "in_stock"} className={field}>
              {["in_stock", "reserved", "consigned_in", "consigned_out", "sold", "gifted", "returned", "written_off"].map((st) => (
                <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>
            Description
            <textarea name="description" defaultValue={v("description")} rows={5} className={field} />
          </label>
          <label className={label}>
            Condition
            <textarea name="condition_report" defaultValue={v("condition_report")} rows={3} className={field} />
          </label>
          <label className={label}>
            Signature / inscription
            <textarea name="signature_inscription" defaultValue={v("signature_inscription")} rows={3} className={field} />
          </label>
          <label className={label}>
            Box (tomobako)
            <input name="box_type" defaultValue={v("box_type")} className={field} placeholder="signed box / fitted box" />
          </label>
          <label className={label}>
            Box notes
            <input name="box_notes" defaultValue={v("box_notes")} className={field} />
          </label>
        </div>
      </section>

      {/* Dimensions | Placement — side by side, tops aligned */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="text-[13px] font-semibold text-ink-strong">Dimensions</h2>
          <DimensionsFields defaults={dimDefaults} />
        </section>

        <section className={panel}>
          <h2 className="text-[13px] font-semibold text-ink-strong">Placement</h2>
          <label className={`${label} mt-4 block`}>
            Location
            <select name="location_id" defaultValue={v("location_id")} className={field}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>
          <label className={`${label} mt-4 block`}>
            Internal comments
            <textarea name="comments" defaultValue={v("comments")} rows={4} className={field} />
          </label>
        </section>
      </div>

      {showFinancials ? (
        <section className="rounded-[11px] border border-line bg-band p-5">
          <h2 className="text-[13px] font-semibold text-ink-strong">Financials</h2>
          <FinancialsFields defaults={finDefaults} />
        </section>
      ) : null}

      {/* Buyer — sits directly under financials */}
      <section className={panel}>
        <h2 className="text-[13px] font-semibold text-ink-strong">Buyer</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showFinancials ? (
            <div className={label}>
              Buyer (CRM contact)
              <div className="mt-1.5">
                <BuyerSelect
                  initialId={String(financials?.buyer_contact_id ?? "") || null}
                  initialName={buyerName ?? null}
                />
              </div>
            </div>
          ) : null}
          <label className={label}>
            Buyer note (freeform)
            <input name="sold_to" defaultValue={v("sold_to")} className={field} />
          </label>
        </div>
      </section>

      {/* Provenance & source */}
      <section className={panel}>
        <h2 className="text-[13px] font-semibold text-ink-strong">Provenance &amp; source</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            Source / acquired from
            <input name="source_note" defaultValue={v("source_note")} className={field} placeholder="dealer, auction, date…" />
          </label>
          <label className={label}>
            Purchased from
            <input name="purchased_from" defaultValue={v("purchased_from")} className={field} />
          </label>
        </div>
      </section>

      {/* Published & exhibited — repeatable lists */}
      <section className={panel}>
        <h2 className="text-[13px] font-semibold text-ink-strong">Published &amp; exhibited</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className={label}>Publications</p>
            <RepeatableList
              name="publications"
              initial={list("publications")}
              placeholder="Author, Title (publisher, year), p. 00"
              addLabel="Add publication"
            />
          </div>
          <div>
            <p className={label}>Past exhibitions</p>
            <RepeatableList
              name="exhibitions"
              initial={list("exhibitions")}
              placeholder="Exhibition title, venue, year"
              addLabel="Add exhibition"
            />
          </div>
        </div>
      </section>

      {/* Consignment */}
      <section className={panel}>
        <h2 className="text-[13px] font-semibold text-ink-strong">Consignment</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            Shares / co-ownership
            <input name="shares_note" defaultValue={v("shares_note")} className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Consignment details
            <textarea name="consignment_details" defaultValue={v("consignment_details")} rows={2} className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Document note
            <textarea name="document_note" defaultValue={v("document_note")} rows={2} className={field} />
          </label>
        </div>
      </section>
    </div>
  );
}
