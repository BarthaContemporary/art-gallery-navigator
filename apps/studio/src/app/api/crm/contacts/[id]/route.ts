import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Autosave endpoint for a contact — accepts the full editor form (FormData). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fd = await req.formData();
  const s = (k: string) => {
    const v = fd.get(k);
    const t = v == null ? "" : String(v).trim();
    return t || null;
  };
  const raw = (k: string) => String(fd.get(k) ?? "").trim();
  const parseInterests = (): string[] => {
    try {
      const arr = JSON.parse(String(fd.get("interests") ?? "[]"));
      return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const { data: current } = await supabase
    .from("crm_contacts")
    .select("custom_fields, marketing_consent, consent_date, consent_source")
    .eq("id", id)
    .maybeSingle();
  const prev = (current ?? {}) as {
    custom_fields: Record<string, unknown> | null;
    marketing_consent: boolean | null;
    consent_date: string | null;
    consent_source: string | null;
  };
  const existing = (prev.custom_fields as Record<string, unknown>) ?? {};

  const interests = parseInterests();

  /*
   * Consent needs provenance, not just a tick.
   *
   * UK GDPR Art. 7(1) puts the burden on the controller to demonstrate that
   * consent was given; a boolean with no date or source demonstrates nothing.
   * So the first time consent is granted, stamp when and by whom. An existing
   * date is never overwritten — the original record is the evidence, and a
   * later save must not quietly re-date it.
   *
   * Withdrawal keeps the date and source too: the audit question is often "when
   * did they consent, and when did that change", and erasing the history to
   * answer only the second is a poorer record.
   */
  const consent = fd.get("marketing_consent") === "on";
  const granting = consent && !prev.marketing_consent;
  const consentFields = granting
    ? {
        consent_date: prev.consent_date ?? new Date().toISOString(),
        consent_source:
          prev.consent_source ??
          `Recorded in the studio by ${user.email ?? user.id}`,
      }
    : {};

  const { error } = await supabase
    .from("crm_contacts")
    .update({
      first_name: s("first_name"),
      last_name: s("last_name"),
      salutation: s("salutation"),
      contact_type: raw("contact_type") || "collector",
      email: s("email"),
      phone: s("phone"),
      address_line1: s("address_line1"),
      address_line2: s("address_line2"),
      city: s("city"),
      postcode: s("postcode"),
      country: s("country"),
      instagram_handle: s("instagram_handle"),
      whatsapp_number: s("whatsapp_number"),
      line_id: s("line_id"),
      wechat_id: s("wechat_id"),
      marketing_consent: consent,
      ...consentFields,
      do_not_mail: fd.get("do_not_mail") === "on",
      notes: s("notes"),
      kyc_status: raw("kyc_status") || "not_started",
      custom_fields: {
        ...existing,
        linkedin: raw("linkedin"),
        x_handle: raw("x_handle"),
        website: raw("website"),
        interests,
        addr1_type: raw("addr1_type") || "primary_home",
        addr1_company: raw("addr1_company"),
        address2: {
          type: raw("addr2_type") || "second_home",
          company: raw("addr2_company"),
          line1: raw("addr2_line1"),
          line2: raw("addr2_line2"),
          city: raw("addr2_city"),
          postcode: raw("addr2_postcode"),
          country: raw("addr2_country"),
        },
        aml_confirmed_date: raw("aml_confirmed_date"),
        aml_notes: raw("aml_notes"),
      },
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The interest lists derive their membership from custom_fields.interests
  // (migration 0060), so writing it above is the whole job. This used to also
  // mirror into crm_list_members, which meant the same fact stored twice and
  // kept aligned only by this route remembering to — any other path that
  // touched a contact's interests left the lists wrong.

  return NextResponse.json({ ok: true });
}
