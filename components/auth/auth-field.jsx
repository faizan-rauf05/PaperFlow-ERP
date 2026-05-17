import { Label } from "@/components/ui/label";
import { authLabelClass } from "@/lib/auth-ui";
import { cn } from "@/lib/utils";

export function AuthFieldError({ message }) {
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-destructive sm:text-sm" role="alert">
      {message}
    </p>
  );
}

export function AuthField({
  id,
  label,
  error,
  invalid,
  labelExtra,
  children,
  className,
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className={authLabelClass(invalid)}>
          {label}
        </Label>
        {labelExtra}
      </div>
      {children}
      <AuthFieldError message={error} />
    </div>
  );
}

export function AuthAlert({ variant = "error", children, className }) {
  const styles =
    variant === "success"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-destructive/40 bg-destructive/10 text-destructive";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-center text-xs font-medium sm:text-sm",
        styles,
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
