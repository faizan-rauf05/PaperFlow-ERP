import { formatQuantity } from "@/lib/material-catalog";

/**
 * Shared helpers for the stage record forms (worker + admin). Production draws
 * from FACTORY stock only, so every picker shows and sorts by factory stock.
 */

export function factoryStock(material) {
  return Number(material?.stock?.FACTORY ?? 0);
}

export function factoryStockLabel(material) {
  return `Factory: ${formatQuantity(factoryStock(material), material?.unit)}`;
}

/** Materials with factory stock first; otherwise keeps the API order. */
export function sortByFactoryStock(materials) {
  return [...(materials || [])].sort(
    (a, b) => (factoryStock(b) > 0) - (factoryStock(a) > 0),
  );
}

/** Catalog materials exist once per supplier, so the supplier disambiguates. */
export function catalogMaterialLabel(material) {
  return material?.supplier?.name
    ? `${material.name} · ${material.supplier.name}`
    : material?.name || "";
}

export function catalogMaterialOptions(materials) {
  return sortByFactoryStock(materials).map((m) => ({
    value: m.id,
    label: catalogMaterialLabel(m),
    description: factoryStockLabel(m),
  }));
}

/** Glue and rope used at Handle Making & Pasting, as the record API expects them. */
export const HANDLE_CONSUMPTIONS = [
  {
    kind: "GLUE_SIDE",
    label: "Side glue",
    materialType: "GLUE",
    unit: "KG",
    perBagKey: "glueSideKg",
    qtyField: "glueSideQty",
    materialField: "glueSideMaterialId",
  },
  {
    kind: "GLUE_BOTTOM",
    label: "Bottom glue",
    materialType: "GLUE",
    unit: "KG",
    perBagKey: "glueBottomKg",
    qtyField: "glueBottomQty",
    materialField: "glueBottomMaterialId",
  },
  {
    kind: "HANDLE_ROPE",
    label: "Handle rope",
    materialType: "ROPE",
    unit: "METER",
    perBagKey: "ropeM",
    qtyField: "ropeQty",
    materialField: "ropeMaterialId",
  },
];

/** Planned usage for `bags` bags (per-bag amount from the record context), or null. */
export function plannedConsumption(perBagConsumption, perBagKey, bags) {
  const perBag = Number(perBagConsumption?.[perBagKey]);
  const count = Number(bags);
  if (!Number.isFinite(perBag) || !(count > 0)) return null;
  return Math.round(perBag * count * 10000) / 10000;
}

/**
 * Initial handle-consumption form values: previously recorded actuals when the
 * stage carries them (re-recording), otherwise blank (= planned on the server).
 * A material is preselected when it's the only one of its type.
 */
export function initialHandleConsumptions(consumptions, materialsByType = {}) {
  const values = {};
  for (const c of HANDLE_CONSUMPTIONS) {
    const prev = consumptions?.find((x) => x.consumptionKind === c.kind);
    const candidates = materialsByType[c.materialType] || [];
    values[c.qtyField] = prev?.actualQty != null ? String(prev.actualQty) : "";
    values[c.materialField] =
      prev?.materialId || (candidates.length === 1 ? candidates[0].id : "");
  }
  return values;
}

/** Error message per material field: a used quantity (entered or planned) needs its material. */
export function validateHandleConsumptions(values, perBagConsumption, bags) {
  const errors = {};
  for (const c of HANDLE_CONSUMPTIONS) {
    const entered = values[c.qtyField];
    const qty =
      entered !== "" && entered != null
        ? Number(entered)
        : plannedConsumption(perBagConsumption, c.perBagKey, bags) || 0;
    if (entered !== "" && entered != null && Number(entered) < 0) {
      errors[c.qtyField] = `${c.label} can't be negative`;
    } else if (qty > 0 && !values[c.materialField]) {
      errors[c.materialField] = `Select which ${c.label.toLowerCase()} was used`;
    }
  }
  return errors;
}

/** Payload fields for the record API (blank quantity → server uses planned). */
export function handleConsumptionPayload(values) {
  const payload = {};
  for (const c of HANDLE_CONSUMPTIONS) {
    payload[c.qtyField] = values[c.qtyField] || undefined;
    payload[c.materialField] = values[c.materialField] || undefined;
  }
  return payload;
}

/** Shows the server's soft "factory stock below zero" notices. */
export function toastStockWarnings(toast, stockWarnings) {
  for (const warning of stockWarnings || []) toast.warning(warning);
}
