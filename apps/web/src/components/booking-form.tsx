"use client";

import { useState, type FormEvent } from "react";

const APPOINTMENT_TYPES = [
  { value: "private_viewing", label: "Private gallery viewing" },
  { value: "fair_meeting", label: "Meeting at a fair or exhibition" },
] as const;

type Status = "idle" | "submitting" | "success" | "error";

const inputClasses =
  "mt-2 w-full border border-hairline bg-washi px-3 py-2.5 font-serif text-ui text-ink-70 placeholder:text-ink-50 focus:border-sumi";

const labelClasses = "label block";

export function BookingForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appointmentType: data.get("appointmentType"),
          date: data.get("date"),
          time: data.get("time"),
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone") || undefined,
          notes: data.get("notes") || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }

      setStatus("success");
      form.reset();
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="border border-hairline bg-washi-2 p-6 font-serif text-body text-ink-70"
      >
        <p className="font-sans text-ui font-medium text-sumi">Thank you — your request has been received.</p>
        <p className="mt-2">
          We will confirm your appointment by email shortly. A calendar invitation (.ics) is
          attached to the confirmation.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="appointmentType" className={labelClasses}>
          Appointment type
        </label>
        <select
          id="appointmentType"
          name="appointmentType"
          required
          defaultValue="private_viewing"
          className={inputClasses}
        >
          {APPOINTMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={labelClasses}>
            Preferred date
          </label>
          <input id="date" name="date" type="date" required min={today} className={inputClasses} />
        </div>
        <div>
          <label htmlFor="time" className={labelClasses}>
            Preferred time
          </label>
          <input id="time" name="time" type="time" required step={900} className={inputClasses} />
        </div>
      </div>

      <div>
        <label htmlFor="name" className={labelClasses}>
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className={inputClasses}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className={labelClasses}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClasses}>
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClasses}>
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Works you would like to see, or anything else we should know."
          className={inputClasses}
        />
      </div>

      {status === "error" && errorMessage ? (
        <p role="alert" className="font-sans text-ui text-sumi">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn btn-filled w-full disabled:opacity-60 sm:w-auto"
      >
        {status === "submitting" ? "Sending…" : "Request appointment"}
      </button>
    </form>
  );
}
