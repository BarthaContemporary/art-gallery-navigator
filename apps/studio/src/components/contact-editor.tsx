"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AddressFields } from "./address-fields";
import { InterestSelect } from "./interest-select";
import { Field } from "./ui/field";
import { Section } from "./ui/section";
import { SaveStatus } from "./ui/save-status";
import { useRefreshAfterSave } from "./editor-save";
import { CONTACT_TYPE_LABELS, KYC_STATUS_LABELS, labelOf } from "@/lib/labels";
import { formatDate, gbpDisplay } from "@/lib/format";
import { NO_ANSWER, planFlush, readSaveOutcome, type SaveOutcome } from "@/lib/save-outcome";

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
  /** Set once the contact has been erased (anonymised under a hold). */
  erased_at?: string | null;
};

/** Ids for the native fields: one editor per page, so fixed ids are unique. */
const fid = (name: string) => `contact-${name}`;

type Status = "idle" | "saving" | "saved" | "error";

/**
 * The form's posted contents as one comparable string, as AutosaveForm's
 * serialise. The `_was` bookkeeping fields are left out: they change after a
 * save without the user editing anything.
 */
function serialise(form: HTMLFormElement): string {
  const entries: [string, string][] = [];
  new FormData(form).forEach((value, key) => {
    if (key.endsWith("_was")) return;
    entries.push([key, typeof value === "string" ? value : `file:${value.name}:${value.size}`]);
  });
  return JSON.stringify(entries);
}

const interestsOf = (contact: Contact): string[] =>
  Array.isArray(contact.custom_fields?.interests) ? (contact.custom_fields?.interests as unknown[]).map(String) : [];

type Known = { consent: boolean; doNotMail: boolean; kyc: string; interests: string[] };

/** The `_was` values after a save: read back from the entries that were sent. */
function knownFrom(sent: string, prev: Known): Known {
  const entries = new Map(JSON.parse(sent) as [string, string][]);
  let interests = prev.interests;
  try {
    const parsed = JSON.parse(entries.get("interests") ?? "[]");
    if (Array.isArray(parsed)) interests = parsed.map(String);
  } catch {
    /* keep the last known list */
  }
  return {
    consent: entries.get("marketing_consent") === "on",
    doNotMail: entries.get("do_not_mail") === "on",
    kyc: entries.get("kyc_status") ?? prev.kyc,
    interests,
  };
}

type Props = {
  id: string;
  contact: Contact;
  purchases: Purchase[];
  consignments: Consignment[];
  interestOptions: InterestArea[];
  showPrices: boolean;
};

/**
 * The contact's autosaving editor. It PATCHes `new FormData(form)` to
 * /api/crm/contacts/[id], as AutosaveForm does for works, and keeps its own
 * copy of that loop rather than moving onto AutosaveForm: the address and
 * interest fields change values without a DOM event and call scheduleSave
 * directly, which AutosaveForm has no way to receive, and AutosaveForm's
 * leave-page confirm would be a new dialog here. The status line is the
 * shared SaveStatus, so both read the same.
 *
 * The loop has AutosaveForm's protections: saves run one after another (an
 * older PATCH never lands after a newer one), a form that equals what the
 * server holds is not sent, an edit made while a save is on the wire stays
 * unsaved until its own save, and an edit still waiting for the debounce or
 * a retry is sent when the editor is left. A refusal for good (404, 410:
 * lib/save-outcome.ts) is shown with its reason and not retried.
 *
 * Beside the consent, do-not-mail, AML status and interests it posts what
 * it last knew the server to hold (`<field>_was`), so the route writes only
 * what was changed here and a tab left open cannot put back flags the
 * website has changed since (lib/contact-save.ts).
 *
 * Keyed on erased_at: erasing the contact re-renders this page in place,
 * and the editor must start again from the anonymised row rather than keep
 * the old values in its fields.
 */
export function ContactEditor(props: Props) {
  return <ContactEditorForm key={props.contact.erased_at ?? "live"} {...props} />;
}

function ContactEditorForm({ id, contact, purchases, consignments, interestOptions, showPrices }: Props) {
  const selectedInterests = interestsOf(contact);
  // The form element, kept after React detaches it on unmount so the leave
  // send can still read an edit that never reached the server.
  const formRef = useRef<HTMLFormElement | null>(null);
  const setFormRef = useCallback((el: HTMLFormElement | null) => {
    if (el) formRef.current = el;
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const dirty = useRef(false);
  // What the server holds: the form as first rendered, then as last saved.
  const lastSaved = useRef<string | null>(null);
  // The save on the wire, if any: saves run one after another.
  const inFlight = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  // The last save was refused for good; nothing resends it until an edit.
  const refused = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  // The last failure was a 401: the session lapsed and only signing in helps.
  const [signedOut, setSignedOut] = useState(false);
  // A refusal for good: the server's reason, for the line.
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const { markSaved, refreshAfterLeave } = useRefreshAfterSave();

  // What this editor last knew the server to hold for the fields other
  // writers also change, posted as `<field>_was`. Hidden inputs with no
  // React value, written here only (React leaves their value alone), and
  // found through the form, which outlives an unmount.
  const known = useRef<Known>({
    consent: contact.marketing_consent,
    doNotMail: contact.do_not_mail,
    kyc: contact.kyc_status,
    interests: selectedInterests,
  });
  const writeKnown = useCallback(() => {
    const k = known.current;
    const put = (name: string, value: string) => {
      const el = formRef.current?.elements.namedItem(name);
      if (el instanceof HTMLInputElement) el.value = value;
    };
    put("marketing_consent_was", k.consent ? "on" : "");
    put("do_not_mail_was", k.doNotMail ? "on" : "");
    put("kyc_status_was", k.kyc);
    put("interests_was", JSON.stringify(k.interests));
  }, []);
  useLayoutEffect(() => writeKnown(), [writeKnown]);

  const cf = (k: string) => {
    const v = contact.custom_fields?.[k];
    return typeof v === "string" ? v : "";
  };
  const addr2 = (contact.custom_fields?.address2 as Record<string, string>) ?? {};

  useEffect(() => {
    mounted.current = true;
    if (formRef.current && lastSaved.current === null) lastSaved.current = serialise(formRef.current);
    return () => {
      mounted.current = false;
    };
  }, []);

  // A last-ditch send that must outlive the page (tab hidden or closed, or
  // the editor left while a save was failing): keepalive, best-effort.
  // `afterInFlight`: the page lives on (left inside the app), so wait for a
  // save on the wire, which could otherwise land after this newer one.
  const sendOnLeave = useCallback(
    (afterInFlight?: unknown): Promise<unknown> | null => {
      if (!dirty.current || refused.current || !formRef.current) return null;
      // The form is read when the request goes: after a save on the wire,
      // that is the newest form with its `_was` values brought up to date.
      const send = (): Promise<unknown> => {
        // An edit undone before it was sent leaves nothing to send.
        if (!formRef.current || serialise(formRef.current) === lastSaved.current) return Promise.resolve();
        try {
          return fetch(`/api/crm/contacts/${id}`, {
            method: "PATCH",
            body: new FormData(formRef.current),
            keepalive: true,
          }).then(
            (res) => {
              if (res.ok) markSaved();
            },
            () => undefined,
          );
        } catch {
          /* best-effort */
          return Promise.resolve();
        }
      };
      if (afterInFlight === true && inFlight.current) return inFlight.current.then(send, send);
      return send();
    },
    [id, markSaved],
  );

  /** Save the form, queued behind any save on the wire; true once the server holds it. */
  const save = useCallback((): Promise<boolean> => {
    const attemptSave = async (): Promise<boolean> => {
      if (!formRef.current) return false;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      // Read when the attempt runs, not when it was queued: the latest form.
      const sent = serialise(formRef.current);
      if (sent === lastSaved.current) {
        attempt.current = 0;
        dirty.current = false;
        refused.current = false;
        setSignedOut(false);
        setRefusal(undefined);
        setStatus("saved");
        return true;
      }
      // Queued behind the save the server has just refused, with no edit
      // since: it would send the same form for the same answer.
      if (refused.current) return false;
      setStatus("saving");
      let outcome: SaveOutcome;
      try {
        const res = await fetch(`/api/crm/contacts/${id}`, {
          method: "PATCH",
          body: new FormData(formRef.current),
        });
        outcome = await readSaveOutcome(res);
      } catch {
        outcome = NO_ANSWER;
      }
      if (outcome.ok) {
        attempt.current = 0;
        lastSaved.current = sent;
        refused.current = false;
        markSaved();
        // The server now holds what was sent (`sent` is that form, as
        // entries): that is what `_was` says from here.
        known.current = knownFrom(sent, known.current);
        writeKnown();
        // An edit made while this was on the wire is still unsaved; its own
        // save follows (and the leave send covers it until then).
        dirty.current = formRef.current ? serialise(formRef.current) !== sent : false;
        setSignedOut(false);
        setRefusal(undefined);
        setStatus("saved");
        return true;
      }
      setStatus("error");
      setSignedOut(Boolean(outcome.signedOut));
      if (outcome.final) {
        // Refused for good (gone, erased, not yours): say why and stop. An
        // edit typed while this was on the wire is not what was refused: it
        // keeps its own save (its debounce, or the leave send).
        refused.current = formRef.current ? serialise(formRef.current) === sent : true;
        attempt.current = 0;
        setRefusal(outcome.message);
        return false;
      }
      setRefusal(undefined);
      if (!mounted.current) {
        // Left while this save was on the wire: one keepalive attempt, no
        // backoff loop for a page that is gone.
        sendOnLeave();
        return false;
      }
      // Keep the edit and retry with a capped backoff (2s → … → 30s).
      attempt.current += 1;
      const delay = Math.min(2000 * 2 ** (attempt.current - 1), 30000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        void save();
      }, delay);
      return false;
    };
    const run = (inFlight.current ?? Promise.resolve(true)).then(attemptSave, attemptSave);
    inFlight.current = run;
    void run.finally(() => {
      if (inFlight.current === run) inFlight.current = null;
    });
    return run;
  }, [id, markSaved, sendOnLeave, writeKnown]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    refused.current = false;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, 700);
  }, [save]);

  // Save at once when focus leaves a field with an edit still waiting for
  // the debounce, so following a link straight after typing (a past
  // purchase, the data-protection buttons) cannot drop it. Tabbing through
  // unchanged fields sends nothing.
  const flush = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    void save();
  }, [save]);

  const retryNow = useCallback(() => {
    attempt.current = 0;
    void save();
  }, [save]);

  // Retry as soon as the network returns; send with keepalive when the tab
  // is hidden or closed. A refused save is not resent.
  useEffect(() => {
    const onOnline = () => {
      if (dirty.current && !refused.current) void save();
    };
    const onLeave = () => void sendOnLeave();
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
  }, [save, sendOnLeave]);

  // Leaving inside the app (a link, Back, a swipe) unmounts the editor and
  // fires no pagehide, and a click on a checkbox or chip may move no focus
  // (Safari), so no blur flush either. Send what a debounce or retry was
  // holding, after any save on the wire; then, if anything was saved,
  // refresh the router so Back cannot reopen a stale cached copy.
  const sendOnLeaveRef = useRef(sendOnLeave);
  useEffect(() => {
    sendOnLeaveRef.current = sendOnLeave;
  }, [sendOnLeave]);
  useEffect(
    () => () => {
      const waiting = timer.current !== null || retryTimer.current !== null;
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      timer.current = null;
      retryTimer.current = null;
      const sent = waiting ? sendOnLeaveRef.current(true) : null;
      refreshAfterLeave(sent ?? inFlight.current);
    },
    [refreshAfterLeave],
  );

  // A stored type the list does not know (an imported "other") stays an
  // option, so the select never posts a different type on the next save.
  const typeOptions = Object.entries(CONTACT_TYPE_LABELS);
  if (contact.contact_type && !(contact.contact_type in CONTACT_TYPE_LABELS)) {
    typeOptions.push([contact.contact_type, labelOf(CONTACT_TYPE_LABELS, contact.contact_type)]);
  }

  return (
    <form
      ref={setFormRef}
      onInput={scheduleSave}
      onChange={scheduleSave}
      onBlur={flush}
      onSubmit={(e) => {
        e.preventDefault();
        const waiting = timer.current !== null;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        // Enter sends what is waiting, but not a form refused for good again.
        if (planFlush({ waiting, unsaved: dirty.current, refused: refused.current }) === "send") void save();
      }}
      className="space-y-6"
    >
      {/* The shared status line, pinned under the header's measured height
          (var(--app-header-h)) so it and its Retry stay in view. A refusal
          for good shows its reason and offers no Retry. */}
      <SaveStatus
        state={status}
        what="the contact"
        detail={refusal}
        signedOut={signedOut}
        onRetry={status === "error" && !refusal ? retryNow : undefined}
        idleText="Changes save automatically"
        className="-mt-3"
      />
      {/* What this editor last knew the server to hold, so the route writes
          these only when they were changed here (lib/contact-save.ts).
          Written by writeKnown(), never by React: no value prop. */}
      <input type="hidden" name="marketing_consent_was" />
      <input type="hidden" name="do_not_mail_was" />
      <input type="hidden" name="kyc_status_was" />
      <input type="hidden" name="interests_was" />

      <Section title="Details">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <Field id={fid("first_name")} label="First name">
            <input id={fid("first_name")} name="first_name" defaultValue={contact.first_name ?? ""} className="field" />
          </Field>
          <Field id={fid("last_name")} label="Last name">
            <input id={fid("last_name")} name="last_name" defaultValue={contact.last_name ?? ""} className="field" />
          </Field>
          <Field id={fid("salutation")} label="Salutation" hint="The greeting newsletters open with.">
            <input
              id={fid("salutation")}
              name="salutation"
              defaultValue={contact.salutation ?? ""}
              placeholder="Dear Professor Tanaka"
              aria-describedby={`${fid("salutation")}-hint`}
              className="field"
            />
          </Field>
          <Field id={fid("contact_type")} label="Type">
            <select id={fid("contact_type")} name="contact_type" defaultValue={contact.contact_type} className="field">
              {typeOptions.map(([value, word]) => (
                <option key={value} value={value}>
                  {word}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid("email")} label="Email">
            <input id={fid("email")} name="email" defaultValue={contact.email ?? ""} className="field" />
          </Field>
          <Field id={fid("phone")} label="Phone">
            <input id={fid("phone")} name="phone" defaultValue={contact.phone ?? ""} className="field" />
          </Field>

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

          <h3 className="pt-2 text-[13px] font-semibold leading-[1.45] text-ink sm:col-span-2">Social and online</h3>
          <Field id={fid("instagram_handle")} label="Instagram">
            <input
              id={fid("instagram_handle")}
              name="instagram_handle"
              defaultValue={contact.instagram_handle ?? ""}
              className="field"
            />
          </Field>
          <Field id={fid("linkedin")} label="LinkedIn (URL)">
            <input id={fid("linkedin")} name="linkedin" defaultValue={cf("linkedin")} className="field" />
          </Field>
          <Field id={fid("x_handle")} label="X (Twitter)">
            <input id={fid("x_handle")} name="x_handle" defaultValue={cf("x_handle")} className="field" />
          </Field>
          <Field id={fid("website")} label="Website">
            <input id={fid("website")} name="website" defaultValue={cf("website")} className="field" />
          </Field>
          <Field id={fid("whatsapp_number")} label="WhatsApp">
            <input
              id={fid("whatsapp_number")}
              name="whatsapp_number"
              defaultValue={contact.whatsapp_number ?? ""}
              className="field"
            />
          </Field>
          <Field id={fid("wechat_id")} label="WeChat or LINE">
            <input id={fid("wechat_id")} name="wechat_id" defaultValue={contact.wechat_id ?? ""} className="field" />
          </Field>
          <input type="hidden" name="line_id" defaultValue={contact.line_id ?? ""} />

          <h3 className="pt-2 text-[13px] font-semibold leading-[1.45] text-ink sm:col-span-2">Mailing</h3>
          <label className="flex w-fit cursor-pointer items-start gap-2 text-[13px] leading-[1.45] text-ink">
            <input
              type="checkbox"
              name="marketing_consent"
              defaultChecked={contact.marketing_consent}
              className="mt-[2px] h-4 w-4 shrink-0"
            />
            Marketing consent
          </label>
          <label className="flex w-fit cursor-pointer items-start gap-2 text-[13px] leading-[1.45] text-ink">
            <input
              type="checkbox"
              name="do_not_mail"
              defaultChecked={contact.do_not_mail}
              className="mt-[2px] h-4 w-4 shrink-0"
            />
            Do not mail (post)
          </label>
          <Field id={fid("notes")} label="Notes" className="sm:col-span-2">
            <textarea id={fid("notes")} name="notes" rows={3} defaultValue={contact.notes ?? ""} className="field" />
          </Field>
        </div>
      </Section>

      <Section title="Profile">
        <h3 className="label">Past purchases</h3>
        {purchases.length ? (
          <ul className="mt-2 border-t border-rule">
            {purchases.map((p, i) => {
              const objectLine = [p.maker_name, p.title ?? "Untitled", p.year].filter(Boolean).join(", ");
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 border-b border-rule py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                      className="link-plain block min-w-0 text-ink"
                    >
                      <span className="tabular text-meta">{p.stock_number ?? "—"}</span>{" "}
                      <span>{objectLine}</span>
                    </Link>
                    {p.buyer_note ? (
                      <p className="mt-0.5 text-[12px] leading-[1.4] text-meta">{p.buyer_note}</p>
                    ) : null}
                  </div>
                  <span className="tabular shrink-0 text-[12px] leading-[1.4] text-meta">
                    {p.sold_date ? formatDate(p.sold_date) : ""}
                    {/* Whole pounds, as this list always read ("£12,000"). */}
                    {showPrices && p.sold_price_gbp != null ? ` · ${gbpDisplay(p.sold_price_gbp)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] leading-[1.45] text-body">No recorded purchases.</p>
        )}

        {consignments.length ? (
          <div className="mt-5">
            <h3 className="label">Consignments</h3>
            <ul className="mt-2 border-t border-rule">
              {consignments.map((c, i) => {
                const objectLine = [c.maker_name, c.title ?? "Untitled", c.year].filter(Boolean).join(", ");
                return (
                  <li
                    key={i}
                    className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 border-b border-rule py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/inventory/${encodeURIComponent(c.stock_number ?? "")}`}
                        className="link-plain block min-w-0 text-ink"
                      >
                        <span className="tabular text-meta">{c.stock_number ?? "—"}</span>{" "}
                        <span>{objectLine}</span>
                      </Link>
                      <p className="mt-0.5 text-[12px] leading-[1.4] text-meta">
                        {c.share_pct != null ? `Co-owner or consignee share ${100 - c.share_pct}%` : "Consignee"}
                        {c.sale_handled_by_jvb === false
                          ? " · sold by a third party"
                          : c.sale_handled_by_jvb === true
                            ? " · sale handled by J.v.d.B."
                            : ""}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-right text-[12px] leading-[1.4] text-meta">
                      {c.sold_date ? formatDate(c.sold_date) : "In stock"}
                      {showPrices && c.co_owner_share_gbp != null ? ` · ${gbpDisplay(c.co_owner_share_gbp)}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-5">
          <InterestSelect options={interestOptions} selected={selectedInterests} onChange={scheduleSave} />
        </div>
      </Section>

      {/* AML, at the bottom. id="aml": the sanctions notice above the editor
          links here; scroll-mt keeps the heading clear of the sticky header
          and save line. */}
      <Section
        id="aml"
        className="scroll-mt-[calc(var(--app-header-h,88px)+56px)]"
        title="AML (in-house)"
        meta="Recorded by the gallery with its AML adviser. Confirmed contacts are screened against the UK Sanctions List every two weeks."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Field id={fid("kyc_status")} label="Status">
            <select id={fid("kyc_status")} name="kyc_status" defaultValue={contact.kyc_status} className="field">
              {Object.entries(KYC_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid("aml_confirmed_date")} label="Confirmed date">
            <input
              id={fid("aml_confirmed_date")}
              type="date"
              name="aml_confirmed_date"
              defaultValue={cf("aml_confirmed_date")}
              className="field"
            />
          </Field>
          <Field id={fid("aml_notes")} label="Note (reference or adviser)">
            <input id={fid("aml_notes")} name="aml_notes" defaultValue={cf("aml_notes")} className="field" />
          </Field>
        </div>
      </Section>
    </form>
  );
}
