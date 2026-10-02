import { MATERIAL_SUGGESTION_CONSTANTS as C } from "@/lib/material-constants";

/**
 * Client-safe paper sizing math for an order line (no database access), so
 * the UI can show the same figures the suggestion engine
 * (lib/material-suggestion.js) costs with.
 *
 * "Calculated height" is the bag's paper height rounded to a machine height;
 * "calculated width" is the roll width the bag needs. The order line keeps
 * (and the UI shows) its dimensions as entered.
 */

const round2 = (n) => Math.round(n * 100) / 100;

/** Roll width required to produce a bag of given width/bottom (gusset), in cm. */
export function computeRollWidthCm(widthCm, bottomCm) {
  return (Number(widthCm) + Number(bottomCm)) * 2 + C.ROLL_WIDTH_MARGIN_CM;
}

/**
 * Paper cut per bag along the roll, in cm: height + bottom x 2/3, rounded to
 * the nearest machine height (ties round up, beyond either end clamps to it).
 */
export function computeBagHeightCm(heightCm, bottomCm) {
  const bottomAllowanceCm = round2((Number(bottomCm) * 2) / 3);
  const rawHeightCm = round2(Number(heightCm) + bottomAllowanceCm);
  let bagHeightCm = C.MACHINE_HEIGHTS_CM[0];
  for (const h of C.MACHINE_HEIGHTS_CM) {
    if (Math.abs(h - rawHeightCm) <= Math.abs(bagHeightCm - rawHeightCm)) bagHeightCm = h;
  }
  return { bottomAllowanceCm, rawHeightCm, bagHeightCm };
}

/** Weight of one bag's paper, in grams: calculated height × calculated width × GSM. */
export function computeBagWeightG(bagHeightCm, rollWidthCm, gsm) {
  return (bagHeightCm * rollWidthCm * Number(gsm)) / 10000;
}

/** Weight of `lengthM` meters of a roll `widthCm` wide, in kg. */
export function computePaperWeightKg(lengthM, widthCm, gsm) {
  return (Number(lengthM) * (Number(widthCm) / 100) * Number(gsm)) / 1000;
}

/**
 * Ink cost for one bag, in KWD: a fixed rate over the bag's full paper area
 * (calculated height × calculated width), charged once however many colors
 * are printed. Plain bags (0 colors) use no ink.
 */
export function computeInkKwdPerBag(bagHeightCm, rollWidthCm, colorCount) {
  if (!(Number(colorCount) > 0)) return 0;
  return bagHeightCm * rollWidthCm * C.INK_KWD_PER_CM2;
}

/**
 * How a roll is slit for a bag: the bag's width is kept, and the leftover
 * width is cut into as many recycled strips of RECYCLE_STRIP_MIN_CM as fit,
 * each widened (to the mm) up to RECYCLE_STRIP_MAX_CM; the rest is waste.
 * E.g. 101 cm roll, 79 cm bag: 22 cm leftover → 2 × 9 cm + 4 cm waste;
 * 26 cm leftover → 3 × 8.6 cm + 0.2 cm waste.
 */
export function planSlitting(rollWidthCm, bagWidthCm) {
  const leftoverCm = Math.round((Number(rollWidthCm) - Number(bagWidthCm)) * 10) / 10;
  if (!(leftoverCm > 0)) return { leftoverCm: Math.max(leftoverCm, 0), stripCount: 0, stripWidthCm: 0, wasteCm: 0 };
  const stripCount = Math.floor(leftoverCm / C.RECYCLE_STRIP_MIN_CM + 1e-9);
  const stripWidthCm = stripCount
    ? Math.min(C.RECYCLE_STRIP_MAX_CM, Math.floor((leftoverCm / stripCount) * 10 + 1e-9) / 10)
    : 0;
  const wasteCm = Math.round((leftoverCm - stripCount * stripWidthCm) * 10) / 10;
  return { leftoverCm, stripCount, stripWidthCm, wasteCm };
}

/** Ink used for one bag, in grams — the pick quantity (its cost is computeInkKwdPerBag). */
export function computeInkWeightG(bagHeightCm, rollWidthCm, colorCount) {
  if (!(Number(colorCount) > 0)) return 0;
  return bagHeightCm * rollWidthCm * C.INK_G_PER_CM2;
}

/**
 * An order line's bag weight on a roll of the given GSM: per bag (g) and for
 * the whole line (kg), with the calculated sizes it's worked out from.
 * Null without a GSM (no roll matched).
 */
export function lineBagWeight(line, gsm) {
  if (!gsm) return null;
  const rollWidthCm = computeRollWidthCm(line.widthCm, line.baseCm);
  const { bagHeightCm } = computeBagHeightCm(line.heightCm, line.baseCm);
  const perBagG = computeBagWeightG(bagHeightCm, rollWidthCm, gsm);
  const quantity = Number(line.quantity ?? line.plannedQty) || 0;
  return { bagHeightCm, rollWidthCm, gsm: Number(gsm), perBagG, totalKg: (perBagG * quantity) / 1000 };
}

/** "31.6 g" / "31.6 kg" with up to 2 decimals. */
export function formatWeight(value, unit) {
  return `${Number(value.toFixed(2)).toLocaleString()} ${unit}`;
}

/** lineBagWeight on the GSM of the roll matched to the line (its ROLL suggestion). */
export function matchedRollBagWeight(line) {
  const roll = (line.suggestedMaterials || []).find((sm) => sm.role === "ROLL")?.material;
  return lineBagWeight(line, roll?.gsm);
}

/** "31.6 g (40 × 79 cm × 100 gsm)" — a bag weight with how it was worked out. */
export function bagWeightLabel(weight) {
  return `${formatWeight(weight.perBagG, "g")} (${weight.bagHeightCm} × ${weight.rollWidthCm} cm × ${weight.gsm} gsm)`;
}
