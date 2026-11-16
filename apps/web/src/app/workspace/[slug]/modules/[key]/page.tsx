"use client";

import Link from "next/link";
import { use } from "react";
import { useWorkspace } from "@/components/workspace/workspace-shell";

const moduleNames: Record<string, string> = {
  developer: "Developer",
  barber: "Barber",
  hairdresser: "Hairdresser",
  dentist: "Dentist",
};

export default function ModuleLandingPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const workspace = useWorkspace();
  const { key } = use(params);
  const active = workspace.modules.some(
    (module) => module.key === key && module.enabled,
  );
  const allowed =
    workspace.role !== "member" ||
    workspace.permissions.includes(`${key}:read`);
  if (!active || !allowed || !moduleNames[key])
    return (
      <section className="mx-auto max-w-3xl rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Module unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          This module is disabled or your role does not have access.
        </p>
        <Link
          className="mt-4 inline-block underline"
          href={`/workspace/${workspace.organization.slug}`}
        >
          Return to dashboard
        </Link>
      </section>
    );
  if (key === "developer")
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          {workspace.organization.name}
        </p>
        <h1 className="text-3xl font-semibold">Developer</h1>
        <p className="text-muted-foreground">
          Manage your professional profile, skills and project portfolio.
        </p>
        <Link
          className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
          href={`/workspace/${workspace.organization.slug}/developer`}
        >
          Open Developer workspace
        </Link>
      </section>
    );
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        {workspace.organization.name}
      </p>
      <h1 className="text-3xl font-semibold">{moduleNames[key]}</h1>
      <div className="rounded-xl border border-dashed bg-card p-8">
        <p className="font-medium">Module workspace</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The navigation and access controls are ready. Module features will be
          added in a later sprint.
        </p>
      </div>
    </section>
  );
}
