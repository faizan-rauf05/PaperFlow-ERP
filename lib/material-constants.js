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

/** OrderLineMaterial.role -> label for an order line's recommended materials. */
export const ORDER_MATERIAL_ROLE_LABELS = {
  ROLL: "Paper Roll",
  HOT_GLUE: "Hot Melt Glue",
  COLD_GLUE: "Cold Glue",
  CORE_GLUE: "Core Glue",
  ROPE: "Rope",
  INK: "Ink",
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

/**
 * Client rule: each glue type (Hot/Cold/Core, all suppliers together) must
 * have at least this many drums in the factory; below it, the dashboards
 * alert and the warehouse gets a supply task.
 */
export const GLUE_MIN_FACTORY_DRUMS = 5;

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

export const COST_CURRENCIES = [
  { value: "KWD", label: "KWD" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

/**
 * Order-line -> material consumption formula constants for the order
 * material suggestion engine (see lib/material-suggestion.js).
 *
 * Values marked "PLACEHOLDER" are estimates, not client-confirmed figures —
 * update in this one place only once the client confirms them.
 */
export const MATERIAL_SUGGESTION_CONSTANTS = {
  // Client-confirmed: roll width = (width + bottom) x 2 + this margin (cm).
  ROLL_WIDTH_MARGIN_CM: 3,

  // Client-confirmed: the only bag heights the machine produces (cm). A bag's
  // paper height is its height + bottom x 2/3, rounded to the nearest of
  // these (ties round up; anything past either end uses that end).
  MACHINE_HEIGHTS_CM: [40, 45, 50, 55, 60],

  // Client-confirmed: paper length for an order line is the calculated height
  // x bags plus this share on top for wastage — it's what's costed and picked.
  PAPER_LENGTH_WASTAGE: 0.1,

  // Client-confirmed: at slitting, roll width beyond what the bag needs is
  // cut into recycled rolls (for handle making) of 8.5–9 cm — as many as fit,
  // as wide as possible within that range; what's left is waste.
  RECYCLE_STRIP_MIN_CM: 8.5,
  RECYCLE_STRIP_MAX_CM: 9,

  // Client-confirmed: 25kg of hot melt makes 10,000 handles (one bag's pair
  // each) — used only on bags with handles.
  HOT_GLUE_KG_PER_HANDLE_BAG: 25 / 10000,

  // Client-confirmed: cold and core glue are costed per bag (KWD), not
  // matched to stock. Cold glue also fixes the handles, at 50% extra.
  COLD_GLUE_KWD_PER_BAG: 0.001,
  COLD_GLUE_HANDLE_EXTRA: 0.5,
  CORE_GLUE_KWD_PER_BAG: 0.0008,

  // PLACEHOLDER: planned side/bottom seam glue recorded at the production
  // stage (consumption.service), grams of glue per cm of seam length.
  GLUE_G_PER_CM_SIDE_SEAM: 0.06,
  GLUE_G_PER_CM_BOTTOM_SEAM: 0.09,

  // PLACEHOLDER: handle rope, only applied when the order line has a handle.
  ROPE_HANDLES_PER_BAG: 2,
  ROPE_LENGTH_CM_PER_HANDLE: 30,

  // Client-confirmed: ink is costed at a fixed rate — 0.000739 fils per cm^2
  // of the bag's full paper area (calculated height x calculated width),
  // charged once whatever the color count; plain bags use none.
  INK_KWD_PER_CM2: 0.000739 / 1000,

  // PLACEHOLDER: ink used, grams per cm^2 of that same full area (once, not
  // per color) — only sets how much ink the warehouse picks, not its cost.
  INK_G_PER_CM2: 0.00008,
};
