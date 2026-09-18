const FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rate/USD/KWD";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // Frankfurter/ECB rates only change once/day, no need to refetch often
const FETCH_TIMEOUT_MS = 8000;

let cache = null; // { rate, date, fetchedAt }

/**
 * Server-only USD->KWD rate lookup, proxied through this module so the
 * external call and its API shape live in exactly one place. Cached in
 * memory per warm server instance; falls back to a stale cached rate
 * (rather than failing outright) if Frankfurter is briefly unreachable.
 */
export async function getUsdToKwdRate() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { rate: cache.rate, date: cache.date };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(FRANKFURTER_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Exchange rate API responded with status ${response.status}`);
    }
    const json = await response.json();
    const rate = Number(json?.rate);
    const date = json?.date;
    if (!Number.isFinite(rate) || rate <= 0 || !date) {
      throw new Error("Exchange rate API returned an unexpected response shape");
    }
    cache = { rate, date, fetchedAt: now };
    return { rate, date };
  } catch (error) {
    if (cache) {
      console.warn("Exchange rate fetch failed, serving stale cached rate:", error.message);
      return { rate: cache.rate, date: cache.date, stale: true };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
