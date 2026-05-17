import { cn } from "@/lib/utils";

export const INPUT_ERROR_CLASS =
  "border-destructive ring-[3px] ring-destructive/25 focus-visible:border-destructive focus-visible:ring-destructive/30";

export function authInputClass(invalid, className) {
  return cn(
    "auth-input h-10 bg-background/60 sm:h-11",
    invalid && INPUT_ERROR_CLASS,
    className,
  );
}

export function authLabelClass(invalid) {
  return cn("text-foreground", invalid && "text-destructive");
}
