import { ContactCapture } from "@/components/contact-capture";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "New contact" };
export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const supabase = await getSupabase();
  // Contacts added via this app (tagged 'capture') — deletable here.
  const { data } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, custom_fields, created_at")
    .contains("tags", ["capture"])
    .order("created_at", { ascending: false })
    .limit(20);

  const recent = (data ?? []).map((c) => {
    const org = (c.custom_fields as { organization?: string } | null)?.organization ?? "";
    return {
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || org || "Unnamed contact",
      sub: org && [c.first_name, c.last_name].some(Boolean) ? org : "",
    };
  });

  return <ContactCapture recentContacts={recent} />;
}
