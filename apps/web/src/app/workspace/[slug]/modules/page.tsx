"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-shell";
import { organizationRequest } from "@/lib/auth-api";

const moduleInfo = [
  {
    key: "developer",
    name: "Developer",
    description: "Tools for software development teams.",
  },
  {
    key: "barber",
    name: "Barber",
    description: "A starting workspace for barber businesses.",
  },
  {
    key: "hairdresser",
    name: "Hairdresser",
    description: "A starting workspace for hair salons.",
  },
  {
    key: "dentist",
    name: "Dentist",
    description: "A starting workspace for dental practices.",
  },
] as const;

export default function ModulesPage() {
  const workspace = useWorkspace();
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const { organization, role, modules } = workspace;
  if (role === "member")
    return (
      <section className="mx-auto max-w-3xl rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Module access</h1>
        <p className="mt-2 text-muted-foreground">
          An Owner or Admin manages modules for this workspace.
        </p>
      </section>
    );

  async function toggle(key: string, enabled: boolean) {
    setBusyKey(key);
    setError("");
    try {
      await organizationRequest(
        `${encodeURIComponent(organization.slug)}/modules`,
        { method: "PATCH", body: JSON.stringify({ key, enabled }) },
      );
      window.location.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update the module.",
      );
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
        <h1 className="mt-1 text-3xl font-semibold">Modules</h1>
        <p className="mt-2 text-muted-foreground">
          Choose which module starting pages are available in this workspace.
        </p>
      </header>
      <div className="space-y-3">
        {moduleInfo.map((module) => {
          const enabled = modules.some(
            (item) => item.key === module.key && item.enabled,
          );
          return (
            <article
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5"
              key={module.key}
            >
              <div>
                <h2 className="font-semibold">{module.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {module.description}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {enabled ? "Active and available" : "Disabled"}
                </p>
              </div>
              <button
                aria-pressed={enabled}
                className={`rounded-md px-4 py-2 text-sm ${enabled ? "border" : "bg-primary text-primary-foreground"}`}
                disabled={busyKey === module.key}
                onClick={() => void toggle(module.key, !enabled)}
                type="button"
              >
                {busyKey === module.key
                  ? "Saving…"
                  : enabled
                    ? "Disable"
                    : "Enable"}
              </button>
            </article>
          );
        })}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
