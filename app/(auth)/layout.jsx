import { Suspense } from "react";
import { AuthBackground } from "@/components/auth/auth-background";
import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle";
import { AuthPageFooter } from "@/components/auth/auth-card";

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page-shell">
      <AuthBackground />
      <AuthThemeToggle />

      <div className="auth-page-inner">
        <Suspense fallback={<div className="auth-card-enter auth-glass-card h-[320px] w-full max-w-md animate-pulse" />}>
          {children}
        </Suspense>
      </div>

      <AuthPageFooter />
    </div>
  );
}
