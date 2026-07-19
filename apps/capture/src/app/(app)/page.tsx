import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { PasskeyManager } from "@/components/passkey-manager";

export const dynamic = "force-dynamic";

const OPTIONS = [
  {
    href: "/works/new",
    title: "New work(s)",
    hint: "Photograph works with the camera — labels are read automatically.",
    emoji: "🖼",
  },
  {
    href: "/invoices/new",
    title: "New invoice",
    hint: "Photograph an invoice (any number of pages) and link it to works.",
    emoji: "🧾",
  },
  {
    href: "/review",
    title: "Edit & push to inventory",
    hint: "Review captured purchases, then add them to the inventory.",
    emoji: "📤",
  },
  {
    href: "/contacts/new",
    title: "New contact",
    hint: "Scan a business card or type — added to contacts straight away.",
    emoji: "👤",
  },
] as const;

export default async function Home() {
  const supabase = await getSupabase();
  // Small "what's waiting" hint for the review tile.
  const { count: draftBatches } = await supabase
    .from("capture_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");

  return (
    <div className="pt-2">
      <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink-strong">Capture</h1>
      <p className="mt-1 text-[13.5px] text-ink-muted">
        Fast preliminary entry. Everything is saved as a draft — finish the
        cataloguing later in the studio.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3">
        {OPTIONS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="tap flex items-center gap-4 rounded-2xl border border-line bg-cell px-5 py-4 active:bg-control/50"
          >
            <span aria-hidden className="text-[26px] leading-none">
              {o.emoji}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[16px] font-semibold text-ink-strong">
                {o.title}
                {o.href === "/review" && (draftBatches ?? 0) > 0 ? (
                  <span className="rounded-full bg-oranje px-2 py-0.5 text-[11px] font-semibold text-white">
                    {draftBatches}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-ink-muted">{o.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <PasskeyManager />
    </div>
  );
}
