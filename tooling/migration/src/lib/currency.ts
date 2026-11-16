import { toText } from "./values.ts";

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
 * foreign currency, as stored by FileMaker). A GBP amount passes through
 * unchanged. A rate of 0 or less counts as missing, and so does a rate of
 * exactly 1 on a foreign currency (FileMaker's stale default): such an
 * amount gets no GBP value (null, flagged by the cleaner) rather than the
 * foreign figure written as pounds, which migration 0066 had to undo.
 */
export function toGbp(
  amount: number | null,
  fx: number | null,
  currency: string | null,
): number | null {
  if (amount === null) return null;
  if (currency === "GBP") return amount;
  const rate = fx !== null && Number.isFinite(fx) && fx > 0 ? fx : null;
  if (currency === null) return rate === null ? amount : Math.round(amount * rate * 100) / 100;
  if (rate === null || rate === 1) return null;
  return Math.round(amount * rate * 100) / 100;
}
