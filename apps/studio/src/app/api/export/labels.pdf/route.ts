import { exportResponse } from "@/lib/shared-drive";
import { renderToBuffer } from "@react-pdf/renderer";
import { MailingLabels, type LabelAddress, type AveryTemplate } from "@jvb/documents";
import { getSupabase } from "@/lib/supabase";
import { loadListContacts } from "@/lib/crm-list-members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES: AveryTemplate[] = ["L7160", "L7162", "L7163"];

interface ContactRow {
  first_name: string | null;
  last_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  do_not_mail: boolean | null;
  org: { name: string | null } | null;
}

export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const list = params.get("list");
  if (!list) return new Response("Missing list", { status: 400 });

  const templateParam = params.get("template");
  const template: AveryTemplate =
    templateParam && (TEMPLATES as string[]).includes(templateParam)
      ? (templateParam as AveryTemplate)
      : "L7160";

  const { data: listRow } = await supabase
    .from("crm_lists")
    .select("id, is_dynamic, filter_rules")
    .eq("id", list)
    .maybeSingle();
  if (!listRow) return new Response("List not found", { status: 404 });

  let contacts: ContactRow[];
  try {
    contacts = await loadListContacts<ContactRow & { id: string }>(
      supabase,
      listRow,
      "id, first_name, last_name, address_line1, address_line2, city, postcode, country, do_not_mail, org:crm_organizations(name)",
    );
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Could not read list", { status: 500 });
  }

  const addresses: LabelAddress[] = contacts
    .filter((c) => !c.do_not_mail && (c.address_line1 || c.city))
    .map((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      return {
        name: name || c.org?.name || "—",
        organization: c.org?.name ?? undefined,
        lines: [c.address_line1, c.address_line2].filter(Boolean) as string[],
        city: c.city ?? undefined,
        postcode: c.postcode ?? undefined,
        country: c.country ?? undefined,
      };
    });

  // react-pdf throws on a Document with no Page, so an all-unmailable list
  // would surface as an opaque 500. Say what is actually wrong instead.
  if (addresses.length === 0) {
    return new Response(
      "No mailable addresses in this list — every contact is either marked " +
        "do-not-mail or has no postal address.",
      { status: 422 },
    );
  }

  const buf = await renderToBuffer(MailingLabels({ addresses, template }));

  return exportResponse(
    request,
    new Uint8Array(buf),
    "application/pdf",
    "labels.pdf",
    "Docs",
  );
}
