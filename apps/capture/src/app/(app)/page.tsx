import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { PasskeyManager } from "@/components/passkey-manager";
import { IconArtwork, IconReceipt, IconPush, IconUser, type IconProps } from "@/components/icons";

export const dynamic = "force-dynamic";

const OPTIONS: {
  href: string;
  title: string;
  hint: string;
  Icon: (p: IconProps) => React.ReactNode;
}[] = [
  {
    href: "/works/new",
    title: "New work(s)",
    hint: "Photograph works with the camera — labels are read automatically.",
    Icon: IconArtwork,
  },
  {
    href: "/invoices/new",
    title: "New invoice",
    hint: "Photograph an invoice (any number of pages) and link it to works.",
    Icon: IconReceipt,
  },
  {
    href: "/review",
    title: "Edit & push to inventory",
    hint: "Review captured purchases, then add them to the inventory.",
    Icon: IconPush,
  },
  {
    href: "/contacts/new",
    title: "New contact",
    hint: "Scan a business card or type — added to contacts straight away.",
    Icon: IconUser,
  },
];

export default async function Home() {
  const supabase = await getSupabase();
  // "What's waiting" hint for the review tile — count only draft purchases that
  // actually have works, matching what the review list shows.
  const { data: draftRows } = await supabase
    .from("capture_batches")
    .select("id, capture_works(count)")
    .eq("status", "draft");
  const draftBatches = (draftRows ?? []).filter(
    (b) => ((b.capture_works as { count: number }[] | null)?.[0]?.count ?? 0) > 0,
  ).length;

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
            <o.Icon className="h-7 w-7 shrink-0 text-ink-strong" />
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
