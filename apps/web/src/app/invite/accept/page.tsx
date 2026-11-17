"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  authRequest,
  getActionTokenFromHash,
  organizationRequest,
} from "@/lib/auth-api";

const INVITATION_CHANGED = "saas-invitation-changed";

function subscribeToInvitation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(INVITATION_CHANGED, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(INVITATION_CHANGED, onChange);
  };
}

function getInvitationToken() {
  return (
    getActionTokenFromHash(window.location.hash) ??
    sessionStorage.getItem("saas_invitation_token")
  );
}

export default function AcceptInvitationPage() {
  const router = useRouter();
  const invitationToken = useSyncExternalStore(
    subscribeToInvitation,
    getInvitationToken,
    () => null,
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getActionTokenFromHash(window.location.hash);
    if (token) {
      sessionStorage.setItem("saas_invitation_token", token);
      window.history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new Event(INVITATION_CHANGED));
    }
    void authRequest("me")
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

  async function accept() {
    const token =
      invitationToken ?? sessionStorage.getItem("saas_invitation_token");
    if (!token) {
      setError(
        "The invitation link is missing. Open the link from your email again.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await organizationRequest<{
        organization: { slug: string };
      }>("invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      sessionStorage.removeItem("saas_invitation_token");
      router.push(`/workspace/${result.organization.slug}`);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not accept this invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border bg-card p-8">
        <p className="text-sm font-medium text-muted-foreground">
          Workspace invitation
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Join an organization</h1>
        {!invitationToken && (
          <p className="mt-3 text-sm text-muted-foreground">
            Open the invitation link from your email to continue.
          </p>
        )}
        {invitationToken && authenticated && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Your signed-in account must use the email address that received
              the invitation, and that email must be verified.
            </p>
            <button
              className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void accept()}
              type="button"
            >
              {busy ? "Accepting…" : "Accept invitation"}
            </button>
          </>
        )}
        {invitationToken && !authenticated && (
          <div className="mt-5 space-y-3 text-sm">
            <p>
              Sign in with the invited, verified email address, or create an
              account and verify that address first. Return here after signing
              in to accept the invite.
            </p>
            <div className="flex gap-3">
              <Link
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                href="/login"
              >
                Sign in
              </Link>
              <Link className="rounded-md border px-4 py-2" href="/register">
                Create account
              </Link>
            </div>
          </div>
        )}
        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
