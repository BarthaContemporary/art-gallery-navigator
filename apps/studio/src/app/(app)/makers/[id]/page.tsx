import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase, getSession, createServiceClient } from "@/lib/supabase";
import { MakerProfileEditor } from "@/components/maker-profile-editor";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { scriptLang } from "@/lib/script-lang";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section, Panel } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

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
    .select("id, display_name, native_name, romanized_name, life_dates, region, school_or_workshop, biography, portrait_path, profile_html, web_visible")
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
    .from("vw_pieces_list")
    .select("id, stock_number, title, status")
    .eq("maker_id", id)
    .order("stock_number")
    .limit(60);

  const list = works ?? [];
  const metaParts = [maker.life_dates, maker.region].filter(Boolean) as string[];

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/makers", label: "All makers" }}
        title={maker.display_name}
        meta={
          maker.native_name || metaParts.length > 0 ? (
            <>
              {maker.native_name ? <span lang={scriptLang(maker.native_name)}>{maker.native_name}</span> : null}
              {maker.native_name && metaParts.length > 0 ? " · " : null}
              {metaParts.join(" · ")}
            </>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* The editor puts the profile in with innerHTML, so it gets the
            stored HTML through the same allow-list the save path uses:
            whatever the column holds (a row written before the database
            guard, a restored backup), no markup beyond it reaches the page. */}
        <MakerProfileEditor
          makerId={maker.id}
          initialHtml={sanitizeHtml((maker.profile_html as string | null) ?? "")}
          portraitUrl={portraitUrl}
          initialWebVisible={Boolean(maker.web_visible)}
          initialFields={{
            display_name: maker.display_name ?? "",
            native_name: (maker.native_name as string | null) ?? "",
            romanized_name: (maker.romanized_name as string | null) ?? "",
            life_dates: (maker.life_dates as string | null) ?? "",
            region: (maker.region as string | null) ?? "",
            school_or_workshop: (maker.school_or_workshop as string | null) ?? "",
          }}
        />

        {maker.biography ? (
          <Panel title="Legacy biography (migrated)">
            <p className="whitespace-pre-line text-[13px] leading-[1.5] text-body">{maker.biography}</p>
          </Panel>
        ) : null}

        <Section
          title="Works by this maker"
          meta={<span className="tabular">{`${formatCount(list.length)} ${list.length === 1 ? "work" : "works"}`}</span>}
        >
          {list.length > 0 ? (
            <TableFrame>
              {/* No minimum width: on a phone the title wraps, so the status
                  stays in view without scrolling sideways. */}
              <Table>
                <thead>
                  <tr>
                    <Th className="sm:w-[110px]">Stock no.</Th>
                    <Th>Title</Th>
                    <Th className="sm:w-[150px]">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((w) => (
                    <Tr key={w.id}>
                      <Td className="tabular whitespace-nowrap">
                        <Link href={`/inventory/${encodeURIComponent(w.stock_number)}`} className="link-plain text-ink">
                          {w.stock_number}
                        </Link>
                      </Td>
                      <Td className="text-ink">
                        <Link href={`/inventory/${encodeURIComponent(w.stock_number)}`} className="link-plain">
                          {w.title ?? "Untitled"}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <StatusBadge status={w.status} variant="dot" />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
          ) : (
            <EmptyState>No works attributed yet. Choose this maker on a work to list it here.</EmptyState>
          )}
        </Section>
      </div>
    </div>
  );
}
