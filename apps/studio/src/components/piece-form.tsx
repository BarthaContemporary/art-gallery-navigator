import { BuyerSelect } from "@/components/buyer-select";
import { CategorySelect } from "@/components/category-select";
import { MakerSelect } from "@/components/maker-select";
import { OriginSelect } from "@/components/origin-select";
import { DimensionsFields } from "@/components/dimensions-fields";
import { FinancialsFields } from "@/components/financials-fields";
import { RepeatableList } from "@/components/repeatable-list";
import { STATUS_LABELS } from "@/lib/labels";
import { Field } from "@/components/ui/field";
import { Section } from "@/components/ui/section";

type Option = { id: string; label: string };

// Field ids carry a "pf-" prefix: one piece form per page, and the labels
// point at their controls by id (the old wrapping <label>s also passed their
// capitals and letter-spacing on to the text typed inside).
export function PieceFormFields({
  piece,
  financials,
  makers,
  categories,
  locations,
  originRegions,
  showFinancials,
  buyerName,
  squareGuess,
}: {
  piece: Record<string, unknown> | null;
  financials: Record<string, unknown> | null;
  makers: Option[];
  categories: Option[];
  locations: Option[];
  originRegions: string[];
  showFinancials: boolean;
  buyerName?: string | null;
  /** What the website sync decided for the first photograph, shown beside "Auto". */
  squareGuess?: "flat" | "object" | "photo" | null;
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
    "height_cm", "width_cm", "depth_cm", "length_cm", "diameter_cm", "weight_g",
    "unframed_height_cm", "unframed_width_cm", "unframed_depth_cm",
    "unframed_length_cm", "unframed_diameter_cm", "unframed_weight_g",
  ]);
  const finDefaults = s(f, [
    "purchase_date", "purchase_cost", "purchase_currency", "purchase_cost_gbp",
    "restoration_cost_gbp", "other_costs_gbp", "marked_price_gbp",
    "sold_date", "sold_price", "sell_currency", "sold_price_gbp", "vat_treatment",
  ]);

  return (
    <div className="space-y-8">
      {/* Cataloguing: full width */}
      <Section title="Cataloguing">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex gap-4 sm:col-span-2">
            <Field label="Title" id="pf-title" className="flex-1">
              <input id="pf-title" name="title" defaultValue={v("title")} className="field" />
            </Field>
            <Field label="Year" id="pf-year" className="w-28 shrink-0">
              <input id="pf-year" name="year" defaultValue={v("year")} className="field tabular" placeholder="2024-26" />
            </Field>
          </div>
          {/* A picker of several controls: the group takes the label's name. */}
          <div role="group" aria-labelledby="pf-maker-label" className="flex min-w-0 flex-col gap-1">
            <label id="pf-maker-label" htmlFor="pf-maker" className="label">
              Maker
            </label>
            <MakerSelect id="pf-maker" options={makers} defaultId={String(v("maker_id")) || null} />
          </div>
          <Field label="Category" id="pf-category">
            <CategorySelect id="pf-category" options={categories} defaultId={String(v("category_id")) || null} />
          </Field>
          <Field label="Medium" id="pf-medium">
            <input id="pf-medium" name="medium" defaultValue={v("medium")} className="field" />
          </Field>
          <Field label="Period" id="pf-period">
            <input id="pf-period" name="period" defaultValue={v("period")} className="field" placeholder="Shōwa, c. 1960" />
          </Field>
          <Field label="Origin / region" id="pf-origin">
            <OriginSelect id="pf-origin" options={originRegions} defaultValue={String(v("origin_region"))} />
          </Field>
          <Field label="Status" id="pf-status">
            <select id="pf-status" name="status" defaultValue={v("status") || "in_stock"} className="field">
              {/* Same eight values in the same order as before; the words now
                  match the status pill and filters ("Available", not "in stock"). */}
              {Object.entries(STATUS_LABELS).map(([st, text]) => (
                <option key={st} value={st}>{text}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Website square"
            id="pf-presentation"
            className="sm:col-span-2"
            hint="How the first photograph fills the square on the website. Auto reads the photograph: a work cropped to its edges is fitted on white; an object on the studio backdrop is centred with the backdrop extended; an object photographed in a room is shown as taken."
          >
            <select
              id="pf-presentation"
              name="presentation"
              defaultValue={v("presentation") || "auto"}
              aria-describedby="pf-presentation-hint"
              className="field sm:max-w-[calc(50%-8px)]"
            >
              <option value="auto">
                {squareGuess
                  ? `Auto (currently ${squareGuess === "flat" ? "flat work" : squareGuess === "photo" ? "photograph as taken" : "object"})`
                  : "Auto"}
              </option>
              <option value="flat">Flat work: fitted on white</option>
              <option value="object">Object: centred on the backdrop</option>
              <option value="photo">Photograph as taken: cut square around the piece</option>
            </select>
          </Field>
          <Field label="Description" id="pf-description" className="sm:col-span-2">
            <textarea id="pf-description" name="description" defaultValue={v("description")} rows={5} className="field" />
          </Field>
          <Field label="Condition" id="pf-condition">
            <textarea id="pf-condition" name="condition_report" defaultValue={v("condition_report")} rows={3} className="field" />
          </Field>
          <Field label="Signature / inscription" id="pf-signature">
            <textarea id="pf-signature" name="signature_inscription" defaultValue={v("signature_inscription")} rows={3} className="field" />
          </Field>
          <Field label="Box (tomobako)" id="pf-box">
            <input id="pf-box" name="box_type" defaultValue={v("box_type")} className="field" placeholder="signed box / fitted box" />
          </Field>
          <Field label="Box notes" id="pf-box-notes">
            <input id="pf-box-notes" name="box_notes" defaultValue={v("box_notes")} className="field" />
          </Field>
        </div>
      </Section>

      {/* Dimensions | Placement: side by side on a wide screen, tops aligned */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <Section title="Dimensions">
          <DimensionsFields defaults={dimDefaults} framed={piece?.framed === true} />
        </Section>

        <Section title="Placement">
          <div className="space-y-4">
            <Field label="Location" id="pf-location">
              <select id="pf-location" name="location_id" defaultValue={v("location_id")} className="field">
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Internal comments" id="pf-comments">
              <textarea id="pf-comments" name="comments" defaultValue={v("comments")} rows={4} className="field" />
            </Field>
          </div>
        </Section>
      </div>

      {showFinancials ? (
        <Section title="Financials">
          <FinancialsFields
            defaults={finDefaults}
            saleHandledByJvb={(piece?.sale_handled_by_jvb as boolean | null) ?? null}
          />
        </Section>
      ) : null}

      {/* Buyer: directly under financials */}
      <Section title="Buyer">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showFinancials ? (
            <div role="group" aria-labelledby="pf-buyer-label" className="flex min-w-0 flex-col gap-1">
              <label id="pf-buyer-label" htmlFor="pf-buyer" className="label">
                Buyer (CRM contact)
              </label>
              <BuyerSelect
                id="pf-buyer"
                initialId={String(financials?.buyer_contact_id ?? "") || null}
                initialName={buyerName ?? null}
              />
            </div>
          ) : null}
          <Field label="Buyer note (freeform)" id="pf-sold-to">
            <input id="pf-sold-to" name="sold_to" defaultValue={v("sold_to")} className="field" />
          </Field>
        </div>
      </Section>

      {/* Provenance & source */}
      <Section title="Provenance & source">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Source / acquired from" id="pf-source">
            <input id="pf-source" name="source_note" defaultValue={v("source_note")} className="field" placeholder="dealer, auction, date…" />
          </Field>
          <Field label="Purchased from" id="pf-purchased-from">
            <input id="pf-purchased-from" name="purchased_from" defaultValue={v("purchased_from")} className="field" />
          </Field>
        </div>
      </Section>

      {/* Published & exhibited: repeatable lists */}
      <Section title="Published & exhibited">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div role="group" aria-labelledby="pf-publications">
            <p id="pf-publications" className="label">Publications</p>
            <RepeatableList
              name="publications"
              initial={list("publications")}
              placeholder="Author, Title (publisher, year), p. 00"
              addLabel="Add publication"
              itemLabel="Publication"
            />
          </div>
          <div role="group" aria-labelledby="pf-exhibitions">
            <p id="pf-exhibitions" className="label">Past exhibitions</p>
            <RepeatableList
              name="exhibitions"
              initial={list("exhibitions")}
              placeholder="Exhibition title, venue, year"
              addLabel="Add exhibition"
              itemLabel="Exhibition"
            />
          </div>
        </div>
      </Section>

      {/* Consignment now lives in its own panel on the edit page, after
          Temporary exports (see ConsignmentPanel). */}
    </div>
  );
}
