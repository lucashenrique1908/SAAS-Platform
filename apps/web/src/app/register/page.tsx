"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthLinks } from "@/components/auth/auth-links";
import { authRequest } from "@/lib/auth-api";
import { useEffect } from "react";
import { getActionTokenFromHash } from "@/lib/auth-api";

export default function RegisterPage() {
  useEffect(() => {
    const token = getActionTokenFromHash(window.location.hash);
    if (token) {
      sessionStorage.setItem("saas_invitation_token", token);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return (
    <main className="flex w-full min-w-0 flex-1 flex-col items-center justify-center px-6 py-12">
      <AuthForm
        description="Create an account, verify your email, then set up your first workspace."
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password (at least 12 characters)",
            type: "password",
            autoComplete: "new-password",
            minLength: 12,
          },
        ]}
        onSubmit={async (values) => {
          const result = await authRequest<{ message: string }>("register", {
            method: "POST",
            body: JSON.stringify(values),
          });
          return result.message;
        }}
        submitLabel="Create account"
        title="Create your account"
      />
      <AuthLinks
        links={[
          { href: "/login", label: "Already have an account? Sign in" },
          { href: "/verify-email", label: "Resend verification email" },
        ]}
      />
    </main>
  );
}
