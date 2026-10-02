import { Prisma } from "@prisma/client";
import { FX_CURRENCIES, getRateToKwd } from "@/lib/exchange-rate";

const { Decimal } = Prisma;

/**
 * Prices a delivery in KWD. The price is entered per unit (per kg, per m…),
 * per pack (per 25 kg pack, per roll…) or — for paper rolls, stocked in
 * meters — per kg, in KWD/USD/EUR; foreign amounts
 * are converted with the server-fetched rate — a client is never trusted to
 * supply the rate used for a monetary calculation.
 *
 * `unitsPerPack` is how many stock units one pack holds (required for
 * PER_PACK); `kgPerUnit` is how many kg one stock unit weighs (required for
 * PER_KG). Returns the per-unit and total KWD cost plus the rate snapshot
 * kept on the receipt for audit.
 */
export async function priceReceiptInKwd({ currency, entryBasis, amount, unitsPerPack, kgPerUnit, quantity }) {
  const amountDec = new Decimal(amount);
  let exchangeRate = null;
  let rateDate = null;
  let amountKwd = amountDec;

  if (currency !== "KWD") {
    if (!FX_CURRENCIES.includes(currency)) throw new Error(`Unsupported currency: ${currency}`);
    const rateInfo = await getRateToKwd(currency);
    exchangeRate = new Decimal(rateInfo.rate).toDecimalPlaces(6);
    rateDate = new Date(rateInfo.date);
    amountKwd = amountDec.mul(rateInfo.rate);
  }

  let unitCostKwd = amountKwd;
  if (entryBasis === "PER_PACK") {
    const perPack = new Decimal(unitsPerPack || 0);
    if (perPack.lte(0)) {
      const error = new Error("Can't price per pack without the pack size.");
      error.code = "COST_PRICE_DIVISOR_MISSING";
      throw error;
    }
    unitCostKwd = amountKwd.div(perPack);
  } else if (entryBasis === "PER_KG") {
    const kg = new Decimal(kgPerUnit || 0);
    if (kg.lte(0)) {
      const error = new Error("Can't price per kg without the weight.");
      error.code = "COST_PRICE_DIVISOR_MISSING";
      throw error;
    }
    unitCostKwd = amountKwd.mul(kg);
  }

  return {
    unitCostKwd: unitCostKwd.toDecimalPlaces(6),
    totalCostKwd: unitCostKwd.mul(quantity).toDecimalPlaces(4),
    exchangeRate,
    rateDate,
  };
}
