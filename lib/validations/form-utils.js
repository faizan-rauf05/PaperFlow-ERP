/**
 * Run a Zod schema and return field-level errors for forms.
 * @returns {{ success: true, data: T } | { success: false, errors: Record<string, string> }}
 */
export function validateForm(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_form";
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}

/** Clear one field error when user edits. */
export function clearFieldError(errors, field) {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

/** First error message for toast fallback. */
export function firstErrorMessage(errors) {
  const values = Object.values(errors);
  return values[0] || "Please fix the highlighted fields";
}
