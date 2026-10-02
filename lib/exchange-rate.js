const FRANKFURTER_BASE_URL = "https://api.frankfurter.dev/v2/rate";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // Frankfurter/ECB rates only change once/day, no need to refetch often
const FETCH_TIMEOUT_MS = 8000;

/** Foreign currencies a material cost can be entered in (converted to KWD). */
export const FX_CURRENCIES = ["USD", "EUR"];

const cache = new Map(); // currency -> { rate, date, fetchedAt }

/**
 * Server-only <currency>->KWD rate lookup, proxied through this module so
 * the external call and its API shape live in exactly one place. Cached in
 * memory per currency per warm server instance; falls back to a stale
 * cached rate (rather than failing outright) if Frankfurter is briefly
 * unreachable.
 */
export async function getRateToKwd(currency) {
  if (!FX_CURRENCIES.includes(currency)) {
    throw new Error(`Unsupported currency for KWD conversion: ${currency}`);
  }

  const now = Date.now();
  const cached = cache.get(currency);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, date: cached.date };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${FRANKFURTER_BASE_URL}/${currency}/KWD`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Exchange rate API responded with status ${response.status}`);
    }
    const json = await response.json();
    const rate = Number(json?.rate);
    const date = json?.date;
    if (!Number.isFinite(rate) || rate <= 0 || !date) {
      throw new Error("Exchange rate API returned an unexpected response shape");
    }
    cache.set(currency, { rate, date, fetchedAt: now });
    return { rate, date };
  } catch (error) {
    if (cached) {
      console.warn(`${currency}->KWD rate fetch failed, serving stale cached rate:`, error.message);
      return { rate: cached.rate, date: cached.date, stale: true };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
