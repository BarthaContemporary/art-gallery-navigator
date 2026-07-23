import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase, getSession, createServiceClient } from "@/lib/supabase";
import { MakerProfileEditor } from "@/components/maker-profile-editor";

export const metadata = { title: "Maker profile" };

export default async function MakerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: maker } = await supabase
    .from("makers")
    .select("id, display_name, native_name, romanized_name, life_dates, region, school_or_workshop, biography, portrait_path, profile_html")
    .eq("id", id)
    .maybeSingle();
  if (!maker) notFound();

  // The portraits bucket has no user-level storage policies (uploads and
  // processing run through service-role API routes), so signing the display
  // URL needs the service client too — the page itself is session-gated.
  let portraitUrl: string | null = null;
  if (maker.portrait_path && (await getSession())) {
    const { data } = await createServiceClient()
      .storage.from("maker-portraits")
      .createSignedUrl(maker.portrait_path, 3600);
    portraitUrl = data?.signedUrl ?? null;
  }

  // Works by this maker (context under the profile).
  const { data: works } = await supabase
    .from("pieces")
    .select("id, stock_number, title, status")
    .eq("maker_id", id)
    .is("deleted_at", null)
    .order("stock_number")
    .limit(60);

  return (
    <div className="max-w-[980px]">
      <Link href="/makers" className="text-[12.5px] text-ink-soft">← All makers</Link>
      <h1 className="mt-2 text-[24px] font-semibold text-ink-strong">{maker.display_name}</h1>

      <div className="mt-5 rounded-[11px] border border-line bg-cell p-5">
        <MakerProfileEditor
          makerId={maker.id}
          initialHtml={(maker.profile_html as string | null) ?? ""}
          portraitUrl={portraitUrl}
          initialFields={{
            display_name: maker.display_name ?? "",
            native_name: (maker.native_name as string | null) ?? "",
            romanized_name: (maker.romanized_name as string | null) ?? "",
            life_dates: (maker.life_dates as string | null) ?? "",
            region: (maker.region as string | null) ?? "",
            school_or_workshop: (maker.school_or_workshop as string | null) ?? "",
          }}
        />
      </div>

      {maker.biography ? (
        <div className="mt-4 rounded-[11px] border border-line-soft bg-band/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">Legacy biography (migrated)</p>
          <p className="mt-1.5 whitespace-pre-line text-[13px] text-ink-muted">{maker.biography}</p>
        </div>
      ) : null}

      <div className="mt-6">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Works by this maker ({(works ?? []).length})
        </h2>
        <div className="mt-2 space-y-1">
          {(works ?? []).map((w) => (
            <Link
              key={w.id}
              href={`/inventory/${encodeURIComponent(w.stock_number)}`}
              className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2 text-[13px] text-ink-body hover:bg-control"
            >
              <span>
                <span className="font-mono text-[12px] text-ink-muted">{w.stock_number}</span>{" "}
                {w.title ?? "Untitled"}
              </span>
              <span className="text-[11.5px] text-ink-soft">{w.status.replace(/_/g, " ")}</span>
            </Link>
          ))}
          {(works ?? []).length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">No works attributed yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
