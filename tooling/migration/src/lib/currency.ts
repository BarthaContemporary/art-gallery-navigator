import { toText } from "./values.js";

/** Map legacy currency symbols (and codes) to ISO 4217 codes. */
const CURRENCY_MAP: Record<string, string> = {
  "£": "GBP",
  "¥": "JPY",
  "€": "EUR",
  $: "USD",
  GBP: "GBP",
  JPY: "JPY",
  EUR: "EUR",
  USD: "USD",
};

export function parseCurrency(v: unknown): string | null {
  const s = toText(v);
  if (!s) return null;
  return CURRENCY_MAP[s] ?? CURRENCY_MAP[s.toUpperCase()] ?? null;
}

/**
 * GBP amount from a foreign amount and FX rate (rate = GBP per unit of the
 * foreign currency, as stored by FileMaker). When the currency already is
 * GBP and no rate is present, the amount passes through unchanged.
 */
export function toGbp(
  amount: number | null,
  fx: number | null,
  currency: string | null,
): number | null {
  if (amount === null) return null;
  if (fx !== null) return Math.round(amount * fx * 100) / 100;
  if (currency === "GBP" || currency === null) return amount;
  return null;
}
