"use client";

import { useState } from "react";
import { EnquiryForm } from "./enquiry-form";

/**
 * "Enquire to order ↓" / "Request an appointment ↓" — an orange text link
 * that folds the enquiry form open in place. Never a pop-up.
 */
export function InlineEnquiry({
  label,
  kind,
  subject,
  defaultMessage,
  heading,
  columns = 2,
}: {
  label: string;
  kind: "publication" | "appointment";
  subject: string;
  defaultMessage: string;
  heading: string;
  columns?: 2 | 3;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="fold" data-open={open}>
        <div aria-hidden={!open}>
          <div className="pb-2">
            {open ? (
              <EnquiryForm
                kind={kind}
                subject={subject}
                defaultMessage={defaultMessage}
                heading={heading}
                onCollapse={() => setOpen(false)}
                columns={columns}
              />
            ) : null}
          </div>
        </div>
      </div>
      {!open ? (
        <button type="button" className="link-accent min-h-[44px]" onClick={() => setOpen(true)} aria-expanded={false}>
          {label} ↓
        </button>
      ) : null}
    </div>
  );
}
