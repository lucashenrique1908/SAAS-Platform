"use client";

import { useEffect, useRef, useState } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLinks } from "@/components/auth/auth-links";
import { authRequest, getActionTokenFromHash } from "@/lib/auth-api";

export function ResetPasswordFlow() {
  const started = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    const actionToken = getActionTokenFromHash(window.location.hash);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    setToken(actionToken);
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      {token ? (
        <AuthForm
          description="Choose a new password with at least 12 characters."
          fields={[
            {
              name: "password",
              label: "New password",
              type: "password",
              autoComplete: "new-password",
              minLength: 12,
            },
          ]}
          onSubmit={async (values) => {
            const result = await authRequest<{ message: string }>(
              "reset-password",
              {
                method: "POST",
                body: JSON.stringify({ token, password: values.password }),
              },
            );
            setToken(null);
            setCompleted(true);
            return result.message;
          }}
          submitLabel="Reset password"
          title="Set a new password"
        />
      ) : completed ? (
        <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Password updated</h1>
          <p className="mt-4" role="status">
            Your password has been reset. Sign in with your new password.
          </p>
        </section>
      ) : (
        <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="mt-4" role="status">
            Open the password reset link from your email to continue.
          </p>
        </section>
      )}
      <AuthLinks links={[{ href: "/login", label: "Back to sign in" }]} />
    </main>
  );
}
