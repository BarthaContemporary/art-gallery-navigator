/*
 * The fixture database: tables loaded from fixtures/data/*.json, views
 * computed from them on every read (so a write shows up everywhere at once,
 * as it would in Postgres), and a coarse imitation of the RLS the studio
 * depends on (staff cannot see financials; flags are per user).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PRIMARY_KEYS, SERIAL_ID_TABLES, STAFF_HIDDEN, OWN_ROWS } from "./schema.mjs";
// The studio's own VAT and settlement rules (pure, import-free), which mirror
// the stock-book views: the sixth in whole pence half up, the share split in
// pence. Node strips the types, as it does for `pnpm test:unit`.
import { consignmentSplit, saleVat } from "../../../apps/studio/src/lib/consignment.ts";

const DAY = 86_400_000;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Move every date in the fixtures by `days`, so "next week", "overdue" and
 * "expired" stay true whenever the preview is started. Only full ISO dates
 * and timestamps move; stock numbers, years and life dates do not look like
 * either.
 */
function shiftDates(value, days) {
  if (!days) return value;
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = shiftDates(v, days);
    return out;
  }
  if (typeof value === "string") {
    if (ISO_DATE_ONLY.test(value)) {
      return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
    }
    if (ISO_DATETIME.test(value)) {
      return new Date(Date.parse(value) + days * DAY).toISOString();
    }
  }
  return value;
}

const VIEWS = new Set([
  "piece_ref",
  "vw_pieces_list",
  "vw_pieces_all",
  "vw_stock_book",
  "vw_stock_book_standard",
  "vw_stock_book_zero_rated",
  "vw_stock_book_outside_scope",
  "vw_stock_book_all",
  "vw_contacts_for_review",
]);

const FIN_ROLES = new Set(["admin", "accountant", "service"]);

export class Db {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.load();
  }

  load() {
    this.tables = new Map();
    const meta = JSON.parse(fs.readFileSync(path.join(this.dataDir, "_meta.json"), "utf8"));
    const anchor = Date.parse(`${meta.anchor_date}T00:00:00Z`);
    const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const envShift = process.env.PREVIEW_DATE_SHIFT;
    this.shiftDays = envShift != null ? Number(envShift) : Math.round((today - anchor) / DAY);
    this.meta = meta;
    for (const file of fs.readdirSync(this.dataDir)) {
      if (!file.endsWith(".json") || file.startsWith("_")) continue;
      const name = file.replace(/\.json$/, "");
      const rows = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), "utf8"));
      this.tables.set(name, shiftDates(rows, this.shiftDays));
    }
    // Generated columns always hold their expression in Postgres, whatever a
    // fixture file says.
    for (const f of this.tables.get("piece_financials") ?? []) computeFinancials(f);
    this.serial = new Map();
  }

  has(name) {
    return this.tables.has(name) || VIEWS.has(name);
  }

  table(name) {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name);
  }

  // ------------------------------------------------------------------ reads

  /** The rows of a table or view that the caller may see. */
  rows(name, ctx) {
    const key = `rows:${name}`;
    if (ctx.cache.has(key)) return ctx.cache.get(key);
    let rows;
    if (VIEWS.has(name)) rows = this.view(name, ctx);
    else rows = this.tables.get(name) ?? null;
    if (rows === null) {
      ctx.cache.set(key, null);
      return null;
    }
    rows = this.applyRls(name, rows, ctx);
    ctx.cache.set(key, rows);
    return rows;
  }

  applyRls(name, rows, ctx) {
    if (ctx.role === "service") return rows;
    if (ctx.role === "anon") return [];
    if (ctx.role === "staff" && STAFF_HIDDEN.has(name)) return [];
    if (OWN_ROWS[name]) return rows.filter((r) => r[OWN_ROWS[name]] === ctx.userId);
    if (ctx.role === "staff" && (name === "user_roles" || name === "profiles")) {
      const col = name === "profiles" ? "id" : "user_id";
      return rows.filter((r) => r[col] === ctx.userId);
    }
    if (ctx.role === "staff" && name === "piece_documents") {
      // Invoices sit behind the accounts boundary (migration 0052).
      return rows.filter((r) => r.doc_type !== "purchase_invoice" && r.doc_type !== "sale_invoice");
    }
    return rows;
  }

  indexById(name, ctx) {
    const key = `id:${name}`;
    if (!ctx.cache.has(key)) {
      const m = new Map();
      for (const r of this.rows(name, ctx) ?? []) m.set(r.id, r);
      ctx.cache.set(key, m);
    }
    return ctx.cache.get(key);
  }

  rowsByColumn(name, col, ctx) {
    const key = `by:${name}:${col}`;
    if (!ctx.cache.has(key)) {
      const m = new Map();
      for (const r of this.rows(name, ctx) ?? []) {
        const v = r[col];
        if (v == null) continue;
        if (!m.has(v)) m.set(v, []);
        m.get(v).push(r);
      }
      ctx.cache.set(key, m);
    }
    return ctx.cache.get(key);
  }

  // ------------------------------------------------------------------ views

  allPieces() {
    return [...this.table("pieces"), ...this.table("external_pieces")];
  }

  finByPiece(ctx) {
    const m = new Map();
    if (!FIN_ROLES.has(ctx.role)) return m;
    for (const f of this.table("piece_financials")) m.set(f.piece_id, f);
    return m;
  }

  view(name, ctx) {
    const byId = (t) => new Map(this.table(t).map((r) => [r.id, r]));
    switch (name) {
      case "piece_ref":
        return this.allPieces().map((p) => ({ id: p.id, ledger: p.ledger, created_at: p.created_at }));

      case "vw_pieces_all": {
        const makers = byId("makers");
        const cats = byId("categories");
        const locs = byId("locations");
        return this.allPieces().map((p) => ({
          ...p,
          maker_name: makers.get(p.maker_id)?.display_name ?? null,
          maker_life_dates: makers.get(p.maker_id)?.life_dates ?? null,
          category_name: cats.get(p.category_id)?.name ?? null,
          location_code: locs.get(p.location_id)?.code ?? null,
        }));
      }

      case "vw_pieces_list": {
        const makers = byId("makers");
        const cats = byId("categories");
        const locs = byId("locations");
        const fin = this.finByPiece(ctx);
        const cleared = FIN_ROLES.has(ctx.role)
          ? new Set(this.table("purchase_gbp_cleared").map((g) => g.piece_id))
          : new Set();
        const images = new Map();
        for (const im of this.table("piece_images")) {
          const cur = images.get(im.piece_id);
          const rank = (x) => [x.role === "front" ? 0 : 1, x.sort_order ?? 0, x.created_at ?? ""];
          if (!cur) images.set(im.piece_id, im);
          else {
            const [a1, a2, a3] = rank(im);
            const [b1, b2, b3] = rank(cur);
            if (a1 < b1 || (a1 === b1 && (a2 < b2 || (a2 === b2 && a3 < b3)))) images.set(im.piece_id, im);
          }
        }
        const onTemp = new Set(
          this.table("piece_shipments")
            .filter((s) => s.kind === "temporary_export" && s.returned_at == null && s.closed_reason == null)
            .map((s) => s.piece_id),
        );
        const now = Date.now();
        return this.allPieces()
          .filter((p) => p.deleted_at == null)
          .map((p) => {
            const f = fin.get(p.id);
            const purchase = f?.purchase_date ? Date.parse(f.purchase_date) : null;
            const until = f?.sold_date ? Date.parse(f.sold_date) : now;
            return {
              id: p.id,
              stock_number: p.stock_number,
              legacy_stock_number: p.legacy_stock_number,
              legacy_stock_number_conflict: p.legacy_stock_number_conflict ?? false,
              title: p.title,
              maker_id: p.maker_id,
              maker_name: makers.get(p.maker_id)?.display_name ?? null,
              category_id: p.category_id,
              category_name: cats.get(p.category_id)?.name ?? null,
              medium: p.medium,
              period: p.period,
              origin_region: p.origin_region,
              status: p.status,
              location_id: p.location_id,
              location_code: locs.get(p.location_id)?.code ?? null,
              web_visible: p.web_visible,
              tags: p.tags,
              primary_image_id: images.get(p.id)?.id ?? null,
              marked_price_gbp: f?.marked_price_gbp ?? null,
              days_in_stock: purchase != null ? Math.floor((until - purchase) / DAY) : null,
              created_at: p.created_at,
              updated_at: p.updated_at,
              on_temp_export: onTemp.has(p.id),
              needs_completion: p.needs_completion,
              ledger: p.ledger,
              year: p.year,
              framed: p.framed ?? false,
              missing_purchase_gbp:
                p.ledger === "jvb" && p.status === "sold" && f != null && f.purchase_cost_gbp == null && cleared.has(p.id),
            };
          });
      }

      case "vw_stock_book":
      case "vw_stock_book_standard":
      case "vw_stock_book_zero_rated":
      case "vw_stock_book_outside_scope":
      case "vw_stock_book_all":
        return this.stockBook(name);

      case "vw_contacts_for_review": {
        const policy = this.table("retention_policies").find((r) => r.key === "inactive_contacts");
        const days = policy?.days ?? 1095;
        const cutoff = Date.now() - days * DAY;
        const holds = (id) => this.legalHolds(id).length > 0;
        return this.table("crm_contacts")
          .filter((c) => c.erased_at == null && !c.marketing_consent && Date.parse(c.updated_at) < cutoff && !holds(c.id))
          .map((c) => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email,
            updated_at: c.updated_at,
            created_at: c.created_at,
          }));
      }
      default:
        return [];
    }
  }

  /**
   * The five stock-book views as migration 0098 defines them: the same
   * columns in the same order (only vw_stock_book_all has vat_treatment and
   * total_cost_gbp, only vw_stock_book has margin_pct, and select("*") reads
   * just those), VAT due and J.v.d.B.'s share by the studio's rules in
   * lib/consignment.ts, and no share before there is a sale £.
   */
  stockBook(name) {
    const scheme = STOCK_BOOK_SCHEME[name];
    const columns = STOCK_BOOK_COLUMNS[name];
    const contacts = new Map(this.table("crm_contacts").map((c) => [c.id, c]));
    const shipments = new Map(this.table("shipments").map((s) => [s.id, s]));
    const links = this.table("piece_shipments");
    const fin = new Map(this.table("piece_financials").map((f) => [f.piece_id, f]));
    const out = [];
    for (const p of this.table("pieces")) {
      const f = fin.get(p.id);
      if (!f) continue;
      if (scheme && f.vat_treatment !== scheme) continue;
      const seller = contacts.get(f.seller_contact_id);
      const shipment = (kind) => {
        const found = links
          .filter((x) => x.piece_id === p.id && x.kind === kind && (kind !== "temporary_export" || (x.returned_at == null && x.closed_reason == null)))
          .map((x) => shipments.get(x.shipment_id))
          .filter(Boolean);
        // The temporary export is the latest one still out (ORDER BY shipment_date DESC NULLS LAST).
        if (kind === "temporary_export") found.sort((a, b) => (b.shipment_date ?? "").localeCompare(a.shipment_date ?? ""));
        return found[0] ?? null;
      };
      const imp = shipment("import");
      const exp = shipment("export");
      const tmp = shipment("temporary_export");
      const money = stockBookMoney(p, f);
      const full = {
        piece_id: p.id,
        stock_number: p.stock_number,
        vat_treatment: f.vat_treatment,
        purchase_date: f.purchase_date,
        purchase_invoice_document_id: f.purchase_invoice_document_id,
        // TRIM(concat_ws(' ', first_name, last_name)), '' with no seller.
        seller_name: [seller?.first_name, seller?.last_name].filter((s) => s != null).join(" ").trim(),
        // title || COALESCE(' — ' || medium, ''): no title, no description.
        description: p.title == null ? null : p.title + (p.medium != null ? ` — ${p.medium}` : ""),
        purchase_cost_gbp: f.purchase_cost_gbp,
        sold_date: f.sold_date,
        sale_invoice_document_id: f.sale_invoice_document_id,
        sold_price_gbp: f.sold_price_gbp,
        margin_gbp: f.margin_gbp,
        vat_due_gbp: money.vatDue,
        margin_pct: money.marginPct,
        import_date: imp?.shipment_date ?? null,
        import_reference: imp?.reference ?? null,
        export_date: exp?.shipment_date ?? null,
        export_reference: exp?.reference ?? null,
        temp_export_date: tmp?.shipment_date ?? null,
        temp_export_reference: tmp?.reference ?? null,
        consignment_co_owner: p.shares_note,
        consignment_notes: p.consignment_details,
        consignment_share_pct: p.consignment_share_pct,
        sale_handled_by_jvb: p.sale_handled_by_jvb,
        jvb_share_gbp: money.jvbShare,
        import_type: f.import_type,
        import_vat_gbp: f.import_vat_gbp,
        reclaimable_import_vat_gbp: reclaimableImportVat(name, f),
        total_cost_gbp: f.total_cost_gbp,
        export_destination: exp?.destination_country ?? null,
        temp_export_destination: tmp?.destination_country ?? null,
      };
      out.push(Object.fromEntries(columns.map((c) => [c, full[c] ?? null])));
    }
    return out;
  }

  /** contact_legal_holds() from migration 0078. */
  legalHolds(contactId) {
    const holds = [];
    if (this.table("piece_financials").some((f) => f.buyer_contact_id === contactId || f.seller_contact_id === contactId))
      holds.push("Purchase or sale record (tax and accounting records, six years)");
    if (this.table("consignments").some((k) => k.counterparty_contact_id === contactId))
      holds.push("Consignment agreement (accounting records, six years)");
    if (this.table("orders").some((o) => o.contact_id === contactId))
      holds.push("Order record (accounting records, six years)");
    if (this.allPieces().some((p) => p.consignee_contact_id === contactId))
      holds.push("Named as consignee on stock (accounting records)");
    if (this.table("kyc_profiles").some((k) => k.contact_id === contactId))
      holds.push("Anti-money-laundering due diligence (MLR 2017, five years after the relationship ends)");
    return holds;
  }

  // ----------------------------------------------------------------- writes

  pk(name) {
    return PRIMARY_KEYS[name] ?? ["id"];
  }

  nextSerial(name) {
    if (!this.serial.has(name)) {
      const max = this.table(name).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      this.serial.set(name, max);
    }
    const n = this.serial.get(name) + 1;
    this.serial.set(name, n);
    return n;
  }

  /** Column defaults and the few triggers the studio relies on. */
  withDefaults(name, input, ctx) {
    const now = new Date().toISOString();
    const template = this.table(name)[0];
    const row = {};
    if (template) for (const k of Object.keys(template)) row[k] = null;
    Object.assign(row, input);
    const pk = this.pk(name);
    if (pk.length === 1 && pk[0] === "id" && row.id == null) {
      row.id = SERIAL_ID_TABLES.has(name) ? this.nextSerial(name) : crypto.randomUUID();
    }
    if ((template ? "created_at" in template : true) && row.created_at == null) row.created_at = now;
    if (template && "updated_at" in template && row.updated_at == null) row.updated_at = now;
    if (name === "pieces" || name === "external_pieces") {
      const ledger = name === "pieces" ? "jvb" : "external";
      row.ledger = ledger;
      row.status ??= "in_stock";
      row.web_visible ??= false;
      row.needs_completion ??= true;
      row.presentation ??= "auto";
      row.framed ??= false;
      row.tags ??= [];
      row.created_by ??= ctx.userId ?? null;
      if (!row.stock_number) row.stock_number = this.nextStockNumber(ledger);
    }
    if (name === "piece_financials") computeFinancials(row);
    if (name === "piece_list_items") row.excluded ??= false;
    if (name === "crm_contacts") {
      row.tags ??= [];
      row.marketing_consent ??= false;
      row.do_not_mail ??= false;
    }
    return row;
  }

  nextStockNumber(ledger) {
    const year = new Date().getUTCFullYear();
    const prefix = ledger === "external" ? `X-${year}-` : `${year}-`;
    const used = this.allPieces()
      .map((p) => p.stock_number)
      .filter((s) => s?.startsWith(prefix))
      .map((s) => Number(s.slice(prefix.length)) || 0);
    const next = (used.length ? Math.max(...used) : 0) + 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  insert(name, inputs, { onConflict, resolution }, ctx) {
    const rows = this.table(name);
    const keys = onConflict ? onConflict.split(",").map((s) => s.trim()) : this.pk(name);
    const written = [];
    for (const input of inputs) {
      const existing =
        resolution && keys.every((k) => input[k] !== undefined)
          ? rows.find((r) => keys.every((k) => String(r[k]) === String(input[k])))
          : null;
      if (existing) {
        if (resolution === "ignore") continue;
        Object.assign(existing, input);
        if ("updated_at" in existing && !("updated_at" in input)) existing.updated_at = new Date().toISOString();
        if (name === "piece_financials") computeFinancials(existing);
        written.push(existing);
        continue;
      }
      const row = this.withDefaults(name, input, ctx);
      rows.push(row);
      written.push(row);
    }
    return written;
  }

  update(name, match, patch) {
    const written = [];
    for (const r of this.table(name)) {
      if (!match(r)) continue;
      Object.assign(r, patch);
      if ("updated_at" in r && !("updated_at" in patch)) r.updated_at = new Date().toISOString();
      if (name === "piece_financials") computeFinancials(r);
      written.push(r);
    }
    return written;
  }

  delete(name, match) {
    const rows = this.table(name);
    const gone = rows.filter((r) => match(r));
    this.tables.set(name, rows.filter((r) => !match(r)));
    return gone;
  }
}

// ------------------------------------------------------------- stock book

const STOCK_BOOK_SCHEME = {
  vw_stock_book: "margin_scheme",
  vw_stock_book_standard: "standard",
  vw_stock_book_zero_rated: "zero_rated",
  vw_stock_book_outside_scope: "outside_scope",
  vw_stock_book_all: null,
};

/** Each view's columns, in order, as Postgres lists them after migration 0098. */
const SCHEME_COLUMNS = [
  "piece_id", "stock_number", "purchase_date", "purchase_invoice_document_id", "seller_name", "description",
  "purchase_cost_gbp", "sold_date", "sale_invoice_document_id", "sold_price_gbp", "vat_due_gbp", "margin_gbp",
  "import_date", "import_reference", "export_date", "export_reference", "temp_export_date", "temp_export_reference",
  "consignment_co_owner", "consignment_notes", "consignment_share_pct", "sale_handled_by_jvb", "jvb_share_gbp",
  "import_type", "import_vat_gbp", "reclaimable_import_vat_gbp", "export_destination", "temp_export_destination",
];
const MARGIN_COLUMNS = (() => {
  // vw_stock_book: margin before VAT due, then margin_pct.
  const c = SCHEME_COLUMNS.filter((x) => x !== "vat_due_gbp");
  c.splice(c.indexOf("margin_gbp") + 1, 0, "vat_due_gbp", "margin_pct");
  return c;
})();
const ALL_COLUMNS = (() => {
  const c = [...SCHEME_COLUMNS];
  c.splice(2, 0, "vat_treatment");
  c.splice(c.indexOf("reclaimable_import_vat_gbp") + 1, 0, "total_cost_gbp");
  return c;
})();
export const STOCK_BOOK_COLUMNS = {
  vw_stock_book: MARGIN_COLUMNS,
  vw_stock_book_standard: SCHEME_COLUMNS,
  vw_stock_book_zero_rated: SCHEME_COLUMNS,
  vw_stock_book_outside_scope: SCHEME_COLUMNS,
  vw_stock_book_all: ALL_COLUMNS,
};

const num = (v) => (v == null || v === "" ? null : Number(v));

/** Import VAT paid, whatever the treatment (lib/consignment counts it as a cost on the margin scheme only). */
const importVatPaid = (f) => (f.import_type === "import_vat_paid" ? num(f.import_vat_gbp) ?? 0 : 0);

/**
 * VAT due, J.v.d.B.'s share and margin % of one stock-book row, as the views
 * work them out (migration 0098) and the studio does (lib/consignment.ts):
 *  - VAT: none when a third party handled the sale; margin scheme a sixth of
 *    (sale − total cost − import VAT paid), at least 0; standard a sixth of the
 *    sale; zero-rated and outside scope none. Each sixth to the penny, half
 *    up. No sale reads as a sale of 0, so VAT due is 0, not null.
 *  - Share: null without a share % or before there is a sale £; otherwise the
 *    share % of (sale − VAT − restoration and other costs − import VAT paid on
 *    the margin scheme), in whole pence, plus those costs back.
 */
export function stockBookMoney(p, f) {
  const sold = num(f.sold_price_gbp);
  const purchase = num(f.purchase_cost_gbp) ?? 0;
  const total = num(f.total_cost_gbp) ?? 0;
  const ivc = f.vat_treatment === "margin_scheme" ? importVatPaid(f) : 0;
  const vatDue = saleVat({
    amount: sold ?? 0,
    vatTreatment: f.vat_treatment,
    saleHandledByJvb: p.sale_handled_by_jvb ?? null,
    costBaseGbp: total + ivc,
  });
  const pct = num(p.consignment_share_pct);
  const jvbShare =
    pct == null || sold == null
      ? null
      : consignmentSplit({
          amount: sold,
          vatTreatment: f.vat_treatment,
          saleHandledByJvb: p.sale_handled_by_jvb ?? null,
          purchaseCostGbp: purchase,
          // greatest(total_cost_gbp - purchase_cost_gbp, 0): restoration and other costs.
          extraCostsGbp: Math.max(total - purchase, 0),
          importVatPaidGbp: importVatPaid(f),
          sharePct: pct,
        }).jvbReceived;
  // round(margin / total * 100, 1), half away from zero, where there is a cost and a sale.
  const margin = num(f.margin_gbp);
  const marginPct = total !== 0 && sold != null && margin != null ? roundHalfAway((margin / total) * 100, 1) : null;
  return { vatDue, jvbShare, marginPct };
}

/** reclaimable_import_vat_gbp: NULL in the margin-scheme view, 0 for the margin scheme in the combined view. */
function reclaimableImportVat(view, f) {
  if (view === "vw_stock_book") return null;
  if (view === "vw_stock_book_all" && f.vat_treatment === "margin_scheme") return 0;
  return importVatPaid(f);
}

function roundHalfAway(n, places) {
  const k = 10 ** places;
  return (Math.sign(n) * Math.round(Math.abs(n) * k + 1e-9)) / k;
}

/**
 * piece_financials' generated columns (migration 0005): total cost is the sum
 * of the three costs, each missing one counted as 0, so it is never null;
 * margin is the sale less those costs, null only without a sale £. Summed in
 * pence, as numeric adds. net_profit_gbp is not generated: it holds
 * FileMaker's figure, which the database never recomputes, so it is left as
 * the fixtures have it.
 */
export function computeFinancials(f) {
  const pence = (v) => Math.round((num(v) ?? 0) * 100);
  const costs = pence(f.purchase_cost_gbp) + pence(f.restoration_cost_gbp) + pence(f.other_costs_gbp);
  f.total_cost_gbp = costs / 100;
  const sold = num(f.sold_price_gbp);
  f.margin_gbp = sold == null ? null : (Math.round(sold * 100) - costs) / 100;
  return f;
}
