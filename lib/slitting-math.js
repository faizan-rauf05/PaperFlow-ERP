import { MATERIAL_SUGGESTION_CONSTANTS as C } from "@/lib/material-constants";
import { computePaperWeightKg } from "@/lib/paper-sizing";

/**
 * Client-safe slitting math, shared by the stage forms (preview) and the
 * stage engine (validation), so both agree.
 *
 * The parent roll (width `parentWidthCm`) is slit lengthwise: `bagWidthCm`
 * goes on to make the bags, `stripCount` recycled strips of `stripWidthCm`
 * become their own rolls, and the width left over is waste. Every piece runs
 * the full slit length: the input meters minus any length returned to the
 * parent roll. Returns `error` (a message) when the numbers don't fit.
 */
export function computeSlitting({ inputMeters, lengthRestockMeters = 0, parentWidthCm, bagWidthCm, gsm, stripCount, stripWidthCm }) {
  const input = Number(inputMeters) || 0;
  const restock = Math.max(0, Number(lengthRestockMeters) || 0);
  const parentW = Number(parentWidthCm) || 0;
  const bagW = Number(bagWidthCm) || 0;
  const count = Number(stripCount) || 0;
  const stripW = count > 0 ? Number(stripWidthCm) || 0 : 0;

  const lengthM = Math.max(0, input - restock);
  const leftoverCm = Math.round((parentW - bagW) * 10) / 10;
  const wasteWidthCm = Math.round((leftoverCm - count * stripW) * 10) / 10;
  const weight = (widthCm) => (gsm ? computePaperWeightKg(lengthM, widthCm, gsm) : null);

  let error = null;
  if (!parentW || !bagW) error = "The paper roll or bag width is unknown";
  else if (leftoverCm < 0) error = `The ${parentW} cm roll is narrower than the ${bagW} cm the bag needs`;
  else if (restock > input) error = "Length returned can't be more than the input length";
  else if (!Number.isInteger(count) || count < 0) error = "Enter a whole number of recycled rolls";
  else if (count > 0 && (stripW < C.RECYCLE_STRIP_MIN_CM || stripW > C.RECYCLE_STRIP_MAX_CM)) {
    error = `Recycled roll width must be ${C.RECYCLE_STRIP_MIN_CM}–${C.RECYCLE_STRIP_MAX_CM} cm`;
  } else if (wasteWidthCm < 0) error = `${count} × ${stripW} cm is more than the ${leftoverCm} cm left over`;

  return {
    lengthM,
    leftoverCm,
    wasteWidthCm: Math.max(wasteWidthCm, 0),
    stripWeightKg: count > 0 ? weight(stripW) : null,
    wasteKg: weight(Math.max(wasteWidthCm, 0)),
    error,
  };
}
