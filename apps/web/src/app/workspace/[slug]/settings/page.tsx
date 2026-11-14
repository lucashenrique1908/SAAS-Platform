"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrganizationForm } from "@/components/workspace/organization-form";
import { useWorkspace } from "@/components/workspace/workspace-shell";
import { organizationRequest } from "@/lib/auth-api";

export default function OrganizationSettingsPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const { organization, role } = workspace;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = role === "owner" || role === "admin";

  async function deactivate() {
    if (
      !window.confirm(
        `Deactivate ${organization.name}? Members will lose access until an Owner reactivates it.`,
      )
    )
      return;
    setBusy(true);
    try {
      await organizationRequest(
        `${encodeURIComponent(organization.slug)}/deactivate`,
        { method: "PATCH" },
      );
      router.push("/profile");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not deactivate the organization.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removePermanently() {
    const confirmation = window.prompt(
      `Permanently delete this workspace and its organization-scoped data. Type “${organization.name}” to confirm.`,
    );
    if (confirmation !== organization.name) return;
    setBusy(true);
    try {
      await organizationRequest(encodeURIComponent(organization.slug), {
        method: "DELETE",
        body: JSON.stringify({ confirmName: confirmation }),
      });
      router.push("/profile");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete the organization.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold">Organization settings</h1>
        <p className="mt-2 text-muted-foreground">
          Update organization information and access.
        </p>
      </header>
      {canManage ? (
        <section className="rounded-xl border bg-card p-5 sm:p-7">
          <h2 className="mb-6 text-lg font-semibold">General information</h2>
          <OrganizationForm
            initial={{
              name: organization.name,
              description: organization.description,
              logoUrl: organization.logoUrl,
              contactEmail: organization.contactEmail,
              phone: organization.phone,
              website: organization.website,
              country: organization.country,
              industry: organization.industry,
              taxId: organization.taxId,
            }}
            role={role}
            slug={organization.slug}
          />
        </section>
      ) : (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Organization information</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Organization settings can be edited by an Owner or Admin.
          </p>
        </section>
      )}
      {role === "owner" && (
        <section className="space-y-4 rounded-xl border border-destructive/40 bg-card p-5 sm:p-7">
          <div>
            <h2 className="text-lg font-semibold">Organization lifecycle</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Deactivation preserves workspace data. Permanent deletion removes
              memberships, invitations, activity and module settings.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => void deactivate()}
              type="button"
            >
              Deactivate organization
            </button>
            <button
              className="rounded-md bg-destructive px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void removePermanently()}
              type="button"
            >
              Delete permanently
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
