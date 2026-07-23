import { downloadWithDriveCopy } from "@/lib/shared-drive";
import { renderToBuffer } from "@react-pdf/renderer";
import { MailingLabels, type LabelAddress, type AveryTemplate } from "@jvb/documents";
import { getSupabase } from "@/lib/supabase";

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

  const { data: rows, error } = await supabase
    .from("crm_list_members")
    .select(
      "contact:crm_contacts(first_name, last_name, address_line1, address_line2, city, postcode, country, do_not_mail, org:crm_organizations(name))",
    )
    .eq("list_id", list);
  if (error) return new Response(error.message, { status: 500 });

  const contacts = (rows ?? [])
    .map((r) => (r as unknown as { contact: ContactRow | null }).contact)
    .filter((c): c is ContactRow => c != null);

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

  const buf = await renderToBuffer(MailingLabels({ addresses, template }));

  return downloadWithDriveCopy(
    new Uint8Array(buf),
    "application/pdf",
    "labels.pdf",
    "Docs",
  );
}
