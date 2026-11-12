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
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        {message && (
          <p className="mt-4" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 text-destructive" role="alert">
            {error}
          </p>
        )}
        <Link className="mt-6 inline-block underline" href="/login">
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
