"use client";

import { useState } from "react";

/**
 * The contact's data-protection controls: export (subject access), log a
 * request, and erasure. Erasure explains up front what the law makes us keep.
 */
export function DataProtectionPanel({
  contactId,
  holds,
  erased,
  eraseAction,
  logRequestAction,
}: {
  contactId: string;
  holds: string[];
  erased: boolean;
  eraseAction: () => void | Promise<void>;
  logRequestAction: (formData: FormData) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [logging, setLogging] = useState(false);
  const btn = "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong";

  return (
    <section className="mt-8 rounded-[11px] border border-line bg-cell p-4">
      <h2 className="text-[13px] font-semibold text-ink-strong">Data protection</h2>
      <p className="mt-1 text-[12px] text-ink-soft">
        Requests must be answered within one month (UK GDPR Arts. 12–22). Log the request first so the deadline is tracked in Admin → Data protection.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={`/crm/contacts/${contactId}/data`} className={btn}>
          View everything held (print / PDF)
        </a>
        <a href={`/api/crm/contacts/${contactId}/export`} className={btn}>
          Download as JSON
        </a>
        <button type="button" onClick={() => setLogging((v) => !v)} className={btn}>
          Log a request…
        </button>
        {!erased ? (
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            className="ml-auto rounded-lg border border-danger/40 px-3 py-1.5 text-[12px] font-semibold text-danger"
          >
            Erase personal data…
          </button>
        ) : (
          <span className="ml-auto text-[12px] text-ink-soft">Personal data erased.</span>
        )}
      </div>

      {logging ? (
        <form action={logRequestAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line-soft bg-band/40 p-3">
          <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Request
            <select name="kind" className="mt-1 block rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body">
              <option value="access">Access (copy of data)</option>
              <option value="erasure">Erasure</option>
              <option value="rectification">Rectification</option>
              <option value="restriction">Restriction</option>
              <option value="objection">Objection</option>
              <option value="portability">Portability</option>
              <option value="withdraw_consent">Withdraw consent</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Received
            <input type="date" name="received_at" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body" />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            How it arrived
            <input name="channel" placeholder="email, letter, in person…" className="mt-1 block w-44 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body" />
          </label>
          <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg">
            Log request
          </button>
        </form>
      ) : null}

      {confirming ? (
        <div className="mt-3 rounded-lg border border-danger/40 bg-danger/5 p-3 text-[12.5px] text-ink-body">
          {holds.length > 0 ? (
            <>
              <p>
                This contact appears in records the gallery must keep by law, so the record itself stays but
                <strong> everything identifying is removed</strong>: name, contact details, addresses, notes, interests,
                marketing data, list memberships, newsletter and offer history, and the change log.
              </p>
              <ul className="mt-2 list-disc pl-5 text-ink-muted">
                {holds.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              No legal hold applies. The contact and everything attached (notes, list memberships, newsletter and offer
              history, change log) will be <strong>deleted permanently</strong>; enquiries and appointments are kept without the name.
            </p>
          )}
          <form action={eraseAction} className="mt-3 flex items-center gap-2">
            <button type="submit" className="rounded-lg border border-danger bg-danger-soft px-3 py-1.5 text-[12px] font-semibold text-danger">
              {holds.length > 0 ? "Erase identifying data" : "Delete contact"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-[12px] font-medium text-ink-mid hover:text-ink-strong">
              Cancel
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
