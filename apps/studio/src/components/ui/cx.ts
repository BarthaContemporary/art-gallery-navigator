/** Joins class names, dropping the empty ones: cx("btn", small && "btn-sm"). */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
