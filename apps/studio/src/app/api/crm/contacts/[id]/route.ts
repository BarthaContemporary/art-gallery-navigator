import { NextResponse } from "next/server";
import { bounceResetFor } from "@/lib/email-bounce";
import { getSession, getSupabase, hasRole } from "@/lib/supabase";
import { changedFlags, consentStamp, mergeInterests, parseNames } from "@/lib/contact-save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Autosave endpoint for a contact — accepts the full editor form (FormData).
 *
 * Admin and staff only, checked before anything is read; it then runs on the
 * caller's own connection, so the row policies decide as well (the
 * accountant has no contact policy at all). The answers the editor acts on
 * (lib/save-outcome.ts): 401 signed out (tried again after signing in), 403
 * for another role (final), 500 when the current row could not be read
 * (tried again), 404 when there is no row to write or the write changed none
 * (final), 410 for an erased contact (final: nothing is ever written back
 * into an anonymised row, and the write itself skips one erased since).
 *
 * The consent, do-not-mail and AML fields, and the interests, have other
 * writers (opt-in confirmation, unsubscribe, bounces, sales), so they are
 * written only as far as the user changed them here (lib/contact-save.ts).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // The role first, before anything is read or written: contacts are kept
  // by admin and staff (the row policies say the same; this answers the
  // accountant with a reason instead of a "not found").
  if (!hasRole(session.roles, "admin", "staff"))
    return NextResponse.json({ error: "Your role can't change contacts." }, { status: 403 });
  const { user } = session;
  const supabase = await getSupabase();

  const fd = await req.formData();
  const s = (k: string) => {
    const v = fd.get(k);
    const t = v == null ? "" : String(v).trim();
    return t || null;
  };
  const raw = (k: string) => String(fd.get(k) ?? "").trim();

  // The row as it is now. Everything below builds on it (the custom fields
  // not in the form, the consent evidence), so a failed read is an error,
  // never an empty row: that would drop those fields and re-date consent.
  const { data: current, error: readErr } = await supabase
    .from("crm_contacts")
    .select("custom_fields, marketing_consent, consent_date, consent_source, erased_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!current)
    return NextResponse.json({ error: "Contact not found, or not yours to edit" }, { status: 404 });
  const prev = current as {
    custom_fields: Record<string, unknown> | null;
    marketing_consent: boolean | null;
    consent_date: string | null;
    consent_source: string | null;
    erased_at: string | null;
  };
  if (prev.erased_at)
    return NextResponse.json(
      { error: "This contact has been erased, so nothing more is saved to it. Reload the page" },
      { status: 410 },
    );
  const existing = (prev.custom_fields as Record<string, unknown>) ?? {};

  const interests = mergeInterests(
    existing.interests,
    parseNames(fd.get("interests")) ?? [],
    parseNames(fd.get("interests_was")),
  );

  const flags = changedFlags(fd);
  const consentFields = consentStamp(prev, flags.marketing_consent, user.email ?? user.id, new Date().toISOString());

  const { data: updated, error } = await supabase
    .from("crm_contacts")
    .update({
      first_name: s("first_name"),
      last_name: s("last_name"),
      salutation: s("salutation"),
      contact_type: raw("contact_type") || "collector",
      email: s("email"),
      // A corrected address clears the hard-bounce stamp offers skip on
      // (lib/email-bounce.ts); the same address keeps it.
      ...(await bounceResetFor(supabase, id, s("email"))),
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
      ...flags,
      ...consentFields,
      notes: s("notes"),
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
    .eq("id", id)
    // Never into a row erased since the read above.
    .is("erased_at", null)
    // An update the row policies filter out changes nothing and raises no
    // error; ask for the row back so that is not answered as a save.
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated?.length)
    return NextResponse.json({ error: "Contact not found, or not yours to edit" }, { status: 404 });

  // The interest lists derive their membership from custom_fields.interests
  // (migration 0060), so writing it above is the whole job. This used to also
  // mirror into crm_list_members, which meant the same fact stored twice and
  // kept aligned only by this route remembering to — any other path that
  // touched a contact's interests left the lists wrong.

  return NextResponse.json({ ok: true });
}
