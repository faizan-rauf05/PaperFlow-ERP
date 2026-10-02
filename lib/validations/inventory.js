import { z } from "zod";
import { MATERIAL_TYPE_CONFIG } from "@/lib/material-catalog";
import {
  blankToUndefined,
  dateString,
  optionalText,
  parseNumberInput,
  requiredNumber,
  requiredPositive,
  requiredPositiveInt,
} from "@/lib/validations/number-fields";

/**
 * Validation for the material catalog and stock receiving. Like the order
 * schema, these validate RAW form values and are run once on the server
 * against the raw payload (the client only uses them for field errors).
 */

const select = (values, message) => z.enum(values, { errorMap: () => ({ message }) });

const supplierId = z.string({ required_error: "Select a supplier" }).trim().min(1, "Select a supplier");
const location = select(["WAREHOUSE", "FACTORY"], "Choose where it's received");

// ── Catalog material ──────────────────────────────────────────────────────

const glueType = select(["HOT", "COLD", "CORE"], "Select glue type");
const ropeColor = select(["WHITE", "BROWN", "BLACK"], "Select rope color");
const cartonSize = select(["SMALL", "MEDIUM", "LARGE", "EXTRA_LARGE"], "Select carton size");
const tapeType = select(["FLEXO", "WHITE_LIGHT_DS", "CARTOON", "MACHINE_BLACK_DUCK"], "Select tape type");

export const catalogMaterialSchema = z
  .discriminatedUnion(
    "materialType",
    [
      z.object({ materialType: z.literal("GLUE"), supplierId, glueType }),
      z.object({
        materialType: z.literal("INK"),
        supplierId,
        inkColor: z.string().trim().min(1, "Select ink color"),
        inkColorCustom: optionalText(40, "Color"),
      }),
      z.object({ materialType: z.literal("ROPE"), supplierId, ropeColor }),
      z.object({
        materialType: z.literal("KAPTON"),
        supplierId,
        tapeType,
        tapeSize: z.string().trim().min(1, "Enter the tape size").max(30),
        unit: select(["ROLL", "PCS", "METER"], "Select the unit"),
      }),
      z.object({ materialType: z.literal("SPONGE"), supplierId }),
      z.object({ materialType: z.literal("CARTON"), supplierId, cartonSize }),
    ],
    { errorMap: () => ({ message: "Select the material type" }) },
  )
  .superRefine((data, ctx) => {
    if (data.materialType === "INK" && data.inkColor === "CUSTOM" && !data.inkColorCustom) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inkColorCustom"], message: "Enter the ink color" });
    }
  });

// ── Stock receipt ─────────────────────────────────────────────────────────

/** Price: up to 4 decimals (per-unit prices like 0.1550 KWD/m are common). */
const costAmount = z.preprocess(
  parseNumberInput,
  requiredNumber("Price")
    .positive("Price must be greater than 0")
    .max(99999999, "Price is too large")
    .refine((n) => Math.abs(n * 10000 - Math.round(n * 10000)) < 1e-6, {
      message: "Price can have at most 4 decimal places",
    }),
);

const receiptCommon = {
  location,
  receivedAt: dateString("Received date"),
  batchNo: optionalText(60, "Batch number"),
  batchDate: z.preprocess(blankToUndefined, dateString("Batch date").optional()),
  costAmount,
  costCurrency: select(["KWD", "USD", "EUR"], "Select the currency"),
  costEntryBasis: select(["PER_UNIT", "PER_PACK", "PER_KG"], "Select how the price is entered"),
  labelImageUrl: optionalText(20_000_000, "Label image"),
  notes: optionalText(500, "Notes"),
};

const catalogReceipt = (materialType) => {
  const { pack } = MATERIAL_TYPE_CONFIG[materialType];
  return z.object({
    materialType: z.literal(materialType),
    materialId: z.string({ required_error: "Select the material" }).trim().min(1, "Select the material"),
    ...receiptCommon,
    ...(pack
      ? {
          packSize: requiredPositive(pack.sizeLabel.replace(/ \(.*\)$/, "")),
          packCount: requiredPositiveInt(pack.countLabel),
        }
      : { quantity: requiredPositive("Quantity") }),
  });
};

const paperRollReceipt = z.object({
  materialType: z.literal("PAPER_ROLL"),
  supplierId,
  paperType: select(["VIRGIN", "RECYCLED"], "Select paper type"),
  paperColor: select(["WHITE", "BROWN"], "Select paper color"),
  paperWidthCm: requiredPositive("Width"),
  paperLengthM: requiredPositive("Length"),
  gsm: requiredPositiveInt("GSM"),
  weightKg: requiredPositive("Roll weight"),
  barCode: z.string({ required_error: "Scan or enter the roll's barcode" }).trim().min(3, "Scan or enter the roll's barcode").max(60),
  ...receiptCommon,
});

export const stockReceiptSchema = z
  .discriminatedUnion(
    "materialType",
    [paperRollReceipt, ...["GLUE", "INK", "ROPE", "KAPTON", "SPONGE", "CARTON"].map(catalogReceipt)],
    { errorMap: () => ({ message: "Select what you're receiving" }) },
  )
  .superRefine((data, ctx) => {
    if (data.batchNo && !data.batchDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batchDate"],
        message: "Enter the batch date (batch number + date identify the batch)",
      });
    }
    const hasPack = data.materialType === "PAPER_ROLL" || Boolean(MATERIAL_TYPE_CONFIG[data.materialType]?.pack);
    if (data.costEntryBasis === "PER_PACK" && !hasPack) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["costEntryBasis"], message: "This material is priced per unit" });
    }
    if (data.costEntryBasis === "PER_KG" && data.materialType !== "PAPER_ROLL") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["costEntryBasis"], message: "Only paper rolls are priced per kg" });
    }
  });

// ── Stock movements ───────────────────────────────────────────────────────

export const stockAdjustmentSchema = z.object({
  materialId: z.string().trim().min(1, "Select the material"),
  location,
  quantity: z.preprocess(
    parseNumberInput,
    requiredNumber("Quantity").refine((n) => n !== 0, "Enter a change other than 0"),
  ),
  remarks: z.string({ required_error: "Enter a reason" }).trim().min(3, "Enter a reason").max(300),
});
