import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/sanity";
import { BookingForm } from "@/components/booking-form";

export const metadata: Metadata = {
  title: "Visit",
  description:
    "Book a private gallery viewing or arrange a meeting at a fair. Confirmations include a calendar invitation.",
};

export default async function VisitPage() {
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Visit</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-ink-body">
        The gallery is open by appointment. Choose a date and time that suits you and we will
        confirm by email — the confirmation includes a calendar invitation you can add with one
        click.
      </p>
      {settings?.address ? (
        <p className="mt-3 whitespace-pre-line text-sm text-ink-muted">{settings.address}</p>
      ) : null}

      <div className="mt-10 rounded-card border border-line-soft bg-cell p-5 sm:p-8">
        <BookingForm />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        Your details are used only to arrange the appointment and are handled in accordance with
        our privacy policy. If a time is unavailable we will suggest an alternative.
      </p>
    </div>
  );
}
