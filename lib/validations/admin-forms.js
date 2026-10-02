import { z } from "zod";

export const MACHINE_STATUSES = ["ACTIVE", "DOWN", "MAINTENANCE", "INACTIVE"];

const positiveNumber = z.coerce
  .number({ invalid_type_error: "Must be a number" })
  .positive("Must be greater than 0");

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  contactPerson: z.string().trim().max(100).optional().or(z.literal("")),
  contactNumber: z.string().trim().max(40).optional().or(z.literal("")),
  email: z
    .union([z.literal(""), z.string().trim().email("Invalid email")])
    .optional(),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
export const machineSchema = z.object({
  machineCode: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(20)
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Code may only contain letters, numbers, and hyphens",
    ),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  stageType: z.string().min(1, "Select a stage type"),
  status: z.enum(MACHINE_STATUSES).optional(),
});

export const productionOrderSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  assignedWorkerId: z.string().min(1, "Assign a worker"),
  salesRep: z.string().trim().max(100).optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  deliveryDate: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  lines: z
    .array(
      z.object({
        heightMm: positiveNumber,
        widthMm: positiveNumber,
        baseMm: positiveNumber,
        fileUrl: z.string().optional().or(z.literal("")),
        fileName: z.string().optional().or(z.literal("")),
        plannedQty: z.coerce
          .number({ invalid_type_error: "Planned quantity is required" })
          .int("Must be a whole number")
          .positive("Must be greater than 0"),
      }),
    )
    .min(1, "Add at least one order line"),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z
    .union([z.literal(""), z.string().trim().email("Invalid email")])
    .optional(),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const rollSchema = z.object({
  rollNo: z.string().optional(),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["ADMIN", "MANAGER", "WORKER", "SALES", "FINANCE", "WAREHOUSE"], {
    errorMap: () => ({ message: "Select a role" }),
  }),
  isActive: z.boolean().optional(),
  signatureUrl: z.string().trim().optional().or(z.literal("")),
});

export const userCreateSchema = userSchema.pick({
  name: true,
  email: true,
  role: true,
});
export const userEditSchema = userSchema.pick({
  name: true,
  role: true,
  isActive: true,
  signatureUrl: true,
});

export const downtimeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(200),
});
