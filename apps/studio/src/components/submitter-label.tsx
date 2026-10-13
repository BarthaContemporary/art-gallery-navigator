"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * The words of one submit button in a form that has two (Save and a
 * formAction Delete). useFormStatus says only that the form is submitting,
 * not which button sent it, so a pending label on Save also showed while
 * Delete ran. This listens for the form's submit event, keeps whether its own
 * button was the submitter, and shows `pending` only for that submission.
 *
 *   <Button type="submit"><SubmitterLabel idle="Save changes" pending="Saving…" /></Button>
 *   <button type="submit" formAction={…}><SubmitterLabel idle="Delete event" pending="Deleting…" /></button>
 *
 * Enter in a text field submits through the form's first submit button, and
 * the event names that button as the submitter, so it counts as Save.
 */
export function SubmitterLabel({ idle, pending }: { idle: ReactNode; pending: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const status = useFormStatus();
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const button = ref.current?.closest("button");
    const form = button?.form;
    if (!button || !form) return;
    const onSubmit = (e: SubmitEvent) => setMine(e.submitter === button);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return <span ref={ref}>{status.pending && mine ? pending : idle}</span>;
}
