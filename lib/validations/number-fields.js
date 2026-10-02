import { z } from "zod";

/**
 * Number fields for zod schemas that validate RAW form input (strings, ""
 * for blank) — the same schema runs in the browser for field errors and on
 * the server against the raw payload.
 */

export const blankToUndefined = (v) => (v === "" || v === null ? undefined : v);

// Blank -> undefined (so "required" fires), numeric strings -> numbers, anything
// else -> NaN (so "must be a number" fires). z.coerce would turn blank into NaN.
export const parseNumberInput = (v) => {
  const value = blankToUndefined(v);
  return typeof value === "string" ? Number(value) : value;
};

/** Label as it reads mid-sentence: "Roll weight" → "roll weight", but acronyms stay ("GSM"). */
const midSentence = (label) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

/** A required number, with messages naming the field (label is capitalized, e.g. "Width"). */
export const requiredNumber = (label) =>
  z.number({
    required_error: `Enter the ${midSentence(label)}`,
    invalid_type_error: `${label} must be a number`,
  });

export const requiredPositive = (label) =>
  z.preprocess(parseNumberInput, requiredNumber(label).positive(`${label} must be greater than 0`));

export const requiredPositiveInt = (label, noun = "whole number") =>
  z.preprocess(
    parseNumberInput,
    requiredNumber(label).int(`${label} must be a ${noun}`).positive(`${label} must be at least 1`),
  );

/** Optional non-negative amount; blank means "not entered" (undefined). */
export const optionalMoney = (label) =>
  z.preprocess(
    parseNumberInput,
    z.number({ invalid_type_error: `${label} must be a number` }).min(0, `${label} can't be negative`).optional(),
  );

/** Optional trimmed text; blank means "not entered" (undefined). */
export const optionalText = (max, label = "Text") =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, `${label} can be at most ${max} characters`).optional());

/** A YYYY-MM-DD date from a date input. */
export const dateString = (label) =>
  z
    .string({ required_error: `Enter the ${midSentence(label)}` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `Enter a valid ${midSentence(label)}`);
