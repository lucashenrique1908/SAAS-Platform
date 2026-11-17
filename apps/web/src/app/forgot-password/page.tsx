"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthLinks } from "@/components/auth/auth-links";
import { authRequest } from "@/lib/auth-api";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <AuthForm
        description="If the account exists, we will email password reset instructions."
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
        ]}
        onSubmit={async (values) => {
          const result = await authRequest<{ message: string }>(
            "forgot-password",
            {
              method: "POST",
              body: JSON.stringify(values),
            },
          );
          return result.message;
        }}
        submitLabel="Send recovery email"
        title="Recover your password"
      />
      <AuthLinks links={[{ href: "/login", label: "Back to sign in" }]} />
    </main>
  );
}
