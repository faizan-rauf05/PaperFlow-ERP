import { cn } from "@/lib/utils";

export function FieldError({ message, className }) {
  if (!message) return null;
  return (
    <p className={cn("text-xs text-destructive", className)} role="alert">
      {message}
    </p>
  );
}

export function FormField({ label, error, required, children, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium leading-none">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
      )}
      {children}
      <FieldError message={error} />
    </div>
  );
}

/** Apply error border to inputs/selects. */
export function fieldClassName(base, hasError) {
  return cn(base, hasError && "border-destructive focus-visible:ring-destructive/30");
}
