"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthLinks } from "@/components/auth/auth-links";
import { authRequest } from "@/lib/auth-api";

export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <AuthForm
        description="Create an account and your first organization."
        fields={[
          {
            name: "organizationName",
            label: "Organization name",
            type: "text",
            autoComplete: "organization",
            minLength: 2,
          },
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
