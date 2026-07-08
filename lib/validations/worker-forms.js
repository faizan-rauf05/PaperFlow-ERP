import { z } from "zod";

const qtyField = z.coerce
  .number({ invalid_type_error: "Enter a valid number" })
  .min(0, "Cannot be negative");

const remarksField = z.string().trim().max(500, "Remarks too long").optional().or(z.literal(""));

export const workerStandardStageSchema = z
  .object({
    rollId: z.string().optional(),
    outputQty: qtyField.refine((v) => v > 0, "Output quantity must be greater than 0"),
    wasteQty: qtyField.default(0),
    remarks: remarksField,
    inputQty: z.number().nullable().optional(),
    isRawMaterial: z.boolean().optional(),
    rollRemainingM: z.number().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRawMaterial && !data.rollId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a roll", path: ["rollId"] });
    }
    if (data.inputQty != null && data.inputQty > 0) {
      const total = data.outputQty + (data.wasteQty ?? 0);
      if (total > data.inputQty * 1.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Output + waste cannot exceed input quantity",
          path: ["outputQty"],
        });
      }
    }
    if (data.isRawMaterial && data.rollRemainingM != null && data.outputQty > data.rollRemainingM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Cannot exceed roll remaining length (${data.rollRemainingM}m)`,
        path: ["outputQty"],
      });
    }
  });

export const workerQcStageSchema = z
  .object({
    passedQty: qtyField,
    rejectedQty: qtyField,
    defectTypeId: z.string().optional().or(z.literal("")),
    remarks: remarksField,
    inputQty: z.number().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rejectedQty > 0 && !data.defectTypeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a defect type when rejecting material",
        path: ["defectTypeId"],
      });
    }
    if (data.inputQty != null && data.inputQty > 0) {
      const total = data.passedQty + data.rejectedQty;
      if (total > data.inputQty * 1.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pass + reject cannot exceed input quantity",
          path: ["passedQty"],
        });
      }
      if (total === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter passed or rejected quantity",
          path: ["passedQty"],
        });
      }
    }
  });

export const workerDowntimeSchema = z.object({
  machineId: z.string().min(1, "Select a machine first"),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(200),
});
