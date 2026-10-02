import { cn } from "@/lib/utils";

export function FieldError({ message, className }) {
  if (!message) return null;
  return (
    <p className={cn("text-xs text-destructive", className)} role="alert">
      {message}
    </p>
  );
}

// Border colour for every kind of control a field can hold: text/number/date
// inputs, textareas, Select and SearchableSelect triggers (role="combobox"),
// and grouped inputs (e.g. amount + currency). Radios/checkboxes are left alone.
const WARNING_BORDER =
  "[&_input:not([type=radio]):not([type=checkbox])]:border-amber-500! [&_textarea]:border-amber-500! [&_[role=combobox]]:border-amber-500! [&_[data-slot=input-group]]:border-amber-500!";
const ERROR_BORDER =
  "[&_input:not([type=radio]):not([type=checkbox])]:border-destructive! [&_textarea]:border-destructive! [&_[role=combobox]]:border-destructive! [&_[data-slot=input-group]]:border-destructive!";

/**
 * A labelled form control.
 * - `hint`: neutral helper text under the control.
 * - `warning`: something to double-check (e.g. an AI scan read with low
 *   confidence) — amber text under the control and an amber border on it.
 * - `error`: validation error — red text and border; takes precedence over a warning.
 */
export function FormField({ label, error, required, children, className, hint, warning }) {
  const showWarning = Boolean(warning) && !error;
  return (
    <div className={cn("space-y-2", className, showWarning && WARNING_BORDER, error && ERROR_BORDER)}>
      {label && (
        <label className="block text-sm font-medium leading-none">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
      {showWarning && <p className="text-xs font-medium leading-snug text-amber-600 dark:text-amber-400">{warning}</p>}
      <FieldError message={error} />
    </div>
  );
}

/** Apply error border to inputs/selects. */
export function fieldClassName(base, hasError) {
  return cn(base, hasError && "border-destructive focus-visible:ring-destructive/30");
}
