"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLinks } from "@/components/auth/auth-links";
import { authRequest, getActionTokenFromHash } from "@/lib/auth-api";

const HYDRATED_EMPTY_HASH = "hydrated-empty-hash";

function subscribeToHashChanges(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function VerifyEmailFlow() {
  const started = useRef(false);
  const hash = useSyncExternalStore(
    subscribeToHashChanges,
    () => window.location.hash || HYDRATED_EMPTY_HASH,
    () => "",
  );
  const [result, setResult] = useState<
    | { status: "idle" }
    | { status: "success"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const token =
    hash && hash !== HYDRATED_EMPTY_HASH ? getActionTokenFromHash(hash) : null;

  useEffect(() => {
    if (!hash || started.current) {
      return;
    }
    started.current = true;
    if (!token) {
      return;
    }

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    void authRequest<{ message: string }>("verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((response) =>
        setResult({ status: "success", message: response.message }),
      )
      .catch((reason: unknown) => {
        setResult({
          status: "error",
          message:
            reason instanceof Error ? reason.message : "Verification failed.",
        });
      });
  }, [hash, token]);

  const message =
    hash === "" || (token && result.status === "idle")
      ? "Checking your verification link..."
      : result.status === "success"
        ? result.message
        : "";
  const error =
    result.status === "error"
      ? result.message
      : hash === HYDRATED_EMPTY_HASH || (hash && !token)
        ? "Open the verification link from your email to continue."
        : "";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm shadow-primary/25">
            ✓
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Security
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Verify your email
            </h1>
          </div>
        </div>
        {message && (
          <p
            className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            {message}
          </p>
        )}
        {error && (
          <p
            className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <Link
          className="mt-6 inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:text-primary"
          href="/login"
        >
          Continue to sign in
        </Link>
      </section>
    </main>
  );
}

export function ResendVerificationForm() {
  return (
    <div className="pb-8">
      <AuthForm
        description="Request a new link if you cannot find the original email."
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
            "resend-verification",
            {
              method: "POST",
              body: JSON.stringify(values),
            },
          );
          return result.message;
        }}
        submitLabel="Resend verification"
        title="Resend verification email"
      />
      <AuthLinks links={[{ href: "/login", label: "Back to sign in" }]} />
    </div>
  );
}
