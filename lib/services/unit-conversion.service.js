import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

/**
 * Convert quantity between units for paper-bag production.
 * @param {object} params
 * @param {number|string|Decimal} params.quantity
 * @param {string} params.fromUnit
 * @param {string} params.toUnit
 * @param {object} [params.context] - roll or bagSpec metadata
 */
export function convertQuantity({ quantity, fromUnit, toUnit, context = {} }) {
  const qty = new Decimal(quantity?.toString() ?? "0");
  if (fromUnit === toUnit) return qty;

  const { kgPerMeter, lengthM, weightKg, bagsPerMeter, bagsPerCarton = 500 } = context;

  // kg <-> meter via roll or material kgPerMeter
  if (fromUnit === "KG" && toUnit === "METER") {
    const rate = kgPerMeter || (weightKg && lengthM ? new Decimal(weightKg).div(lengthM) : null);
    if (!rate || rate.isZero()) throw new Error("Cannot convert KG to METER: missing kgPerMeter");
    return qty.div(rate);
  }
  if (fromUnit === "METER" && toUnit === "KG") {
    const rate = kgPerMeter || (weightKg && lengthM ? new Decimal(weightKg).div(lengthM) : null);
    if (!rate) throw new Error("Cannot convert METER to KG: missing kgPerMeter");
    return qty.mul(rate);
  }

  // meter -> bags via bag spec
  if (fromUnit === "METER" && toUnit === "BAG") {
    if (!bagsPerMeter) throw new Error("Cannot convert METER to BAG: missing bagsPerMeter");
    return qty.mul(bagsPerMeter);
  }
  if (fromUnit === "BAG" && toUnit === "METER") {
    if (!bagsPerMeter) throw new Error("Cannot convert BAG to METER: missing bagsPerMeter");
    return qty.div(bagsPerMeter);
  }

  // bag -> carton
  if (fromUnit === "BAG" && toUnit === "CARTON") {
    return qty.div(bagsPerCarton);
  }
  if (fromUnit === "CARTON" && toUnit === "BAG") {
    return qty.mul(bagsPerCarton);
  }

  // bag <-> pcs (handles)
  const { handlesPerBag = 2 } = context;
  if (fromUnit === "BAG" && toUnit === "PCS") {
    return qty.mul(handlesPerBag);
  }
  if (fromUnit === "PCS" && toUnit === "BAG") {
    return qty.div(handlesPerBag);
  }

  throw new Error(`Unsupported conversion: ${fromUnit} → ${toUnit}`);
}

export function computeKgPerMeter({ gsm, widthMm }) {
  if (!gsm || !widthMm) return null;
  // kg/m = gsm * width(m) / 1000
  return new Decimal(gsm).mul(widthMm).div(1000).div(1000);
}

export function computeBagsPerMeter({ bagWidthMm, repeatLengthMm }) {
  if (!bagWidthMm || !repeatLengthMm) return null;
  const bagsPerRepeat = new Decimal(1000).div(bagWidthMm);
  const repeatsPerMeter = new Decimal(1000).div(repeatLengthMm);
  return bagsPerRepeat.mul(repeatsPerMeter);
}
