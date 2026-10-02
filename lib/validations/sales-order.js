import { z } from "zod";
import {
  blankToUndefined,
  optionalMoney,
  optionalText,
  parseNumberInput,
  requiredPositive,
  requiredPositiveInt,
} from "@/lib/validations/number-fields";
import { lineNeedsCliche } from "@/lib/order-labels";

/**
 * Sales order (proposal) create/edit validation — shared by the order form
 * (field-level errors) and POST/PUT /api/orders.
 *
 * Accepts the raw form values (strings, "" for blanks) and is designed to
 * be run once, on the server, against that raw input: the client validates
 * for errors but sends the raw form, never this schema's transformed output.
 */

/** Order statuses a proposal can still be edited in (before it enters production). */
export const EDITABLE_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REJECTED",
  "APPROVED",
  "PENDING_CUSTOMER_APPROVAL",
  "CUSTOMER_APPROVED",
];

/** Statuses an edit can be saved as a draft from; anything later is re-submitted for approval. */
export const DRAFTABLE_ORDER_STATUSES = ["DRAFT", "REJECTED"];

export const MAX_REFERENCE_FILES = 5;

export const CLICHE_SOURCES = ["PURCHASED_NEW", "CUSTOMER_SUPPLIED", "REUSED_EXISTING"];
export const CLICHE_OWNERSHIPS = ["COMPANY_OWNED", "CUSTOMER_OWNED"];

const optionalPositive = (label) =>
  z.preprocess(
    parseNumberInput,
    z.number({ invalid_type_error: `${label} must be a number` }).positive(`${label} must be greater than 0`).optional(),
  );

export const orderLineSchema = z.object({
  widthCm: requiredPositive("Width"),
  heightCm: requiredPositive("Height"),
  baseCm: requiredPositive("Gusset / base"),
  quantity: requiredPositiveInt("Quantity", "whole number of bags"),
  paperType: z.enum(["VIRGIN", "RECYCLED"], { errorMap: () => ({ message: "Select paper type" }) }),
  paperColor: z.enum(["WHITE", "BROWN"], { errorMap: () => ({ message: "Select paper color" }) }),
  colorCount: z.coerce.number().int().min(0).max(5),
  withHandle: z.boolean(),
  unitPrice: optionalMoney("Unit price"),
  lineTotal: optionalMoney("Line total"),
  referenceFiles: z
    .array(z.object({ url: z.string().min(1), name: z.string().optional() }))
    .max(MAX_REFERENCE_FILES, `At most ${MAX_REFERENCE_FILES} reference files per line`)
    .optional()
    .default([]),
  // Cliché for a printed line: pick an existing one, or add a new one
  // (purchased for this order — billed at cost — or supplied by the customer).
  // Which of these are required depends on the mode: see lineClicheErrors.
  clicheMode: z.preprocess(blankToUndefined, z.enum(["EXISTING", "NEW"]).optional()),
  clicheId: z.preprocess(blankToUndefined, z.string().trim().optional()),
  clicheHeightCm: optionalPositive("Cliché height"),
  clicheWidthCm: optionalPositive("Cliché width"),
  clicheColorCount: z.preprocess(
    parseNumberInput,
    z
      .number({ invalid_type_error: "Cliché colors must be a number" })
      .int("Cliché colors must be a whole number")
      .min(1, "Cliché colors must be at least 1")
      .optional(),
  ),
  clicheSource: z.preprocess(blankToUndefined, z.enum(CLICHE_SOURCES).optional()),
  clicheOwnership: z.preprocess(blankToUndefined, z.enum(CLICHE_OWNERSHIPS).optional()),
  clicheCost: optionalMoney("Cliché cost"),
  clicheNotes: optionalText(500, "Cliché notes"),
});

export const salesOrderSchema = z
  .object({
    customerId: z.string({ required_error: "Select a customer" }).trim().min(1, "Select a customer"),
    salesRepId: z.preprocess(blankToUndefined, z.string().trim().optional()),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL"),
    deliveryDate: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
        .optional(),
    ),
    notes: z.preprocess(
      blankToUndefined,
      z.string().trim().max(1000, "Notes can be at most 1000 characters").optional(),
    ),
    discount: optionalMoney("Discount"),
    status: z.enum(["DRAFT", "PENDING_APPROVAL"]).optional().default("PENDING_APPROVAL"),
    lines: z.array(orderLineSchema).min(1, "Add at least one line item"),
  })
  .superRefine((data, ctx) => {
    for (const [path, message] of Object.entries(lineClicheErrors(data.lines, data.status))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: path.split("."), message });
    }
    const { subtotal } = computeOrderTotals(data.lines, 0);
    if (data.discount > 0 && data.discount > subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discount"],
        message: "Discount can't be more than the subtotal",
      });
    }
  });

function toNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A line's effective total: the entered line total, else quantity × unit
 * price, else null (no price entered). Used for the form's live summary and
 * the server's authoritative totals, so both always agree.
 */
export function effectiveLineTotal(line) {
  const lineTotal = toNumber(line.lineTotal);
  if (lineTotal != null) return lineTotal;
  const qty = toNumber(line.quantity);
  const unitPrice = toNumber(line.unitPrice);
  return qty != null && unitPrice != null ? qty * unitPrice : null;
}

/**
 * What the customer pays for a line's cliché: the cost of one purchased new
 * for this order (billed at cost), else 0 — a reused or customer-supplied
 * cliché, or a plain line, costs the customer nothing extra.
 */
export function lineClicheCharge(line) {
  if (!lineNeedsCliche(line) || line.clicheMode !== "NEW" || line.clicheSource !== "PURCHASED_NEW") return 0;
  return toNumber(line.clicheCost) ?? 0;
}

/**
 * Cliché rules that depend on other fields, as { "lines.0.clicheId": message }.
 * Every printed line needs a cliché before the proposal is submitted (a
 * draft may leave it open); a new cliché needs its size, and its cost when
 * it's purchased, since that cost goes on the quote.
 */
export function lineClicheErrors(lines, status) {
  const errors = {};
  const submitting = status !== "DRAFT";
  (lines || []).forEach((line, i) => {
    if (!lineNeedsCliche(line)) return;
    const key = (field) => `lines.${i}.${field}`;
    if (!line.clicheMode) {
      if (submitting) errors[key("clicheMode")] = "Choose the cliché for this printed line";
      return;
    }
    if (line.clicheMode === "EXISTING") {
      if (submitting && !line.clicheId) errors[key("clicheId")] = "Select a cliché";
      return;
    }
    if (!(toNumber(line.clicheHeightCm) > 0)) errors[key("clicheHeightCm")] = "Enter the cliché height";
    if (!(toNumber(line.clicheWidthCm) > 0)) errors[key("clicheWidthCm")] = "Enter the cliché width";
    if (!line.clicheSource) errors[key("clicheSource")] = "Select where the cliché comes from";
    if (line.clicheSource === "PURCHASED_NEW" && !(toNumber(line.clicheCost) > 0)) {
      errors[key("clicheCost")] = "Enter the cliché cost — it's billed to the customer";
    }
  });
  return errors;
}

/**
 * Subtotal of all priced lines plus purchased clichés (billed at cost), and
 * the proposed total after discount (never below 0).
 */
export function computeOrderTotals(lines, discount) {
  const linesTotal = (lines || []).reduce((sum, l) => sum + (effectiveLineTotal(l) ?? 0), 0);
  const clicheCharges = (lines || []).reduce((sum, l) => sum + lineClicheCharge(l), 0);
  const subtotal = linesTotal + clicheCharges;
  const discountNum = toNumber(discount) ?? 0;
  return { subtotal, clicheCharges, discount: discountNum, total: Math.max(subtotal - discountNum, 0) };
}
