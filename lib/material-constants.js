export const MATERIAL_TYPES = [
  "PAPER_ROLL",
  "GLUE",
  "INK",
  "ROPE",
  "KAPTON",
  "SPONGE",
];

export const MATERIAL_TYPE_LABELS = {
  PAPER_ROLL: "Paper Roll",
  GLUE: "Glue",
  INK: "Ink",
  ROPE: "Rope",
  KAPTON: "Tape",
  SPONGE: "Sponge",
};

export const PAPER_TYPES = [
  { value: "RECYCLED", label: "Recycled" },
  { value: "VIRGIN", label: "Virgin" },
];

export const PAPER_COLORS = [
  { value: "BROWN", label: "Brown" },
  { value: "WHITE", label: "White" },
];

export const PAPER_WIDTH_PRESETS = [75, 79, 89, 90, 95, 101, 107, 115, 125];

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

export const KAPTON_TYPE_CODE = {
  FLEXO: "FLEXO",
  WHITE_LIGHT_DS: "WHT-LIGHT-DS",
  CARTOON: "CARTOON",
  MACHINE_BLACK_DUCK: "MC-BLK-DUCK",
};

export const INK_COLOR_CODE = {
  CMYK: "CMYK",
  WHITE: "WHITE",
  VARNISH: "VARNISH",
  BLACK: "BLACK",
  INK_FIXER: "FIXER",
};
