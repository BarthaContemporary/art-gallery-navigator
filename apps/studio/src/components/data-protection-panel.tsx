"use client";

import { useState } from "react";
import { Button, ButtonLink } from "./ui/button";
import { Section, Panel } from "./ui/section";
import { Notice } from "./ui/notice";
import { DownloadIcon, FileIcon } from "./ui/icons";

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

  return (
    <Section
      title="Data protection"
      meta="Requests must be answered within one month (UK GDPR Arts. 12 to 22). Log the request first, so its deadline is tracked on the Data protection page in Admin."
      className="mt-8"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={`/crm/contacts/${contactId}/data`} size="sm" icon={<FileIcon size={14} />}>
          View everything held (print or PDF)
        </ButtonLink>
        <ButtonLink href={`/api/crm/contacts/${contactId}/export`} native size="sm" icon={<DownloadIcon size={14} />}>
          Download as JSON
        </ButtonLink>
        <Button size="sm" aria-expanded={logging} onClick={() => setLogging((v) => !v)}>
          Log a request…
        </Button>
        {!erased ? (
          <Button
            variant="danger"
            size="sm"
            aria-expanded={confirming}
            onClick={() => setConfirming((v) => !v)}
            className="sm:ml-auto"
          >
            Erase personal data…
          </Button>
        ) : (
          <span className="text-[12px] leading-[1.4] text-meta sm:ml-auto">Personal data erased.</span>
        )}
      </div>

      {logging ? (
        <Panel className="mt-3">
          <form action={logRequestAction} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="dp-kind" className="label">
                Request
              </label>
              <select id="dp-kind" name="kind" className="field">
                <option value="access">Access (copy of data)</option>
                <option value="erasure">Erasure</option>
                <option value="rectification">Rectification</option>
                <option value="restriction">Restriction</option>
                <option value="objection">Objection</option>
                <option value="portability">Portability</option>
                <option value="withdraw_consent">Withdraw consent</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="dp-received" className="label">
                Received
              </label>
              <input
                id="dp-received"
                type="date"
                name="received_at"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="field"
              />
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-48">
              <label htmlFor="dp-channel" className="label">
                How it arrived
              </label>
              <input id="dp-channel" name="channel" placeholder="Email, letter, in person" className="field" />
            </div>
            <Button type="submit" variant="primary" pendingLabel="Logging…">
              Log request
            </Button>
          </form>
        </Panel>
      ) : null}

      {confirming ? (
        <Notice tone="danger" className="mt-3">
          {holds.length > 0 ? (
            <>
              <p>
                This contact appears in records the gallery must keep by law, so the record itself stays but
                <strong className="font-semibold text-ink"> everything identifying is removed</strong>: name, contact
                details, addresses, notes, interests, marketing data, list memberships, newsletter and offer history,
                and the change log.
              </p>
              <ul className="mt-2 list-disc pl-5">
                {holds.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              No legal hold applies. The contact and everything attached (notes, list memberships, newsletter and offer
              history, change log) will be <strong className="font-semibold text-ink">deleted permanently</strong>;
              enquiries and appointments are kept without the name.
            </p>
          )}
          <form action={eraseAction} className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" variant="danger" size="sm" pendingLabel="Erasing…">
              {holds.length > 0 ? "Erase identifying data" : "Delete contact"}
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </form>
        </Notice>
      ) : null}
    </Section>
  );
}
