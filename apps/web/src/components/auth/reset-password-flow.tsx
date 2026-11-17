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
        <section className="w-full max-w-md rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-base font-semibold text-white shadow-sm shadow-emerald-500/25">
              ✓
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Security
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Password updated
              </h1>
            </div>
          </div>
          <p
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            Your password has been reset. Sign in with your new password.
          </p>
        </section>
      ) : (
        <section className="w-full max-w-md rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm shadow-primary/25">
              🔒
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Security
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Reset your password
              </h1>
            </div>
          </div>
          <p
            className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-medium text-muted-foreground"
            role="status"
          >
            Open the password reset link from your email to continue.
          </p>
        </section>
      )}
      <AuthLinks links={[{ href: "/login", label: "Back to sign in" }]} />
    </main>
  );
}
