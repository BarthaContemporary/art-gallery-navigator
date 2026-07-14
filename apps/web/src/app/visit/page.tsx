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
    <>
      {/* Dark band. */}
      <section className="bg-sumi text-washi">
        <div className="page grid12 py-[var(--section)]">
          <div className="col-span-12 md:col-span-8">
            <p className="label text-washi/70">Visit</p>
            <h1 className="mt-4 font-sans text-h1 font-medium tracking-tight text-washi">
              By appointment, in London.
            </h1>
            <p className="mt-5 max-w-[var(--measure)] font-serif text-lead font-light text-washi/80">
              The gallery is open by appointment. Choose a date and time that suits
              you and we will confirm by email — the confirmation includes a calendar
              invitation you can add with one click.
            </p>
            {settings?.address ? (
              <p className="mt-6 whitespace-pre-line font-serif text-ui text-washi/70">
                {settings.address}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Booking form. */}
      <div className="page py-16">
        <div className="grid12">
          <div className="col-span-12 md:col-span-8 md:col-start-3">
            <div className="bg-washi-2 p-6 sm:p-10">
              <BookingForm />
            </div>
            <p className="mt-6 max-w-[var(--measure)] font-serif text-ui text-ink-50">
              Your details are used only to arrange the appointment and are handled in
              accordance with our privacy policy. If a time is unavailable we will
              suggest an alternative.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
