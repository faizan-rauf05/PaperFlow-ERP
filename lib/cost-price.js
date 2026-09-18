import { Prisma } from "@prisma/client";
import { getUsdToKwdRate } from "@/lib/exchange-rate";
import { COST_PACK_DIVISOR_FIELD_BY_TYPE, supportsPackCostEntry } from "@/lib/material-constants";

const { Decimal } = Prisma;

function round2(value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function getPackDivisor(materialType, record) {
  const field = COST_PACK_DIVISOR_FIELD_BY_TYPE[materialType];
  if (!field) return null;
  const raw = record[field];
  const value = raw != null ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * True when none of the cost inputs (amount, currency, entry basis, or —
 * for pack-priced materials — the pack size itself) changed from what's
 * already stored. Used on edit so an unrelated field change (e.g. fixing
 * the supplier) doesn't silently overwrite the "rate applied on this
 * date" audit trail with a fresh fetch.
 */
function costInputsUnchanged(materialType, record, existing) {
  if (!existing) return false;
  if (existing.costPriceCurrency !== record.costPriceCurrency) return false;
  if (existing.costPriceEntryBasis !== record.costPriceEntryBasis) return false;

  const existingAmount =
    existing.costPriceOriginalAmount != null ? Number(existing.costPriceOriginalAmount) : null;
  const incomingAmount = record.costPriceAmount != null ? Number(record.costPriceAmount) : null;
  if (existingAmount !== incomingAmount) return false;

  if (record.costPriceEntryBasis === "PER_PACK") {
    const field = COST_PACK_DIVISOR_FIELD_BY_TYPE[materialType];
    const existingDivisor = existing[field] != null ? Number(existing[field]) : null;
    const incomingDivisor = record[field] != null ? Number(record[field]) : null;
    if (existingDivisor !== incomingDivisor) return false;
  }

  return true;
}

const EMPTY_COST_FIELDS = {
  costPricePerUnit: null,
  costPriceCurrency: null,
  costPriceEntryBasis: null,
  costPriceOriginalAmount: null,
  costPriceExchangeRate: null,
  costPriceRateDate: null,
};

/**
 * Computes the cost-price columns to persist on a Material.
 *
 * `record` must contain buildMaterialRecord()'s output (so pack-divisor
 * fields like weightKg/ropeLengthM/cartonsPerBundle are already resolved)
 * merged with the raw costPriceAmount/costPriceCurrency/costPriceEntryBasis
 * input fields. `existing` is the current DB row when updating, or null
 * when creating.
 *
 * The exchange rate is always fetched/verified server-side — a client is
 * never trusted to supply the rate used for a monetary calculation.
 */
export async function resolveCostPriceFields(materialType, record, existing = null) {
  if (record.costPriceAmount == null) {
    return { ...EMPTY_COST_FIELDS };
  }

  const currency = record.costPriceCurrency === "USD" ? "USD" : "KWD";
  const entryBasis =
    supportsPackCostEntry(materialType) && record.costPriceEntryBasis === "PER_PACK"
      ? "PER_PACK"
      : "PER_UNIT";

  const normalized = { ...record, costPriceCurrency: currency, costPriceEntryBasis: entryBasis };

  if (costInputsUnchanged(materialType, normalized, existing)) {
    return {
      costPricePerUnit: existing.costPricePerUnit,
      costPriceCurrency: existing.costPriceCurrency,
      costPriceEntryBasis: existing.costPriceEntryBasis,
      costPriceOriginalAmount: existing.costPriceOriginalAmount,
      costPriceExchangeRate: existing.costPriceExchangeRate,
      costPriceRateDate: existing.costPriceRateDate,
    };
  }

  const amount = Number(record.costPriceAmount);
  let exchangeRate = null;
  let rateDate = null;
  let amountKwd = amount;

  if (currency === "USD") {
    const rateInfo = await getUsdToKwdRate();
    exchangeRate = rateInfo.rate;
    rateDate = new Date(rateInfo.date);
    amountKwd = amount * rateInfo.rate;
  }

  let perUnit = amountKwd;
  if (entryBasis === "PER_PACK") {
    const divisor = getPackDivisor(materialType, record);
    if (!divisor) {
      const error = new Error(
        "Cannot compute the per-unit cost: the pack size (weight/length/count) is missing or zero.",
      );
      error.code = "COST_PRICE_DIVISOR_MISSING";
      throw error;
    }
    perUnit = amountKwd / divisor;
  }

  return {
    costPricePerUnit: round2(perUnit),
    costPriceCurrency: currency,
    costPriceEntryBasis: entryBasis,
    costPriceOriginalAmount: round2(amount),
    costPriceExchangeRate: exchangeRate != null ? new Decimal(exchangeRate).toDecimalPlaces(6) : null,
    costPriceRateDate: rateDate,
  };
}
