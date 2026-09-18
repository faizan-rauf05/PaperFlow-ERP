import { prisma } from "@/lib/prisma";
import { getMaterialStock } from "@/lib/services/inventory.service";
import { MATERIAL_SUGGESTION_CONSTANTS as C } from "@/lib/material-constants";

/**
 * Order-line material suggestion engine.
 *
 * Turns a bag's dimensions/spec into (a) how much paper/glue/rope/ink it
 * needs and (b) which specific in-stock Material best covers that need.
 * Consumption formulas here are documented placeholders (see
 * MATERIAL_SUGGESTION_CONSTANTS) pending client confirmation; the roll
 * width formula is client-confirmed.
 */

// --- Consumption formulas -------------------------------------------------

/** Roll width required to produce a bag of given width/bottom (gusset), in cm. */
export function computeRollWidthCm(widthCm, bottomCm) {
  return (Number(widthCm) + Number(bottomCm)) * 2 + C.ROLL_WIDTH_MARGIN_CM;
}

/** Paper fed per bag along the roll's length, in cm (finished height + fold/seal allowance). */
export function computeFeedLengthCm(heightCm) {
  return Number(heightCm) + C.FEED_LENGTH_ALLOWANCE_CM;
}

/** Weight of one bag's paper, in grams. */
export function computeBagWeightG(feedLengthCm, rollWidthCm, gsm) {
  return (feedLengthCm * rollWidthCm * Number(gsm)) / 10000;
}

/** Glue used for one bag's side + bottom seams, in grams. */
export function computeGlueWeightG(feedLengthCm, bottomCm) {
  const side = feedLengthCm * C.GLUE_G_PER_CM_SIDE_SEAM;
  const bottom = Number(bottomCm) * C.GLUE_G_PER_CM_BOTTOM_SEAM;
  return side + bottom;
}

/** Handle rope used for one bag, in cm (0 when the bag has no handle). */
export function computeRopeLengthCm(withHandle) {
  return withHandle ? C.ROPE_HANDLES_PER_BAG * C.ROPE_LENGTH_CM_PER_HANDLE : 0;
}

/** Ink used for one bag's print, in grams. */
export function computeInkWeightG(feedLengthCm, rollWidthCm, colorCount) {
  if (!colorCount) return 0;
  return feedLengthCm * rollWidthCm * C.INK_G_PER_CM2_PER_COLOR * Number(colorCount);
}

/**
 * All per-bag and per-order-line (x quantity) material needs for a bag spec.
 * `orderLine` shape mirrors OrderLine: heightCm, widthCm, baseCm (bottom),
 * quantity, withHandle, colorCount. GSM isn't a need computed here — it's a
 * property of whichever roll ends up matched (see attachPaperWeight below),
 * not an input the order specifies.
 */
export function computeOrderLineMaterialNeeds(orderLine) {
  const { heightCm, widthCm, baseCm, quantity, withHandle, colorCount } = orderLine;
  const qty = Number(quantity) || 0;

  const rollWidthCm = computeRollWidthCm(widthCm, baseCm);
  const feedLengthCm = computeFeedLengthCm(heightCm);

  const perBag = {
    rollWidthCm,
    feedLengthCm,
    glueWeightG: computeGlueWeightG(feedLengthCm, baseCm),
    ropeLengthCm: computeRopeLengthCm(withHandle),
    inkWeightG: computeInkWeightG(feedLengthCm, rollWidthCm, colorCount),
  };

  return {
    rollWidthCm,
    feedLengthCm,
    paperLengthNeededM: (feedLengthCm * qty) / 100,
    glueNeededKg: (perBag.glueWeightG * qty) / 1000,
    ropeNeededM: (perBag.ropeLengthCm * qty) / 100,
    inkNeededKg: (perBag.inkWeightG * qty) / 1000,
    perBag,
  };
}

// --- Matching --------------------------------------------------------------

/**
 * Best paper roll for an order line: exact type/color match, wide enough to
 * cut the required roll width, enough remaining length, ranked by tightest
 * width fit first (minimize trim waste) then oldest stock first (FIFO).
 * GSM is not a match filter — it's a property of whichever roll wins, read
 * off the returned bestMatch and fed into computeBagWeightG afterward.
 */
export async function findBestPaperRoll({ paperType, paperColor, rollWidthCm, paperLengthNeededM }) {
  const candidates = await prisma.material.findMany({
    where: {
      materialType: "PAPER_ROLL",
      ...(paperType ? { paperType } : {}),
      ...(paperColor ? { paperColor } : {}),
      paperWidthCm: { gte: rollWidthCm },
    },
    orderBy: { receivingDate: "asc" },
  });

  const withStock = await Promise.all(
    candidates.map(async (material) => {
      const remainingM = (await getMaterialStock(material.id)).toNumber();
      return { material, remainingM };
    }),
  );

  const fitting = withStock.filter(({ remainingM }) => remainingM >= paperLengthNeededM);

  fitting.sort((a, b) => {
    const aFit = Number(a.material.paperWidthCm) - rollWidthCm;
    const bFit = Number(b.material.paperWidthCm) - rollWidthCm;
    if (aFit !== bFit) return aFit - bFit;
    return new Date(a.material.receivingDate ?? 0) - new Date(b.material.receivingDate ?? 0);
  });

  const best = fitting[0] ?? null;
  let reason = null;
  if (best) {
    const widthDeltaCm = Number(best.material.paperWidthCm) - rollWidthCm;
    reason =
      widthDeltaCm === 0
        ? `Exact width match (${rollWidthCm}cm), ${best.remainingM.toFixed(1)}m remaining on this roll.`
        : `Tightest width fit (${Number(best.material.paperWidthCm)}cm roll for ${rollWidthCm}cm needed, +${widthDeltaCm.toFixed(1)}cm trim) among ${fitting.length} roll(s) in stock, ${best.remainingM.toFixed(1)}m remaining.`;
  }

  return {
    bestMatch: best ? { ...best.material, remainingM: best.remainingM } : null,
    candidateCount: fitting.length,
    reason,
  };
}

/**
 * Best FIFO match for non-paper materials (glue, rope, ink, ...): matches on
 * type + optional spec fields, filters to candidates with enough remaining
 * stock, ranked oldest-received first.
 */
export async function findBestStockMatch({ materialType, spec = {}, quantityNeeded, unit }) {
  const candidates = await prisma.material.findMany({
    where: { materialType, ...spec },
    orderBy: { receivingDate: "asc" },
  });

  for (const material of candidates) {
    const remaining = (await getMaterialStock(material.id)).toNumber();
    if (remaining >= quantityNeeded) {
      return {
        bestMatch: { ...material, remaining, unit },
        candidateCount: candidates.length,
        reason: `Oldest matching stock (FIFO) with enough remaining quantity (${remaining.toFixed(2)} ${unit} available).`,
      };
    }
  }

  return { bestMatch: null, candidateCount: candidates.length, reason: null };
}
