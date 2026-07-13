type Option = { id: string; label: string };

const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";
const label =
  "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";

export function PieceFormFields({
  piece,
  financials,
  makers,
  categories,
  locations,
  showFinancials,
}: {
  piece: Record<string, unknown> | null;
  financials: Record<string, unknown> | null;
  makers: Option[];
  categories: Option[];
  locations: Option[];
  showFinancials: boolean;
}) {
  const v = (k: string) => (piece?.[k] as string | number | null) ?? "";
  const f = (k: string) => (financials?.[k] as string | number | null) ?? "";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-5">
        <section className="rounded-[11px] border border-line bg-cell p-5">
          <h2 className="text-[13px] font-semibold text-ink-strong">Cataloguing</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={`${label} sm:col-span-2`}>
              Title
              <input name="title" defaultValue={v("title")} className={field} />
            </label>
            <label className={label}>
              Maker
              <select name="maker_id" defaultValue={v("maker_id")} className={field}>
                <option value="">—</option>
                {makers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Category
              <select name="category_id" defaultValue={v("category_id")} className={field}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Medium
              <input name="medium" defaultValue={v("medium")} className={field} />
            </label>
            <label className={label}>
              Period
              <input name="period" defaultValue={v("period")} className={field} placeholder="Shōwa, c. 1960" />
            </label>
            <label className={label}>
              Origin / region
              <input name="origin_region" defaultValue={v("origin_region")} className={field} placeholder="Japan" />
            </label>
            <label className={label}>
              Status
              <select name="status" defaultValue={v("status") || "in_stock"} className={field}>
                {["in_stock", "reserved", "consigned_in", "consigned_out", "sold", "gifted", "returned", "written_off"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
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

        <section className="rounded-[11px] border border-line bg-cell p-5">
          <h2 className="text-[13px] font-semibold text-ink-strong">Dimensions</h2>
          <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
            {(["height_cm", "width_cm", "depth_cm", "length_cm", "diameter_cm", "weight_g"] as const).map((k) => (
              <label key={k} className={label}>
                {k === "weight_g" ? "Weight g" : `${k.split("_")[0]} cm`}
                <input name={k} type="number" step="0.1" defaultValue={v(k)} className={field} />
              </label>
            ))}
          </div>
          <label className={`${label} mt-4 block`}>
            Display fallback (verbatim)
            <input name="dimensions_display" defaultValue={v("dimensions_display")} className={field} />
          </label>
        </section>

        {showFinancials ? (
          <section className="rounded-[11px] border border-line bg-band p-5">
            <h2 className="text-[13px] font-semibold text-ink-strong">Financials</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <label className={label}>
                Purchase date
                <input name="purchase_date" type="date" defaultValue={f("purchase_date")} className={field} />
              </label>
              <label className={label}>
                Purchase cost
                <input name="purchase_cost" type="number" step="0.01" defaultValue={f("purchase_cost")} className={field} />
              </label>
              <label className={label}>
                Currency
                <input name="purchase_currency" defaultValue={f("purchase_currency") || "GBP"} className={field} />
              </label>
              <label className={label}>
                FX → GBP
                <input name="purchase_fx" type="number" step="0.0001" defaultValue={f("purchase_fx") || 1} className={field} />
              </label>
              <label className={label}>
                Cost £
                <input name="purchase_cost_gbp" type="number" step="0.01" defaultValue={f("purchase_cost_gbp")} className={field} />
              </label>
              <label className={label}>
                Restoration £
                <input name="restoration_cost_gbp" type="number" step="0.01" defaultValue={f("restoration_cost_gbp") || 0} className={field} />
              </label>
              <label className={label}>
                Other costs £
                <input name="other_costs_gbp" type="number" step="0.01" defaultValue={f("other_costs_gbp") || 0} className={field} />
              </label>
              <label className={label}>
                Marked price £
                <input name="marked_price_gbp" type="number" step="1" defaultValue={f("marked_price_gbp")} className={field} />
              </label>
              <label className={label}>
                Sold date
                <input name="sold_date" type="date" defaultValue={f("sold_date")} className={field} />
              </label>
              <label className={label}>
                Sold price
                <input name="sold_price" type="number" step="0.01" defaultValue={f("sold_price")} className={field} />
              </label>
              <label className={label}>
                Sell currency
                <input name="sell_currency" defaultValue={f("sell_currency") || "GBP"} className={field} />
              </label>
              <label className={label}>
                Sell FX → GBP
                <input name="sell_fx" type="number" step="0.0001" defaultValue={f("sell_fx") || 1} className={field} />
              </label>
              <label className={label}>
                Sold £
                <input name="sold_price_gbp" type="number" step="0.01" defaultValue={f("sold_price_gbp")} className={field} />
              </label>
              <label className={label}>
                VAT treatment
                <select name="vat_treatment" defaultValue={f("vat_treatment") || "margin_scheme"} className={field}>
                  {["margin_scheme", "standard", "zero_rated", "outside_scope"].map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}
      </div>

      <div className="space-y-5">
        <section className="rounded-[11px] border border-line bg-cell p-5">
          <h2 className="text-[13px] font-semibold text-ink-strong">Placement</h2>
          <label className={`${label} mt-4 block`}>
            Location
            <select name="location_id" defaultValue={v("location_id")} className={field}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} mt-4 block`}>
            Internal comments
            <textarea name="comments" defaultValue={v("comments")} rows={4} className={field} />
          </label>
          <label className="mt-4 flex items-center gap-2 text-[13px] text-ink-body">
            <input
              type="checkbox"
              name="web_visible"
              defaultChecked={Boolean(piece?.web_visible)}
            />
            Visible on website (syncs to Sanity)
          </label>
        </section>
      </div>
    </div>
  );
}
