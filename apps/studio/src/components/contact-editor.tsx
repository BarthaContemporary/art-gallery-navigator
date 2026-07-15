"use client";

import { useCallback, useRef, useState } from "react";
import { AddressFields } from "./address-fields";
import { InterestSelect } from "./interest-select";

export type Purchase = {
  stock_number: string | null;
  title: string | null;
  sold_date: string | null;
  sold_price_gbp: number | null;
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
  interestOptions,
  showPrices,
}: {
  id: string;
  contact: Contact;
  purchases: Purchase[];
  interestOptions: InterestArea[];
  showPrices: boolean;
}) {
  const selectedInterests = Array.isArray(contact.custom_fields?.interests)
    ? (contact.custom_fields?.interests as unknown[]).map(String)
    : [];
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const cf = (k: string) => {
    const v = contact.custom_fields?.[k];
    return typeof v === "string" ? v : "";
  };
  const addr2 = (contact.custom_fields?.address2 as Record<string, string>) ?? {};

  const save = useCallback(async () => {
    if (!formRef.current) return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PATCH",
        body: new FormData(formRef.current),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }, [id]);

  const scheduleSave = useCallback(() => {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  }, [save]);

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved ✓"
        : status === "error"
          ? "Couldn’t save — check your connection"
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
        className={`sticky top-[64px] z-10 text-[12px] ${
          status === "error"
            ? "text-oranje"
            : status === "saved"
              ? "text-status-green"
              : "text-ink-soft"
        }`}
        aria-live="polite"
      >
        {statusText}
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
              {purchases.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-1.5 text-[13px] last:border-0"
                >
                  <a
                    href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                    className="min-w-0 truncate hover:text-oranje"
                  >
                    <span className="font-mono text-[12px] text-ink-muted">
                      {p.stock_number ?? "—"}
                    </span>{" "}
                    <span className="text-ink-body">{p.title ?? "Untitled"}</span>
                  </a>
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
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-ink-muted">No recorded purchases.</p>
          )}
        </div>

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
