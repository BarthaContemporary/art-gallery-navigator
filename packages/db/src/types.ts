/**
 * Shared domain types for the JVB apps.
 *
 * Only what the apps import lives here. The schema itself is
 * supabase/migrations, the one source of truth: hand-written mirrors of its
 * tables and enums (Piece, PieceImage, ImageRole, DocType and the rest) were
 * imported by nothing and had drifted from it (a dropped `bytes` column, no
 * 'other' image role, no 'import_document' document type), so they were
 * removed. Type a query result next to the query, from the columns it
 * selects.
 */

/** The user_role enum (public.user_roles.role). */
export type UserRole = "admin" | "staff" | "accountant";
