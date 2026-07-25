"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AddressFields } from "./address-fields";
import { InterestSelect } from "./interest-select";

export type Purchase = {
  stock_number: string | null;
  title: string | null;
  year: string | null;
  maker_name: string | null;
  buyer_note: string | null;
  sold_date: string | null;
  sold_price_gbp: number | null;
};
export type Consignment = {
  stock_number: string | null;
  title: string | null;
  year: string | null;
  maker_name: string | null;
  share_pct: number | null;
  sale_handled_by_jvb: boolean | null;
  sold_date: string | null;
  co_owner_share_gbp: number | null;
};
export type InterestArea = { id: string; name: string };

type Contact = {
  first_name: string | null;
  last_name: string | null;
  salutation: string | null;
  contact_type: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  instagram_handle: string | null;
  whatsapp_number: string | null;
  line_id: string | null;
  wechat_id: string | null;
  custom_fields: Record<string, unknown> | null;
  marketing_consent: boolean;
  do_not_mail: boolean;
  kyc_status: string;
  notes: string | null;
};

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const input =
  "mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
const box = "rounded-[11px] border border-line bg-cell p-5";

const AML_OPTIONS: [string, string][] = [
  ["not_started", "Not started"],
  ["pending", "In progress"],
  ["verified", "Confirmed"],
  ["refer", "Refer"],
  ["rejected", "Rejected"],
];

type Status = "idle" | "saving" | "saved" | "error";

export function ContactEditor({
  id,
  contact,
  purchases,
  consignments,
  interestOptions,
  showPrices,
}: {
  id: string;
  contact: Contact;
  purchases: Purchase[];
  consignments: Consignment[];
  interestOptions: InterestArea[];
  showPrices: boolean;
}) {
  const selectedInterests = Array.isArray(contact.custom_fields?.interests)
    ? (contact.custom_fields?.interests as unknown[]).map(String)
    : [];
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const dirty = useRef(false);
  const [status, setStatus] = useState<Status>("idle");

  const cf = (k: string) => {
    const v = contact.custom_fields?.[k];
    return typeof v === "string" ? v : "";
  };
  const addr2 = (contact.custom_fields?.address2 as Record<string, string>) ?? {};

  const save = useCallback(async () => {
    if (!formRef.current) return;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    setStatus("saving");
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PATCH",
        body: new FormData(formRef.current),
      });
      if (!res.ok) throw new Error(String(res.status));
      attempt.current = 0;
      dirty.current = false;
      setStatus("saved");
    } catch {
      // Keep the edit and retry with a capped backoff (2s → … → 30s).
      setStatus("error");
      attempt.current += 1;
      const delay = Math.min(2000 * 2 ** (attempt.current - 1), 30000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void save(), delay);
    }
  }, [id]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  }, [save]);

  // Retry as soon as the network returns; flush on unload with keepalive.
  useEffect(() => {
    const onOnline = () => {
      if (dirty.current) void save();
    };
    const onLeave = () => {
      if (!dirty.current || !formRef.current) return;
      try {
        void fetch(`/api/crm/contacts/${id}`, {
          method: "PATCH",
          body: new FormData(formRef.current),
          keepalive: true,
        });
      } catch {
        /* best-effort */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [id, save]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved ✓"
        : status === "error"
          ? "Couldn’t save — your changes are kept and will retry automatically"
          : "Autosave on — changes save automatically";

  return (
    <form
      ref={formRef}
      onInput={scheduleSave}
      onChange={scheduleSave}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void save();
      }}
      className="mt-6 space-y-6"
    >
      {/* autosave status */}
      <p
        className={`sticky top-[64px] z-10 flex items-center gap-2 text-[12px] ${
          status === "error"
            ? "text-oranje"
            : status === "saved"
              ? "text-status-green"
              : "text-ink-soft"
        }`}
        aria-live="polite"
      >
        {statusText}
        {status === "error" ? (
          <button
            type="button"
            onClick={() => {
              attempt.current = 0;
              void save();
            }}
            className="rounded-md border border-oranje/40 px-2 py-0.5 text-[11px] font-medium text-oranje hover:bg-oranje/10"
          >
            Retry now
          </button>
        ) : null}
      </p>

      {/* details */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${box}`}>
        <h2 className="text-[13px] font-semibold text-ink-strong sm:col-span-2">Details</h2>
        <label className={label}>
          First name
          <input name="first_name" defaultValue={contact.first_name ?? ""} className={input} />
        </label>
        <label className={label}>
          Last name
          <input name="last_name" defaultValue={contact.last_name ?? ""} className={input} />
        </label>
        <label className={label}>
          Salutation
          <input
            name="salutation"
            defaultValue={contact.salutation ?? ""}
            placeholder="Dear Professor Tanaka"
            className={input}
          />
        </label>
        <label className={label}>
          Type
          <select name="contact_type" defaultValue={contact.contact_type} className={input}>
            {["collector", "museum", "dealer", "auction_house", "shipper", "restorer", "press"].map(
              (t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ),
            )}
          </select>
        </label>
        <label className={label}>
          Email
          <input name="email" defaultValue={contact.email ?? ""} className={input} />
        </label>
        <label className={label}>
          Phone
          <input name="phone" defaultValue={contact.phone ?? ""} className={input} />
        </label>

        <AddressFields
          legend="Mailing address"
          onChange={scheduleSave}
          names={{
            line1: "address_line1",
            line2: "address_line2",
            city: "city",
            postcode: "postcode",
            country: "country",
            type: "addr1_type",
            company: "addr1_company",
          }}
          defaults={{
            line1: contact.address_line1 ?? "",
            line2: contact.address_line2 ?? "",
            city: contact.city ?? "",
            postcode: contact.postcode ?? "",
            country: contact.country ?? "",
            type: cf("addr1_type") || "primary_home",
            company: cf("addr1_company"),
          }}
        />

        <AddressFields
          legend="Second address"
          onChange={scheduleSave}
          names={{
            line1: "addr2_line1",
            line2: "addr2_line2",
            city: "addr2_city",
            postcode: "addr2_postcode",
            country: "addr2_country",
            type: "addr2_type",
            company: "addr2_company",
          }}
          defaults={{
            line1: addr2.line1 ?? "",
            line2: addr2.line2 ?? "",
            city: addr2.city ?? "",
            postcode: addr2.postcode ?? "",
            country: addr2.country ?? "",
            type: addr2.type ?? "second_home",
            company: addr2.company ?? "",
          }}
        />

        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint sm:col-span-2">
          Social & online
        </p>
        <label className={label}>
          Instagram
          <input name="instagram_handle" defaultValue={contact.instagram_handle ?? ""} className={input} />
        </label>
        <label className={label}>
          LinkedIn (URL)
          <input name="linkedin" defaultValue={cf("linkedin")} className={input} />
        </label>
        <label className={label}>
          X / Twitter
          <input name="x_handle" defaultValue={cf("x_handle")} className={input} />
        </label>
        <label className={label}>
          Website
          <input name="website" defaultValue={cf("website")} className={input} />
        </label>
        <label className={label}>
          WhatsApp
          <input name="whatsapp_number" defaultValue={contact.whatsapp_number ?? ""} className={input} />
        </label>
        <label className={label}>
          WeChat / LINE
          <input name="wechat_id" defaultValue={contact.wechat_id ?? ""} className={input} />
        </label>
        <input type="hidden" name="line_id" defaultValue={contact.line_id ?? ""} />

        <label className="flex items-center gap-2 text-[12.5px] text-ink-body">
          <input type="checkbox" name="marketing_consent" defaultChecked={contact.marketing_consent} />
          Marketing consent
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-body">
          <input type="checkbox" name="do_not_mail" defaultChecked={contact.do_not_mail} />
          Do not mail (post)
        </label>
        <label className={`${label} sm:col-span-2`}>
          Notes
          <textarea name="notes" rows={3} defaultValue={contact.notes ?? ""} className={input} />
        </label>
      </div>

      {/* Profile — past purchases + areas of interest */}
      <div className={box}>
        <h2 className="text-[13px] font-semibold text-ink-strong">Profile</h2>

        <div className="mt-3">
          <p className={label}>Past purchases</p>
          {purchases.length ? (
            <ul className="mt-1.5 overflow-hidden rounded-lg border border-line-soft">
              {purchases.map((p, i) => {
                const objectLine = [p.maker_name, p.title ?? "Untitled", p.year]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-b border-line-soft px-3 py-2 text-[13px] last:border-0"
                  >
                    <div className="min-w-0">
                      <a
                        href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                        className="block min-w-0 hover:text-oranje"
                      >
                        <span className="font-mono text-[12px] text-ink-muted">
                          {p.stock_number ?? "—"}
                        </span>{" "}
                        <span className="text-ink-body">{objectLine}</span>
                      </a>
                      {p.buyer_note ? (
                        <p className="mt-0.5 text-[12px] text-ink-muted">{p.buyer_note}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[12px] text-ink-muted">
                      {p.sold_date
                        ? new Date(p.sold_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                      {showPrices && p.sold_price_gbp != null
                        ? ` · £${Number(p.sold_price_gbp).toLocaleString("en-GB")}`
                        : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-ink-muted">No recorded purchases.</p>
          )}
        </div>

        {consignments.length ? (
          <div className="mt-4">
            <p className={label}>Consignments</p>
            <ul className="mt-1.5 overflow-hidden rounded-lg border border-line-soft">
              {consignments.map((c, i) => {
                const objectLine = [c.maker_name, c.title ?? "Untitled", c.year]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-b border-line-soft px-3 py-2 text-[13px] last:border-0"
                  >
                    <div className="min-w-0">
                      <a
                        href={`/inventory/${encodeURIComponent(c.stock_number ?? "")}`}
                        className="block min-w-0 hover:text-oranje"
                      >
                        <span className="font-mono text-[12px] text-ink-muted">
                          {c.stock_number ?? "—"}
                        </span>{" "}
                        <span className="text-ink-body">{objectLine}</span>
                      </a>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {c.share_pct != null ? `Co-owner / consignee share ${100 - c.share_pct}%` : "Consignee"}
                        {c.sale_handled_by_jvb === false
                          ? " · sold by third party"
                          : c.sale_handled_by_jvb === true
                            ? " · sale handled by J.v.d.B."
                            : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-[12px] text-ink-muted">
                      {c.sold_date
                        ? new Date(c.sold_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "In stock"}
                      {showPrices && c.co_owner_share_gbp != null
                        ? ` · £${Number(c.co_owner_share_gbp).toLocaleString("en-GB")}`
                        : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-4">
          <InterestSelect
            options={interestOptions}
            selected={selectedInterests}
            onChange={scheduleSave}
          />
        </div>
      </div>

      {/* AML — at the bottom */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${box}`}>
        <div className="sm:col-span-3">
          <h2 className="text-[13px] font-semibold text-ink-strong">AML (in-house)</h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Recorded by the gallery with its AML adviser. Confirmed contacts are
            screened against the UK Sanctions List every two weeks.
          </p>
        </div>
        <label className={label}>
          Status
          <select name="kyc_status" defaultValue={contact.kyc_status} className={input}>
            {AML_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Confirmed date
          <input
            type="date"
            name="aml_confirmed_date"
            defaultValue={cf("aml_confirmed_date")}
            className={input}
          />
        </label>
        <label className={label}>
          Note (reference / adviser)
          <input name="aml_notes" defaultValue={cf("aml_notes")} className={input} />
        </label>
      </div>
    </form>
  );
}
