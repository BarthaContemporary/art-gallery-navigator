/**
 * A work's title with its year appended — "Reclining Figure, 2026".
 *
 * One rendering for every surface that names a work, so the inventory list,
 * the record and the edit header cannot drift apart. An untitled work still
 * carries its year ("Untitled, 1962") rather than losing it with the title.
 */
export function titleWithYear(
  title: string | null | undefined,
  year: number | string | null | undefined,
): string {
  const name = title?.toString().trim() || "Untitled";
  const y = year?.toString().trim();
  return y ? `${name}, ${y}` : name;
}
