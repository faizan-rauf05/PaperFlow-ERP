import { computeKgPerMeter } from "@/lib/services/unit-conversion.service";

/**
 * Client-safe slitting math (no Prisma).
 */
export function computeSlittingPreview({
  inputMeters,
  parentWidthMm,
  cutWidthMm,
  gsm,
}) {
  const input = Number(inputMeters) || 0;
  const parentW = Number(parentWidthMm) || 0;
  const cutW = Number(cutWidthMm) || 0;
  if (!input || !parentW || !cutW) {
    return { pieceCount: 0, usableMeters: 0, remainderMeters: 0, pieceWeightKg: null, totalWeightKg: null };
  }
  const pieceCount = Math.floor(parentW / cutW);
  const usedWidth = pieceCount * cutW;
  const remainderWidthRatio = parentW > 0 ? (parentW - usedWidth) / parentW : 0;
  const remainderMeters = input * remainderWidthRatio;
  const rate = computeKgPerMeter({ gsm, widthMm: cutW });
  const pieceWeightKg = rate ? Number(rate.mul(input)) : null;
  return {
    pieceCount,
    usableMeters: input,
    remainderMeters,
    pieceWeightKg,
    totalWeightKg: pieceWeightKg != null ? pieceWeightKg * pieceCount : null,
  };
}
