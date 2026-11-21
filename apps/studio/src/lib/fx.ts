import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Currencies and spot rates for the Financials section, shared by the editor,
 * the save route and the spot-rate route so all three apply one rule.
 *
 * The money rule (CLAUDE.md): the purchase £ is entered by hand; only the sale
 * £ converts, from the ECB reference rate on the sale date (Frankfurter).
 */

/** The currencies the editor offers. A stored code outside it is offered too. */
export const EDITOR_CURRENCIES = ["GBP", "EUR", "USD", "CHF", "JPY"] as const;

/**
 * The codes Frankfurter has ECB reference rates for, plus GBP. A posted code
 * outside this set is never interpolated into the rate URL or used as a cache
 * key, and never replaces the stored currency.
 */
export const RATE_CURRENCIES: ReadonlySet<string> = new Set([
  "GBP", "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "HKD",
  "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD",
  "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
]);

/** The ISO code for a posted currency, or null when it is not one we know. */
export function currencyCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return RATE_CURRENCIES.has(code) ? code : null;
}

/**
 * The options a currency select shows: the editor's list, plus the stored
 * value when it is something else (a capture-app INR invoice, legacy "Yen"),
 * so the select shows and posts what is stored instead of falling back to
 * its first option, GBP.
 */
export function currencyOptions(stored: string | null | undefined): string[] {
  const list: string[] = [...EDITOR_CURRENCIES];
  const s = (stored ?? "").trim();
  if (s && !list.includes(s)) list.push(s);
  return list;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(raw: unknown): raw is string {
  if (typeof raw !== "string" || !DAY.test(raw)) return false;
  const t = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === raw;
}

/** Today in London, `YYYY-MM-DD`. */
export function londonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Days after which a date's ECB rate is settled. The day's fixing appears
 * around 16:00 CET; before then, and over weekends and holidays, Frankfurter
 * answers with an earlier business day. A few days covers a long weekend.
 */
export const RATE_SETTLES_AFTER_DAYS = 4;

/**
 * Whether an answer for `requested` may be cached under that date for good:
 * the service answered for that very day, or the day is far enough in the
 * past that no later fixing can still appear for it (a weekend or holiday is
 * then rightly given the business day before).
 */
export function rateIsFinal(requested: string, answeredFor: string | null | undefined, today: string): boolean {
  if (answeredFor === requested) return true;
  return requested <= addDays(today, -RATE_SETTLES_AFTER_DAYS);
}

/** Whether a sale date can have a rate at all: a real date, not in the future. */
export function canHaveRate(date: string | null | undefined, today: string): date is string {
  return isIsoDate(date) && date <= today;
}

/**
 * A stored rate worked out from two amounts (foreign → £), or null when it
 * cannot be (either missing, or a zero cost). Not rounded to two decimals: a
 * yen rate is 0.005…, which two decimals turn into 0.01 or 0. Eight
 * significant figures keep it exact enough to convert back to the penny.
 */
export function derivedRate(gbp: number | null, amount: number | null): number | null {
  if (gbp == null || amount == null || amount === 0) return null;
  const r = gbp / amount;
  return Number.isFinite(r) && r > 0 ? Number(r.toPrecision(8)) : null;
}

/** Two money figures that are the same to the penny (numbers, or null for none). */
export function samePence(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.round(a * 100) === Math.round(b * 100);
}

/**
 * The Cost £ the editor shows when a record opens, from the stored figures
 * as the form holds them ("" for none). A GBP purchase with no £ on record
 * (a GBP invoice pushed from the capture app stores the cost only) shows its
 * cost as the £, and `derived` says so: the editor then marks the field with
 * the stored value (none, `data-saved=""`), so its first save lists the £
 * as changed and stores it (lib/form-snapshot.ts). Otherwise the stored £.
 */
export function openingPurchaseGbp(stored: { cost: string; currency: string; gbp: string }): {
  shown: string;
  derived: boolean;
} {
  const derived = currencyCode(stored.currency) === "GBP" && stored.gbp === "" && stored.cost !== "";
  return { shown: derived ? stored.cost : stored.gbp, derived };
}

export type SaleInputs = { price: number | null; currency: string | null; date: string | null };
export type StoredSale = SaleInputs & { gbp: number | null };

const sameCurrency = (a: string | null, b: string | null) =>
  (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();

/**
 * Whether a save should (re)convert the sale £ from the spot rate. Only when
 * there is a price, and then: nothing is stored yet, the price, currency or
 * sale date changed, or the sale is so recent that its rate may not have been
 * final when it was converted. Otherwise a recorded sale keeps its £ (and its
 * rate): an unrelated edit, say of the title, never re-derives figures in a
 * VAT quarter that may already be filed.
 */
export function shouldConvertSale(now: SaleInputs, stored: StoredSale | null, today: string): boolean {
  if (now.price == null) return false;
  if (!stored || stored.gbp == null) return true;
  if (!samePence(now.price, stored.price)) return true;
  if (!sameCurrency(now.currency, stored.currency)) return true;
  if ((now.date ?? null) !== (stored.date ?? null)) return true;
  return now.date != null && now.date > addDays(today, -RATE_SETTLES_AFTER_DAYS);
}

/**
 * Whether a spot conversion is possible for these inputs at all: a currency
 * we know and, unless it is GBP, a sale date that can have a rate. When it is
 * not, the Sold £ is typed by hand.
 */
export function canConvertSale(now: SaleInputs, today: string): boolean {
  const code = currencyCode(now.currency);
  if (!code) return false;
  return code === "GBP" || canHaveRate(now.date, today);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

/**
 * Spot GBP rate for a currency on a date, from the exchange_rates cache or
 * the Frankfurter API (ECB reference rates). Null when there is none: an
 * unknown currency, no date or a future one, or the service not answering
 * within a few seconds (the save then keeps the £ typed by hand). Only a
 * final answer is cached (rateIsFinal); a provisional one is used and asked
 * again next time.
 */
export async function spotRateToGbp(
  supabase: Db,
  currency: string | null | undefined,
  date: string | null | undefined,
  today: string = londonToday(),
): Promise<number | null> {
  const code = currencyCode(currency);
  if (!code) return null;
  if (code === "GBP") return 1;
  if (!canHaveRate(date, today)) return null;

  const { data: cached } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base", code)
    .eq("quote", "GBP")
    .eq("as_of", date)
    .maybeSingle();
  if (cached?.rate != null && Number.isFinite(Number(cached.rate))) return Number(cached.rate);

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${date}?from=${code}&to=GBP`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { date?: string; rates?: { GBP?: number } };
    const rate = json?.rates?.GBP;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
    if (rateIsFinal(date, json.date, today)) {
      // Only an admin may write the cache (RLS); for anyone else this is a
      // no-op and the rate is simply looked up again next time.
      await supabase
        .from("exchange_rates")
        .upsert({ base: code, quote: "GBP", rate, as_of: date }, { onConflict: "base,quote,as_of" });
    }
    return rate;
  } catch {
    return null;
  }
}
