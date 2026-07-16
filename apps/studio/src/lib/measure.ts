// Metric → imperial helpers for the inventory.
// Art dimensions are conventionally quoted to the nearest 1/8 inch, using
// typographic vulgar fractions (¼, ⅜, …) rather than decimals.

const EIGHTHS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"] as const;

/** Convert grams → pounds, to 2 decimals (e.g. "1.32 lb"). */
export function gramsToPounds(g: number): string {
  return (g / 453.59237).toFixed(2);
}

/** Convert cm → inches, rounded to the nearest 1/8", as a nice fraction string. */
export function cmToInchesFraction(cm: number): string {
  const inches = cm / 2.54;
  let whole = Math.floor(inches);
  let eighths = Math.round((inches - whole) * 8);
  if (eighths === 8) {
    whole += 1;
    eighths = 0;
  }
  const frac = EIGHTHS[eighths] ?? "";
  if (whole === 0) return frac || "0";
  return `${whole}${frac}`;
}
