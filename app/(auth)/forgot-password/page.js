"use client";

import { useState } from "react";
import Link from "next/link";
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
import { forgotPasswordSchema } from "@/lib/schemas/auth";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const emailInvalid = Boolean(errors.email);

  const onSubmit = async (values) => {
    try {
      await api.post("/auth/forgot-password", {
        email: values.email.trim().toLowerCase(),
      });
      setSubmitted(true);
    } catch (error) {
      setError("root", {
        message: getApiErrorMessage(error, "Request failed. Please try again."),
      });
    }
  };

  return (
    <AuthCard>
      <AuthCardHeader>
        <AuthBrand
          title="Reset password"
          subtitle="We'll email you a secure link if your account exists"
        />
      </AuthCardHeader>

      <AuthCardBody>
        {submitted ? (
          <AuthAlert variant="success">
            If an account exists for that email, we sent instructions to reset your
            password.
          </AuthAlert>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
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

            {errors.root?.message && <AuthAlert>{errors.root.message}</AuthAlert>}

            <Button type="submit" className="h-10 w-full sm:h-11" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
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
