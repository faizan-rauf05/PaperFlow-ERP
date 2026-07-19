import { z } from "zod";
import { generateMaterialCode, resolveInkColor } from "@/lib/material-code";

export const MATERIAL_UNITS = ["KG", "METER", "PCS", "BAG", "CARTON"];
export const TX_TYPES = ["STOCK_IN", "STOCK_OUT", "WASTE", "RETURN", "ADJUSTMENT"];
export const MACHINE_STATUSES = ["ACTIVE", "DOWN", "MAINTENANCE", "INACTIVE"];

const positiveNumber = z.coerce.number({ invalid_type_error: "Must be a number" }).positive("Must be greater than 0");
const nonNegativeNumber = z.coerce.number({ invalid_type_error: "Must be a number" }).min(0, "Cannot be negative");
const optionalPositive = z
  .union([z.literal(""), z.coerce.number().positive("Must be greater than 0")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const supplierField = z.string().trim().max(100, "Supplier name too long").optional().or(z.literal(""));
const nameField = z.string().trim().min(2, "Name must be at least 2 characters").max(100);
const codeSuffixField = z.string().trim().min(1).optional().or(z.literal(""));

const paperRollMaterialSchema = z.object({
  materialType: z.literal("PAPER_ROLL"),
  name: nameField,
  supplier: supplierField,
  codeSuffix: codeSuffixField,
  paperType: z.enum(["BROWN", "WHITE"], { errorMap: () => ({ message: "Select paper type" }) }),
  paperLengthM: positiveNumber,
  paperWidthMm: positiveNumber,
  gsm: z.coerce.number({ invalid_type_error: "GSM must be a number" }).int("GSM must be a whole number").positive("GSM must be greater than 0"),
});

const glueMaterialSchema = z.object({
  materialType: z.literal("GLUE"),
  name: nameField,
  supplier: supplierField,
  codeSuffix: codeSuffixField,
  glueType: z.enum(["HOT", "COLD", "CORE"], { errorMap: () => ({ message: "Select glue type" }) }),
  weightKg: positiveNumber,
});

const inkMaterialSchema = z.object({
  materialType: z.literal("INK"),
  name: nameField,
  supplier: supplierField,
  codeSuffix: codeSuffixField,
  inkColor: z.string().trim().min(1, "Select or enter ink color"),
  inkColorCustom: z.string().trim().max(50).optional().or(z.literal("")),
  weightKg: positiveNumber,
});

const ropeMaterialSchema = z.object({
  materialType: z.literal("ROPE"),
  name: nameField,
  supplier: supplierField,
  codeSuffix: codeSuffixField,
  ropeColor: z.enum(["WHITE", "BROWN", "BLACK"], { errorMap: () => ({ message: "Select rope color" }) }),
  ropeLengthM: positiveNumber,
  ropeWeightKg: positiveNumber,
});

const kaptonMaterialSchema = z.object({
  materialType: z.literal("KAPTON"),
  name: nameField,
  supplier: supplierField,
  codeSuffix: codeSuffixField,
  tapeType: z.enum(["FLEXO", "WHITE_DS", "MACHINE_BLACK"], { errorMap: () => ({ message: "Select Kapton type" }) }),
  size: z.string().trim().min(1, "Size is required").max(50),
  unit: z.string().trim().min(1, "Unit is required").max(30),
});

const spongeMaterialSchema = z.object({
  materialType: z.literal("SPONGE"),
  name: nameField,
  supplier: supplierField,
  codeSuffix: codeSuffixField,
  sheetCount: z.coerce.number({ invalid_type_error: "Must be a number" }).int("Must be a whole number").positive("Must be greater than 0"),
});

const cartonMaterialSchema = z.object({
  materialType: z.literal("CARTON"),
  name: nameField,
  supplier: supplierField,
  codeSuffix: codeSuffixField,
  cartonSize: z.string().trim().min(1, "Carton size is required").max(50),
  cartonLength: positiveNumber,
  cartonWidth: positiveNumber,
  cartonHeight: optionalPositive,
});

export const materialSchema = z.discriminatedUnion("materialType", [
  paperRollMaterialSchema,
  glueMaterialSchema,
  inkMaterialSchema,
  ropeMaterialSchema,
  kaptonMaterialSchema,
  spongeMaterialSchema,
  cartonMaterialSchema,
]).superRefine((data, ctx) => {
  const code = generateMaterialCode(data);
  if (!code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Complete all required fields to generate a code",
      path: ["code"],
    });
  }

  if (data.materialType === "INK") {
    const color = resolveInkColor(data.inkColor, data.inkColorCustom);
    if (!color) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a custom ink color",
        path: ["inkColorCustom"],
      });
    }
  }
});
export const machineSchema = z.object({
  machineCode: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Code may only contain letters, numbers, and hyphens"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  stageType: z.string().min(1, "Select a stage type"),
  status: z.enum(MACHINE_STATUSES).optional(),
});

export const productionOrderSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  assignedWorkerId: z.string().min(1, "Assign a worker"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  lines: z
    .array(
      z.object({
        bagSpecId: z.string().min(1, "Select a bag size"),
        plannedQty: z.coerce
          .number({ invalid_type_error: "Planned quantity is required" })
          .int("Must be a whole number")
          .positive("Must be greater than 0"),
      }),
    )
    .min(1, "Add at least one bag line"),
});

export const bagSpecSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Code may only contain letters, numbers, and hyphens"),
  bagWidthMm: z.string().optional().or(z.literal("")),
  repeatLengthMm: z.string().optional().or(z.literal("")),
  bagsPerMeter: z.string().optional().or(z.literal("")),
  handlesPerBag: z.string().optional().or(z.literal("")),
  sideGlueKgPerBag: z.string().optional().or(z.literal("")),
  bottomGlueKgPerBag: z.string().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  kind: z.enum(["PERSON", "COMPANY"], { errorMap: () => ({ message: "Select customer type" }) }),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.union([z.literal(""), z.string().trim().email("Invalid email")]).optional(),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const rollSchema = z.object({
  rollNo: z.string().optional(),
});

export const inventoryTransactionSchema = z.object({
  transactionType: z.enum(TX_TYPES, { errorMap: () => ({ message: "Select a transaction type" }) }),
  materialId: z.string().min(1, "Select a material"),
  quantity: positiveNumber,
  unit: z.enum(MATERIAL_UNITS, { errorMap: () => ({ message: "Select a unit" }) }),
  remarks: z.string().trim().max(500, "Remarks too long").optional().or(z.literal("")),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["ADMIN", "MANAGER", "WORKER", "SALES", "FINANCE"], {
    errorMap: () => ({ message: "Select a role" }),
  }),
  isActive: z.boolean().optional(),
});

export const userCreateSchema = userSchema.pick({ name: true, email: true, role: true });
export const userEditSchema = userSchema.pick({ name: true, role: true, isActive: true });

export const downtimeSchema = z.object({
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(200),
});
