/** Client-safe conversion hints for worker stage forms. */
export function getConversionHint({ quantity, fromUnit, toUnit, roll, bagSpec }) {
  const qty = parseFloat(quantity);
  if (!qty || Number.isNaN(qty)) return null;

  try {
    const kgPerMeter =
      roll?.material?.kgPerMeter ??
      (roll?.weightKg && roll?.lengthM ? roll.weightKg / roll.lengthM : null);

    if (fromUnit === "METER" && toUnit === "KG" && kgPerMeter) {
      return `≈ ${(qty * kgPerMeter).toFixed(2)} kg`;
    }
    if (fromUnit === "METER" && toUnit === "BAG" && bagSpec?.bagsPerMeter) {
      return `≈ ${(qty * bagSpec.bagsPerMeter).toFixed(1)} bags`;
    }
    if (fromUnit === "BAG" && toUnit === "CARTON") {
      return `≈ ${(qty / 500).toFixed(2)} cartons`;
    }
    if (fromUnit === "BAG" && toUnit === "PCS" && bagSpec?.handlesPerBag) {
      return `≈ ${(qty * bagSpec.handlesPerBag).toFixed(0)} handles`;
    }
    if (fromUnit === "PCS" && toUnit === "BAG" && bagSpec?.handlesPerBag) {
      return `≈ ${(qty / bagSpec.handlesPerBag).toFixed(1)} bags`;
    }
  } catch {
    return null;
  }
  return null;
}
