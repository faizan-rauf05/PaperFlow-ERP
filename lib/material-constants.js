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
  KAPTON: "Kapton",
  SPONGE: "Sponge",
  CARTON: "Carton",
};

export const PAPER_TYPES = [
  { value: "BROWN", label: "Brown" },
  { value: "WHITE", label: "White" },
];

export const GLUE_TYPES = [
  { value: "HOT", label: "Hot Glue" },
  { value: "COLD", label: "Cold Glue" },
  { value: "CORE", label: "Core Glue" },
];

export const INK_COLORS = [
  { value: "CMYK", label: "CMYK" },
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

export const KAPTON_TYPES = [
  { value: "FLEXO", label: "Flexo Tape" },
  { value: "WHITE_DS", label: "White Double Side Tape" },
  { value: "MACHINE_BLACK", label: "Machine Black Duck Tape" },
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

export const PAPER_TYPE_CODE = {
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

export const KAPTON_TYPE_CODE = {
  FLEXO: "FLEXO",
  WHITE_DS: "WHITE-DS",
  MACHINE_BLACK: "MACHINE-BLK",
};

export const INK_COLOR_CODE = {
  CMYK: "CMYK",
  WHITE: "WHITE",
  VARNISH: "VARNISH",
  BLACK: "BLACK",
  INK_FIXER: "FIXER",
};
