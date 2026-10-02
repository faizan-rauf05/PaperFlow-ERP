import { prisma } from "@/lib/prisma";
import { getStockByMaterial } from "@/lib/services/stock.service";
import { MATERIAL_SUGGESTION_CONSTANTS as C } from "@/lib/material-constants";
import {
  computeBagHeightCm,
  computeBagWeightG,
  computeInkKwdPerBag,
  computeInkWeightG,
  computePaperWeightKg,
  computeRollWidthCm,
} from "@/lib/paper-sizing";

export { computeBagHeightCm, computeBagWeightG, computeRollWidthCm };

/**
 * Order-line material suggestion engine.
 *
 * Turns a bag's dimensions/spec into (a) how much paper/glue/rope/ink it
 * needs and (b) which specific in-stock Material best covers that need.
 * Paper sizing, glue and ink cost rates are client-confirmed; rope and the
 * ink quantity are still placeholders (see MATERIAL_SUGGESTION_CONSTANTS). The sizing math itself is
 * client-safe, in lib/paper-sizing.js.
 *
 * The bag's paper height is rounded to a machine height for these figures
 * only — the order line keeps (and the UI shows) the height as entered.
 */

// --- Consumption formulas -------------------------------------------------

const round2 = (n) => Math.round(n * 100) / 100;

/** Cold glue cost for one bag, in KWD — handles take 50% extra. */
export function computeColdGlueKwdPerBag(withHandle) {
  const kwd = C.COLD_GLUE_KWD_PER_BAG * (withHandle ? 1 + C.COLD_GLUE_HANDLE_EXTRA : 1);
  return Math.round(kwd * 1e6) / 1e6; // 0.001 × 1.5 is 0.0015000000000000002 in floating point
}

/** Handle rope used for one bag, in cm (0 when the bag has no handle). */
export function computeRopeLengthCm(withHandle) {
  return withHandle ? C.ROPE_HANDLES_PER_BAG * C.ROPE_LENGTH_CM_PER_HANDLE : 0;
}

/**
 * Expected glue (side and bottom seams, kg) and handle rope (m) for ONE bag
 * of an order line — the "planned" side of production consumption records.
 */
export function computePerBagConsumption(orderLine) {
  const { bagHeightCm: feedLengthCm } = computeBagHeightCm(orderLine.heightCm, orderLine.baseCm);
  return {
    glueSideKg: (feedLengthCm * C.GLUE_G_PER_CM_SIDE_SEAM) / 1000,
    glueBottomKg: (Number(orderLine.baseCm) * C.GLUE_G_PER_CM_BOTTOM_SEAM) / 1000,
    ropeM: computeRopeLengthCm(orderLine.withHandle) / 100,
  };
}

/**
 * All per-bag and per-order-line (x quantity) material needs for a bag spec.
 * `orderLine` shape mirrors OrderLine: heightCm, widthCm, baseCm (bottom),
 * quantity, withHandle, colorCount. GSM isn't a need computed here — it's a
 * property of whichever roll ends up matched, not an input the order specifies.
 */
export function computeOrderLineMaterialNeeds(orderLine) {
  const { heightCm, widthCm, baseCm, quantity, withHandle, colorCount } = orderLine;
  const qty = Number(quantity) || 0;

  const rollWidthCm = computeRollWidthCm(widthCm, baseCm);
  const { bottomAllowanceCm, rawHeightCm, bagHeightCm } = computeBagHeightCm(heightCm, baseCm);
  const coldGlueKwdPerBag = computeColdGlueKwdPerBag(withHandle);
  const paperLengthM = (bagHeightCm * qty) / 100;

  const perBag = {
    rollWidthCm,
    bagHeightCm,
    hotGlueKg: withHandle ? C.HOT_GLUE_KG_PER_HANDLE_BAG : 0,
    coldGlueKwd: coldGlueKwdPerBag,
    coreGlueKwd: C.CORE_GLUE_KWD_PER_BAG,
    ropeLengthCm: computeRopeLengthCm(withHandle),
    inkKwd: computeInkKwdPerBag(bagHeightCm, rollWidthCm, colorCount),
    inkWeightG: computeInkWeightG(bagHeightCm, rollWidthCm, colorCount),
  };

  return {
    quantity: qty,
    rollWidthCm,
    bottomAllowanceCm,
    rawHeightCm,
    bagHeightCm,
    paperLengthM,
    paperLengthNeededM: round2(paperLengthM * (1 + C.PAPER_LENGTH_WASTAGE)),
    hotGlueNeededKg: perBag.hotGlueKg * qty,
    coldGlueCostKwd: perBag.coldGlueKwd * qty,
    coreGlueCostKwd: perBag.coreGlueKwd * qty,
    ropeNeededM: (perBag.ropeLengthCm * qty) / 100,
    inkCostKwd: perBag.inkKwd * qty,
    inkNeededKg: (perBag.inkWeightG * qty) / 1000,
    perBag,
  };
}

/**
 * Paper cost for `lengthM` meters of a roll, as the average of two methods,
 * because a supplier's label length or weight can be wrong:
 *  - by length: meters × cost per meter;
 *  - by weight: the paper's weight (meters × roll width × GSM) × cost per kg,
 *    where cost per kg = what the roll cost ÷ its label weight.
 * Both price the full roll width that comes off the roll.
 */
export function computePaperCost(roll, lengthM) {
  const costPerM = Number(roll.averageCostKwd || 0);
  const labelLengthM = Number(roll.paperLengthM);
  const labelWeightKg = Number(roll.weightKg);
  const costPerKg = (costPerM * labelLengthM) / labelWeightKg;
  const weightKg = computePaperWeightKg(lengthM, roll.paperWidthCm, roll.gsm);
  const byLength = lengthM * costPerM;
  const byWeight = weightKg * costPerKg;
  return { costPerM, costPerKg, weightKg, byLength, byWeight, average: (byLength + byWeight) / 2 };
}

/** How the paper height and roll width were worked out, in words, for a line's recommendations. */
export function describePaperSizing(orderLine, needs) {
  const { heightCm, widthCm, baseCm } = orderLine;
  const heights = C.MACHINE_HEIGHTS_CM;
  const why =
    needs.rawHeightCm > heights[heights.length - 1]
      ? "the machine's maximum height"
      : needs.rawHeightCm < heights[0]
        ? "the machine's minimum height"
        : `nearest machine height: ${heights.join("/")}cm`;
  const rounding =
    needs.rawHeightCm === needs.bagHeightCm
      ? `${needs.bagHeightCm}cm (a machine height)`
      : `${needs.rawHeightCm}cm → ${needs.bagHeightCm}cm (${why})`;
  return (
    `Paper height: ${Number(heightCm)} + ${Number(baseCm)}×2/3 (${needs.bottomAllowanceCm}) = ${rounding}. ` +
    `Roll width: (${Number(widthCm)} + ${Number(baseCm)}) × 2 + ${C.ROLL_WIDTH_MARGIN_CM} = ${needs.rollWidthCm}cm. ` +
    `Paper: ${needs.bagHeightCm}cm × ${needs.quantity.toLocaleString()} bags = ${round2(needs.paperLengthM).toLocaleString()}m ` +
    `+ ${C.PAPER_LENGTH_WASTAGE * 100}% wastage = ${needs.paperLengthNeededM.toLocaleString()}m.`
  );
}

// --- Matching --------------------------------------------------------------

/** Material types the suggestion engine matches against stock. */
const MATCHED_MATERIAL_TYPES = ["PAPER_ROLL", "GLUE", "ROPE", "INK"];

/**
 * One snapshot of every matchable material with its total stock, oldest
 * first — loaded once per order save so every line's matching runs in
 * memory instead of querying stock per line and per material.
 */
export async function loadStockCatalog(db = prisma) {
  const materials = await db.material.findMany({
    where: { materialType: { in: MATCHED_MATERIAL_TYPES } },
    orderBy: { createdAt: "asc" },
  });
  const stock = await getStockByMaterial(materials.map((m) => m.id), db);
  return materials.map((material) => ({ material, remaining: stock.get(material.id).total }));
}

/**
 * Best paper roll for an order line: exact type/color match, wide enough to
 * cut the required roll width, enough remaining length, ranked by tightest
 * width fit first (minimize trim waste) then oldest stock first (FIFO).
 * GSM is not a match filter — it's a property of whichever roll wins, read
 * off the returned bestMatch and fed into computeBagWeightG afterward.
 */
export function findBestPaperRoll(catalog, { paperType, paperColor, rollWidthCm, paperLengthNeededM }) {
  const fitting = catalog
    .filter(
      ({ material: m, remaining }) =>
        m.materialType === "PAPER_ROLL" &&
        (!paperType || m.paperType === paperType) &&
        (!paperColor || m.paperColor === paperColor) &&
        m.paperWidthCm != null &&
        Number(m.paperWidthCm) >= rollWidthCm &&
        remaining >= paperLengthNeededM,
    )
    .map(({ material, remaining }) => ({ material, remainingM: remaining }));

  fitting.sort((a, b) => {
    const aFit = Number(a.material.paperWidthCm) - rollWidthCm;
    const bFit = Number(b.material.paperWidthCm) - rollWidthCm;
    if (aFit !== bFit) return aFit - bFit;
    return new Date(a.material.createdAt) - new Date(b.material.createdAt);
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
 * stock, ranked oldest-received first (the catalog's order).
 */
export function findBestStockMatch(catalog, { materialType, spec = {}, quantityNeeded, unit }) {
  const candidates = catalog.filter(
    ({ material: m }) =>
      m.materialType === materialType && Object.entries(spec).every(([field, value]) => m[field] === value),
  );
  const match = candidates.find(({ remaining }) => remaining >= quantityNeeded);
  if (!match) return { bestMatch: null, candidateCount: candidates.length, reason: null };
  return {
    bestMatch: { ...match.material, remaining: match.remaining, unit },
    candidateCount: candidates.length,
    reason: `Oldest matching stock (FIFO) with enough remaining quantity (${match.remaining.toFixed(2)} ${unit} available).`,
  };
}
