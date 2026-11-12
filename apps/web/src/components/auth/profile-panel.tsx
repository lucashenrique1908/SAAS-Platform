"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authRequest } from "@/lib/auth-api";
import type { ProfileData, SessionData } from "@/lib/auth-session";

export function ProfilePanel({
  profile,
  initialSessions,
}: {
  profile: ProfileData;
  initialSessions: SessionData[];
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await authRequest("logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign out failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(session: SessionData) {
    setBusy(true);
    setError("");
    try {
      await authRequest(`sessions/${session.id}`, { method: "DELETE" });
      if (session.isCurrent) {
        router.push("/login");
        router.refresh();
        return;
      }
      setSessions((current) =>
        current.filter((item) => item.id !== session.id),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not revoke session.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function logoutAll() {
    setBusy(true);
    setError("");
    try {
      await authRequest("logout-all", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign out failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your account</h1>
          <p className="mt-2 text-muted-foreground">{profile.email}</p>
        </div>
        <button
          className="rounded-md border px-4 py-2 text-sm"
          disabled={busy}
          onClick={() => void logout()}
          type="button"
        >
          Sign out
        </button>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Organizations</h2>
        <ul className="mt-3 space-y-2">
          {profile.memberships.map((membership) => (
            <li
              className="flex justify-between rounded-md border p-3"
              key={membership.organizationId}
            >
              <span>{membership.organizationName}</span>
              <span className="text-sm text-muted-foreground">
                {membership.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Active sessions</h2>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={busy}
            onClick={() => void logoutAll()}
            type="button"
          >
            Sign out all sessions
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {sessions.map((session) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              key={session.id}
            >
              <span>
                {session.isCurrent ? "This session" : "Other session"} · expires{" "}
                {new Date(session.expiresAt).toLocaleString()}
              </span>
              <button
                className="rounded-md border px-3 py-2 text-sm"
                disabled={busy}
                onClick={() => void revokeSession(session)}
                type="button"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
