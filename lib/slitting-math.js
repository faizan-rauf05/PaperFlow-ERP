import { computeKgPerMeter } from "@/lib/services/unit-conversion.service";

/**
 * Client-safe slitting math.
 *
 * Parent roll: length L meters, width W mm.
 * Cut width C mm → pieces = floor(W/C).
 * Usable meters for next stage = (L × pieces) − lengthRestockMeters.
 * Width remainder strip length = L meters of leftover width (W % C).
 */
export function computeSlittingPreview({
  inputMeters,
  parentWidthMm,
  cutWidthMm,
  gsm,
  lengthRestockMeters = 0,
}) {
  const input = Number(inputMeters) || 0;
  const parentW = Number(parentWidthMm) || 0;
  const cutW = Number(cutWidthMm) || 0;
  const lengthRestock = Math.max(0, Number(lengthRestockMeters) || 0);

  if (!input || !parentW || !cutW) {
    return {
      pieceCount: 0,
      usableMeters: 0,
      widthRemainderMm: 0,
      widthRemainderMeters: 0,
      lengthRestockMeters: 0,
      pieceWeightKg: null,
      totalWeightKg: null,
    };
  }

  const pieceCount = Math.floor(parentW / cutW);
  const usedWidth = pieceCount * cutW;
  const widthRemainderMm = Math.max(0, parentW - usedWidth);
  const grossUsable = input * pieceCount;
  const usableMeters = Math.max(0, grossUsable - lengthRestock);
  const widthRemainderMeters = widthRemainderMm > 0 ? input : 0;

  const rate = computeKgPerMeter({ gsm, widthMm: cutW });
  const pieceWeightKg = rate ? Number(rate.mul(input)) : null;

  return {
    pieceCount,
    usableMeters,
    widthRemainderMm,
    widthRemainderMeters,
    lengthRestockMeters: lengthRestock,
    pieceWeightKg,
    totalWeightKg: pieceWeightKg != null ? pieceWeightKg * pieceCount : null,
    /** @deprecated use widthRemainderMeters */
    remainderMeters: widthRemainderMeters,
  };
}
