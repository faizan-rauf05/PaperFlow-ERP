"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBrand } from "@/components/auth/auth-brand";
import { AuthCard, AuthCardBody, AuthCardHeader } from "@/components/auth/auth-card";
import { AuthAlert, AuthField } from "@/components/auth/auth-field";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { authInputClass } from "@/lib/auth-ui";
import { loginSchema } from "@/lib/schemas/auth";
import { getRoleDashboard } from "@/lib/roleAccess";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const successMessage = searchParams.get("message");
  const hasSubmitError = Boolean(submitError);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const emailInvalid = Boolean(errors.email) || hasSubmitError;
  const passwordInvalid = Boolean(errors.password) || hasSubmitError;

  const onSubmit = async (values) => {
    setSubmitError("");
    try {
      await api.post("/auth/login", {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      const { data: sessionData } = await api.get("/auth/session");
      const role = sessionData?.user?.role;
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(
        callbackUrl || (role ? getRoleDashboard(role) : "/dashboard"),
      );
      router.refresh();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Invalid email or password"));
    }
  };

  return (
    <AuthCard>
      <AuthCardHeader>
        <AuthBrand
          title="PaperPro ERP"
          subtitle="Sign in to your factory workspace"
        />
      </AuthCardHeader>

      <AuthCardBody>
        {successMessage && <AuthAlert variant="success">{successMessage}</AuthAlert>}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 space-y-4"
          noValidate
        >
          <AuthField
            id="email"
            label="Email"
            error={errors.email?.message}
            invalid={emailInvalid}
          >
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={emailInvalid}
              className={authInputClass(emailInvalid)}
              {...register("email")}
            />
          </AuthField>

          <AuthField
            id="password"
            label="Password"
            error={errors.password?.message}
            invalid={passwordInvalid}
            labelExtra={
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:text-primary/80"
                tabIndex={isSubmitting ? -1 : 0}
              >
                Forgot password?
              </Link>
            }
          >
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-invalid={passwordInvalid}
                className={authInputClass(passwordInvalid, "pr-11")}
                {...register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:bg-primary/10"
                onClick={() => setShowPassword((p) => !p)}
                disabled={isSubmitting}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </AuthField>

          {submitError && <AuthAlert>{submitError}</AuthAlert>}

          <Button
            type="submit"
            size="lg"
            className="auth-submit-btn h-10 w-full sm:h-11"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="mt-1 text-center text-[11px] text-muted-foreground sm:text-xs">
          Access is managed by your administrator
        </p>
      </AuthCardBody>
    </AuthCard>
  );
}
