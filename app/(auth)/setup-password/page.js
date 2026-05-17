"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBrand } from "@/components/auth/auth-brand";
import { AuthCard, AuthCardBody, AuthCardHeader } from "@/components/auth/auth-card";
import { AuthAlert, AuthField } from "@/components/auth/auth-field";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { authInputClass } from "@/lib/auth-ui";
import { setupPasswordSchema } from "@/lib/schemas/auth";

export default function SetupPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [userName, setUserName] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [checking, setChecking] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(setupPasswordSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const passwordInvalid = Boolean(errors.password);
  const confirmInvalid = Boolean(errors.confirmPassword);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenError("Missing invite or reset token.");
        setChecking(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/validate-token", { params: { token } });
        if (!data?.valid) {
          setTokenError(data?.reason || "This link is invalid or has expired.");
          return;
        }
        setUserName(data.userName || "");
        setTokenValid(true);
      } catch (error) {
        setTokenError(
          getApiErrorMessage(error, "Could not validate token. Please try again."),
        );
      } finally {
        setChecking(false);
      }
    }
    validateToken();
  }, [token]);

  const onSubmit = async (values) => {
    try {
      await api.post("/auth/setup-password", { token, password: values.password });
      router.push(
        "/login?message=" +
          encodeURIComponent("Password set successfully. You can sign in now."),
      );
    } catch (error) {
      setError("root", {
        message: getApiErrorMessage(error, "Failed to set password."),
      });
    }
  };

  return (
    <AuthCard>
      <AuthCardHeader>
        <AuthBrand
          title="Set your password"
          subtitle={
            userName
              ? `Hello, ${userName}`
              : "Create a password for your account"
          }
        />
      </AuthCardHeader>

      <AuthCardBody>
        {checking && (
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating link...
          </p>
        )}

        {!checking && tokenError && <AuthAlert>{tokenError}</AuthAlert>}

        {!checking && tokenValid && (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            <AuthField
              id="password"
              label="New password"
              error={errors.password?.message}
              invalid={passwordInvalid}
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={passwordInvalid}
                className={authInputClass(passwordInvalid)}
                {...register("password")}
              />
            </AuthField>

            <AuthField
              id="confirmPassword"
              label="Confirm password"
              error={errors.confirmPassword?.message}
              invalid={confirmInvalid}
            >
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={confirmInvalid}
                className={authInputClass(confirmInvalid)}
                {...register("confirmPassword")}
              />
            </AuthField>

            {errors.root?.message && <AuthAlert>{errors.root.message}</AuthAlert>}

            <Button type="submit" className="h-10 w-full sm:h-11" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Set password"
              )}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Back to sign in
          </Link>
        </p>
      </AuthCardBody>
    </AuthCard>
  );
}
