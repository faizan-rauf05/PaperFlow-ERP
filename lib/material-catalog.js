import {
  CARTON_SIZES,
  GLUE_TYPES,
  INK_COLORS,
  KAPTON_TYPES,
  MATERIAL_TYPE_LABELS,
  PAPER_COLORS,
  PAPER_TYPES,
  ROPE_COLORS,
} from "@/lib/material-constants";

/**
 * Material identity, naming, units and pack shapes — shared by the forms and
 * the server so both agree on what makes two deliveries "the same material".
 * See docs/INVENTORY_DESIGN.md.
 *
 * - Catalog materials (every type except PAPER_ROLL) are unique per
 *   supplier + type + `catalogKey` (the subtype).
 * - Paper rolls are one material per physical roll (catalogKey = null).
 * - `stockGroup` groups materials across suppliers for stock reports and
 *   minimum levels (e.g. all suppliers' Core Glue).
 */

export const UNIT_LABELS = {
  KG: "kg",
  METER: "m",
  PCS: "pcs",
  ROLL: "rolls",
  CARTON: "cartons",
  BAG: "bags",
};

/** One unit, for "per …" figures: "KWD/kg", "KWD/m", "KWD/roll". */
export const UNIT_SINGULAR = {
  KG: "kg",
  METER: "m",
  PCS: "pc",
  ROLL: "roll",
  CARTON: "carton",
  BAG: "bag",
};

/** Units a tape material can be counted in (chosen per material). */
export const TAPE_UNITS = [
  { value: "ROLL", label: "Rolls" },
  { value: "PCS", label: "Pieces" },
  { value: "METER", label: "Meters" },
];

/**
 * A delivery's price as it was entered: "200 KWD / roll", "0.33 KWD / kg",
 * "45.5 USD / drum". `price` is { amount, currency, basis }.
 */
export function enteredPriceLabel(price, materialType, unit) {
  if (!price) return "—";
  const per =
    price.basis === "PER_KG"
      ? "kg"
      : price.basis === "PER_PACK"
        ? materialType === "PAPER_ROLL"
          ? "roll"
          : MATERIAL_TYPE_CONFIG[materialType]?.pack?.name || "pack"
        : materialType === "PAPER_ROLL"
          ? "m"
          : UNIT_SINGULAR[unit] || unit;
  return `${Number(price.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${price.currency} / ${per}`;
}

/**
 * Per-type config.
 * - unit: fixed stock unit, or null when chosen per material (tape).
 * - pack: how a delivery is counted — packSize × packCount (e.g. 25 kg × 20
 *   packs). null = the quantity is entered directly.
 */
export const MATERIAL_TYPE_CONFIG = {
  PAPER_ROLL: { unit: "METER", pack: null, isCatalog: false },
  GLUE: {
    unit: "KG",
    isCatalog: true,
    pack: { name: "pack", sizeLabel: "Weight per Pack (kg)", countLabel: "Number of Packs", presets: [18, 20, 25, 30] },
  },
  INK: {
    unit: "KG",
    isCatalog: true,
    pack: { name: "drum", sizeLabel: "Weight per Drum (kg)", countLabel: "Number of Drums", defaultSize: 18 },
  },
  ROPE: {
    unit: "METER",
    isCatalog: true,
    pack: { name: "roll", sizeLabel: "Length per Roll (m)", countLabel: "Number of Rolls", presets: [5000, 12500] },
  },
  CARTON: {
    unit: "CARTON",
    isCatalog: true,
    pack: { name: "bundle", sizeLabel: "Cartons per Bundle", countLabel: "Number of Bundles" },
  },
  KAPTON: { unit: null, isCatalog: true, pack: null },
  SPONGE: { unit: "PCS", isCatalog: true, pack: null, quantityLabel: "Sheets" },
};

/** Catalog types, in display order. */
export const CATALOG_MATERIAL_TYPES = ["GLUE", "INK", "ROPE", "KAPTON", "SPONGE", "CARTON"];

const labelOf = (options, value) => options.find((o) => o.value === value)?.label;

function slug(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ink color as stored: a preset value, or the typed custom color normalized. */
export function resolveInkColor(inkColor, inkColorCustom) {
  return inkColor === "CUSTOM" ? slug(inkColorCustom).replace(/-/g, " ") : inkColor || "";
}

export function inkColorLabel(inkColor) {
  return labelOf(INK_COLORS, inkColor) || titleCase(inkColor);
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Stock unit for a material of this type (tape: the unit chosen for it). */
export function unitFor(materialType, fields = {}) {
  return MATERIAL_TYPE_CONFIG[materialType]?.unit || fields.unit || "PCS";
}

/** Subtype identity within supplier + type; null for paper rolls. */
export function catalogKeyFor(materialType, f) {
  switch (materialType) {
    case "GLUE":
      return f.glueType;
    case "INK":
      return slug(f.inkColor);
    case "ROPE":
      return f.ropeColor;
    case "KAPTON":
      return `${f.tapeType}|${slug(f.tapeSize)}`;
    case "CARTON":
      return f.cartonSize;
    case "SPONGE":
      return "SPONGE";
    default:
      return null;
  }
}

/** Cross-supplier group key, e.g. "GLUE:CORE", "PAPER_ROLL:VIRGIN:WHITE:90". */
export function stockGroupFor(materialType, f) {
  if (materialType === "PAPER_ROLL") {
    return `PAPER_ROLL:${f.paperType}:${f.paperColor}:${Number(f.paperWidthCm)}`;
  }
  return `${materialType}:${catalogKeyFor(materialType, f)}`;
}

/** Human name of the material itself (supplier shown separately), e.g. "Core Glue". */
export function materialName(materialType, f) {
  switch (materialType) {
    case "PAPER_ROLL":
      return [
        labelOf(PAPER_TYPES, f.paperType),
        labelOf(PAPER_COLORS, f.paperColor),
        "Paper Roll",
        f.paperWidthCm ? `${Number(f.paperWidthCm)}cm` : null,
        f.gsm ? `${f.gsm}gsm` : null,
      ]
        .filter(Boolean)
        .join(" ");
    case "GLUE":
      return labelOf(GLUE_TYPES, f.glueType) || "Glue";
    case "INK":
      return `${inkColorLabel(f.inkColor)} Ink`;
    case "ROPE":
      return `${labelOf(ROPE_COLORS, f.ropeColor) || ""} Rope`.trim();
    case "KAPTON":
      return [labelOf(KAPTON_TYPES, f.tapeType) || "Tape", f.tapeSize].filter(Boolean).join(" ");
    case "CARTON":
      return `${labelOf(CARTON_SIZES, f.cartonSize) || ""} Carton`.trim();
    case "SPONGE":
      return "Sponge";
    default:
      return MATERIAL_TYPE_LABELS[materialType] || "Material";
  }
}

/** Human label for a stock group key (see stockGroupFor). */
export function stockGroupLabel(stockGroup) {
  const [materialType, ...rest] = String(stockGroup || "").split(":");
  if (materialType === "PAPER_ROLL") {
    const [paperType, paperColor, widthCm] = rest;
    return materialName("PAPER_ROLL", { paperType, paperColor, paperWidthCm: widthCm }).replace("Paper Roll", "Paper");
  }
  const key = rest.join(":");
  switch (materialType) {
    case "GLUE":
      return materialName("GLUE", { glueType: key });
    case "INK":
      return materialName("INK", { inkColor: key.replace(/-/g, " ") });
    case "ROPE":
      return materialName("ROPE", { ropeColor: key });
    case "KAPTON": {
      const [tapeType, tapeSize] = key.split("|");
      return materialName("KAPTON", { tapeType, tapeSize });
    }
    case "CARTON":
      return materialName("CARTON", { cartonSize: key });
    case "SPONGE":
      return "Sponge";
    default:
      return stockGroup;
  }
}

export function createCodeSuffix() {
  return `T${Date.now().toString(36).toUpperCase()}`;
}

/** Internal unique code, e.g. "GLUE-CORE-T1A2B3", "PAPER-VIRGIN-WHITE-90-T1A2B3". */
export function materialCode(materialType, f) {
  const base =
    materialType === "PAPER_ROLL"
      ? ["PAPER", f.paperType, f.paperColor, Number(f.paperWidthCm)].join("-")
      : [materialType === "KAPTON" ? "TAPE" : materialType, slug(catalogKeyFor(materialType, f))].join("-");
  return `${slug(base)}-${createCodeSuffix()}`;
}

/** "drum" → "drums" for a count. */
export function packNoun(packName, count) {
  return `${packName}${Number(count) === 1 ? "" : "s"}`;
}

/** Stock expressed in packs, e.g. "= 2 drums of 18 kg + 5 kg". */
export function packEquivalent(quantity, packSize, packName, unit) {
  const qty = Number(quantity);
  const size = Number(packSize);
  if (!(qty > 0) || !(size > 0)) return "";
  const whole = Math.floor(qty / size + 1e-9);
  const rest = Math.round((qty - whole * size) * 10000) / 10000;
  const parts = [];
  if (whole > 0) parts.push(`${whole} ${packNoun(packName, whole)} of ${formatQuantity(size, unit)}`);
  if (rest > 0) parts.push(formatQuantity(rest, unit));
  return `= ${parts.join(" + ")}`;
}

/** Quantity + unit for display, e.g. "1,250 kg". */
export function formatQuantity(quantity, unit) {
  const n = Number(quantity || 0);
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${UNIT_LABELS[unit] || unit || ""}`.trim();
}
