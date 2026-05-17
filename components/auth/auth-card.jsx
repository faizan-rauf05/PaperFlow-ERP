import { cn } from "@/lib/utils";

export function AuthCard({ children, className }) {
  return (
    <div className={cn("auth-glass-card auth-card-enter w-full max-w-md", className)}>
      {children}
    </div>
  );
}

export function AuthCardHeader({ children, className }) {
  return (
    <div className={cn("px-5 pt-6 pb-1 text-center sm:px-7 sm:pt-7", className)}>
      {children}
    </div>
  );
}

export function AuthCardBody({ children, className }) {
  return (
    <div className={cn("px-5 pb-6 sm:px-7 sm:pb-7", className)}>{children}</div>
  );
}

export function AuthPageFooter() {
  return (
    <p className="auth-footer shrink-0 py-2 text-center text-[11px] text-muted-foreground/80 sm:text-xs">
      © {new Date().getFullYear()} PaperPro ERP
    </p>
  );
}
