/*
 * The database functions the studio calls through /rest/v1/rpc/<fn>, as
 * plain JavaScript over the fixtures. Set-returning functions return rows
 * plus the table they are shaped like, so the caller can still apply a
 * select, filters, order and limit to them, as PostgREST does.
 */

const norm = (s) => String(s ?? "").toLowerCase();

function contains(hay, q) {
  return norm(hay).includes(norm(q));
}

export const RPC = {
  /** Migration 0077: ranked text search across both registers. */
  pieces_search(db, args) {
    const q = String(args.q ?? "").trim();
    const makers = new Map(db.table("makers").map((m) => [m.id, m]));
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = db
      .allPieces()
      .filter((p) => p.deleted_at == null)
      .map((p) => {
        const m = makers.get(p.maker_id);
        const fields = [p.stock_number, p.legacy_stock_number, p.title, p.description, p.medium, p.period, m?.display_name, m?.native_name, m?.romanized_name, ...(m?.alt_names ?? []), ...(p.tags ?? [])];
        const hay = fields.filter(Boolean).join(" ").toLowerCase();
        const hit = words.length > 0 && words.every((w) => hay.includes(w));
        // Rough relevance: stock number, then title, then anything else.
        const score = contains(p.stock_number, q) ? 3 : contains(p.title, q) ? 2 : contains(m?.display_name, q) ? 1.5 : 1;
        return hit ? { row: p, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || String(b.row.stock_number).localeCompare(String(a.row.stock_number)));
    return { rows: rows.map((r) => r.row), table: "pieces" };
  },

  /** Migration 0022: fuzzy contact search (here: substring on the usual fields). */
  crm_contacts_search(db, args) {
    const q = String(args.q ?? "").trim();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = db.table("crm_contacts").filter((c) => {
      if (words.length === 0) return true;
      const hay = [c.first_name, c.last_name, c.email, c.city, c.country, c.phone].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return { rows, table: "crm_contacts" };
  },

  contact_legal_holds(db, args) {
    return { value: db.legalHolds(args._contact) };
  },

  /** Migration 0079. */
  contacts_with_weak_marketing_basis(db) {
    const fin = db.table("piece_financials");
    const rows = db
      .table("crm_contacts")
      .filter(
        (c) =>
          c.marketing_consent &&
          c.email &&
          c.unsubscribed_at == null &&
          c.erased_at == null &&
          (c.consent_source == null || /^pre-existing/i.test(c.consent_source) || /import/i.test(c.consent_source)) &&
          c.consent_evidence == null &&
          !fin.some((f) => f.buyer_contact_id === c.id || f.seller_contact_id === c.id) &&
          !db.table("consignments").some((k) => k.counterparty_contact_id === c.id),
      )
      .sort((a, b) => norm(a.last_name).localeCompare(norm(b.last_name)) || norm(a.first_name).localeCompare(norm(b.first_name)))
      .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, consent_source: c.consent_source }));
    return { rows, table: "crm_contacts" };
  },

  /** Nothing is old enough to go in a fresh preview; report zeros. */
  apply_retention() {
    return {
      value: {
        email_events: 0,
        offer_views: 0,
        campaign_recipients: 0,
        enquiries: 0,
        appointments: 0,
        unconfirmed_signups: 0,
        activity_log: 0,
        ran_at: new Date().toISOString(),
      },
    };
  },

  erase_contact(db, args) {
    const id = args._contact;
    const c = db.table("crm_contacts").find((x) => x.id === id);
    if (!c) return { value: { mode: "missing" } };
    const holds = db.legalHolds(id);
    if (holds.length === 0) {
      db.delete("crm_contacts", (x) => x.id === id);
      return { value: { mode: "deleted", holds: [] } };
    }
    Object.assign(c, {
      first_name: "Erased",
      last_name: "contact",
      email: null,
      phone: null,
      address_line1: null,
      address_line2: null,
      city: null,
      postcode: null,
      notes: null,
      marketing_consent: false,
      erased_at: new Date().toISOString(),
    });
    return { value: { mode: "anonymised", holds } };
  },

  /** Migration 0058: move a work between registers, renumbering it. */
  move_piece_ledger(db, args, ctx) {
    const from = db.table("pieces").find((p) => p.id === args._piece_id) ? "pieces" : "external_pieces";
    const to = args._to === "external" ? "external_pieces" : "pieces";
    if (from === to) return { value: null };
    const row = db.table(from).find((p) => p.id === args._piece_id);
    if (!row) return { error: { code: "P0002", message: "Work not found" } };
    const oldNumber = row.stock_number;
    db.delete(from, (p) => p.id === row.id);
    const moved = { ...row, ledger: args._to, stock_number: db.nextStockNumber(args._to) };
    db.table(to).push(moved);
    db.table("piece_ledger_moves").push({
      id: crypto.randomUUID(),
      piece_id: row.id,
      from_ledger: row.ledger,
      to_ledger: args._to,
      from_stock_number: oldNumber,
      to_stock_number: moved.stock_number,
      note: args._note ?? null,
      moved_by: ctx.userId ?? null,
      moved_at: new Date().toISOString(),
    });
    return { value: moved.stock_number };
  },

  purge_deleted_pieces() {
    return { value: 0 };
  },
  purge_blank_draft_pieces() {
    return { value: 0 };
  },
  purge_empty_shipments() {
    return { value: 0 };
  },

  /** The website sync is not configured in the preview; nothing to claim. */
  claim_sync_outbox() {
    return { rows: [], table: "sync_outbox" };
  },
};
