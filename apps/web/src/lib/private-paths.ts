/**
 * Pages whose address is itself the key to them: a private offer
 * (/o/<token>) and the newsletter confirmation (/newsletter/confirm/<token>,
 * and the page it leads to). Analytics and marketing tags never run there,
 * because both report the full page address, and the Meta pixel would hand a
 * working link to a named collector's selection and prices to Meta (security
 * review 2026-10, F25). Pure, so private-paths.test.ts can run it directly.
 */
export function isPrivatePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/o" || pathname.startsWith("/o/") || pathname === "/newsletter" || pathname.startsWith("/newsletter/");
}
