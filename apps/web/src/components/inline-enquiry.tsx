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
  withAddress = false,
}: {
  label: string;
  kind: "publication" | "appointment";
  subject: string;
  defaultMessage: string;
  /** Kept for callers; the toggle carries the label in both states. */
  heading?: string;
  columns?: 2 | 3;
  withAddress?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The form stays mounted while the fold closes, so the box never shrinks empty.
  const [mounted, setMounted] = useState(false);
  const show = () => {
    setMounted(true);
    setOpen(true);
  };
  return (
    <div>
      <button
        type="button"
        className="link-accent min-h-[44px]"
        onClick={() => (open ? setOpen(false) : show())}
        aria-expanded={open}
      >
        {label} {open ? "↑" : "↓"}
      </button>
      <div
        className="fold"
        data-open={open}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !open) setMounted(false);
        }}
      >
        <div aria-hidden={!open}>
          <div className="fold-body pt-3 pb-2">
            {mounted ? (
              <EnquiryForm kind={kind} subject={subject} defaultMessage={defaultMessage} columns={columns} withAddress={withAddress} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
