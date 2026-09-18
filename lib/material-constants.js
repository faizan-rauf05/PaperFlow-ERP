export const MATERIAL_TYPES = [
  "PAPER_ROLL",
  "GLUE",
  "INK",
  "ROPE",
  "KAPTON",
  "SPONGE",
  "CARTON",
];

export const MATERIAL_TYPE_LABELS = {
  PAPER_ROLL: "Paper Roll",
  GLUE: "Glue",
  INK: "Ink",
  ROPE: "Rope",
  KAPTON: "Tape",
  SPONGE: "Sponge",
  CARTON: "Carton",
};

export const PAPER_TYPES = [
  { value: "RECYCLED", label: "Recycled" },
  { value: "VIRGIN", label: "Virgin" },
];

export const PAPER_COLORS = [
  { value: "BROWN", label: "Brown" },
  { value: "WHITE", label: "White" },
];

export const PAPER_WIDTH_CM_PRESETS = [75, 79, 89, 90, 95, 101, 107, 115, 125];

export const GLUE_TYPES = [
  { value: "HOT", label: "Hot Glue" },
  { value: "COLD", label: "Cold Glue" },
  { value: "CORE", label: "Core Glue" },
];

export const GLUE_WEIGHT_PRESETS = [18, 20, 25, 30];

export const INK_COLORS = [
  { value: "CYAN", label: "Cyan" },
  { value: "MAGENTA", label: "Magenta" },
  { value: "YELLOW", label: "Yellow" },
  { value: "WHITE", label: "White" },
  { value: "VARNISH", label: "Varnish" },
  { value: "BLACK", label: "Black" },
  { value: "INK_FIXER", label: "Ink Fixer" },
  { value: "CUSTOM", label: "Custom (manual entry)" },
];

export const ROPE_COLORS = [
  { value: "WHITE", label: "White" },
  { value: "BROWN", label: "Brown" },
  { value: "BLACK", label: "Black" },
];

export const ROPE_LENGTH_PRESETS = [5000, 12500];

export const CARTON_SIZES = [
  { value: "SMALL", label: "Small" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LARGE", label: "Large" },
  { value: "EXTRA_LARGE", label: "Extra Large" },
];

export const KAPTON_TYPES = [
  { value: "FLEXO", label: "Flexo tape" },
  { value: "WHITE_LIGHT_DS", label: "White light double side tape" },
  { value: "CARTOON", label: "Cartoon tape" },
  { value: "MACHINE_BLACK_DUCK", label: "Machine black duck tape" },
];

export const MATERIAL_UNIT_BY_TYPE = {
  PAPER_ROLL: "METER",
  GLUE: "KG",
  INK: "KG",
  ROPE: "METER",
  KAPTON: "PCS",
  SPONGE: "PCS",
  CARTON: "CARTON",
};

export const COST_CURRENCIES = [
  { value: "KWD", label: "KWD" },
  { value: "USD", label: "USD" },
];

export const COST_ENTRY_BASES = [
  { value: "PER_UNIT", label: "Per unit" },
  { value: "PER_PACK", label: "Per pack" },
];

/**
 * Materials bought as a discrete pack/drum/roll/bundle even though stock
 * is tracked continuously (see computeInitialStockQty in material-code.js).
 * Maps each to the buildMaterialRecord() field holding "how many base
 * units are in one pack" — the divisor used to turn a per-pack cost price
 * into the canonical per-unit price. Shared by the server (lib/cost-price.js)
 * and the Add Material form's live "Priced Per" toggle + conversion hint.
 */
export const COST_PACK_DIVISOR_FIELD_BY_TYPE = {
  PAPER_ROLL: "paperLengthM",
  GLUE: "weightKg",
  INK: "weightKg",
  ROPE: "ropeLengthM",
  CARTON: "cartonsPerBundle",
};

export const COST_PACK_UNIT_LABEL_BY_TYPE = {
  PAPER_ROLL: "Roll",
  GLUE: "Pack",
  INK: "Drum",
  ROPE: "Roll",
  CARTON: "Bundle",
};

export function supportsPackCostEntry(materialType) {
  return Object.prototype.hasOwnProperty.call(COST_PACK_DIVISOR_FIELD_BY_TYPE, materialType);
}

export const PAPER_TYPE_CODE = {
  RECYCLED: "REC",
  VIRGIN: "VRG",
};

export const PAPER_COLOR_CODE = {
  BROWN: "BRN",
  WHITE: "WHT",
};

export const GLUE_TYPE_CODE = {
  HOT: "HOT",
  COLD: "COLD",
  CORE: "CORE",
};

export const ROPE_COLOR_CODE = {
  WHITE: "WHT",
  BROWN: "BRN",
  BLACK: "BLK",
};

export const CARTON_SIZE_CODE = {
  SMALL: "SM",
  MEDIUM: "MD",
  LARGE: "LG",
  EXTRA_LARGE: "XL",
};

export const KAPTON_TYPE_CODE = {
  FLEXO: "FLEXO",
  WHITE_LIGHT_DS: "WHT-LIGHT-DS",
  CARTOON: "CARTOON",
  MACHINE_BLACK_DUCK: "MC-BLK-DUCK",
};

export const INK_COLOR_CODE = {
  CYAN: "CYAN",
  MAGENTA: "MAGENTA",
  YELLOW: "YELLOW",
  WHITE: "WHITE",
  VARNISH: "VARNISH",
  BLACK: "BLACK",
  INK_FIXER: "FIXER",
};

/**
 * Order-line -> material consumption formula constants for the order
 * material suggestion engine (see lib/material-suggestion.js).
 *
 * Values marked "PLACEHOLDER" are estimates, not client-confirmed figures.
 * They were derived to be directionally reasonable so the engine can run
 * end-to-end, but every PLACEHOLDER value here is expected to change once
 * confirmed with the client — update in this one place only.
 */
export const MATERIAL_SUGGESTION_CONSTANTS = {
  // Client-confirmed: roll width = (width + bottom) x 2 + this margin (cm).
  ROLL_WIDTH_MARGIN_CM: 3,

  // PLACEHOLDER: extra paper fed per bag beyond its finished height, for the
  // bottom fold/seal + top hem (client's 31cm-height -> 40cm-feed example
  // implies 9cm; may turn out to vary by bag type, e.g. with-handle).
  FEED_LENGTH_ALLOWANCE_CM: 9,

  // PLACEHOLDER: glue coverage, grams of glue per cm of seam length.
  // Side seam runs the fed length of the bag; bottom seam runs the bag's
  // bottom (gusset) width. Two different rates because a bottom seam is
  // typically a heavier/wider glue line than a side seam.
  GLUE_G_PER_CM_SIDE_SEAM: 0.06,
  GLUE_G_PER_CM_BOTTOM_SEAM: 0.09,

  // PLACEHOLDER: handle rope, only applied when the order line has a handle.
  ROPE_HANDLES_PER_BAG: 2,
  ROPE_LENGTH_CM_PER_HANDLE: 30,

  // PLACEHOLDER: ink coverage, grams of ink per cm^2 of printed area per
  // print color (colorCount), typical of light flexographic coverage.
  INK_G_PER_CM2_PER_COLOR: 0.00008,
};
