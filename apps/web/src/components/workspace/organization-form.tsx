"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { organizationRequest } from "@/lib/auth-api";

type OrganizationFields = {
  name: string;
  description: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  industry: string | null;
  taxId: string | null;
};

const fields = [
  ["name", "Organization name", "text", true],
  ["description", "Description", "textarea", false],
  ["logoUrl", "Logo URL", "url", false],
  ["contactEmail", "Contact email", "email", false],
  ["phone", "Phone", "tel", false],
  ["website", "Website", "url", false],
  ["country", "Country", "text", false],
  ["industry", "Industry", "text", false],
  ["taxId", "Tax identification number", "text", false],
] as const;

export function OrganizationForm({
  initial,
  slug,
  role,
  onboarding = false,
}: {
  initial?: OrganizationFields;
  slug?: string;
  role?: "owner" | "admin";
  onboarding?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<OrganizationFields>(
    initial ?? {
      name: "",
      description: null,
      logoUrl: null,
      contactEmail: null,
      phone: null,
      website: null,
      country: null,
      industry: null,
      taxId: null,
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slugValue, setSlugValue] = useState("");
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);

  async function checkSlug() {
    if (!slugValue.trim()) return;
    try {
      const result = await organizationRequest<{
        available: boolean;
        slug: string;
        suggestions: string[];
      }>(
        `slug-availability?slug=${encodeURIComponent(slugValue)}${slug ? `&exclude=${encodeURIComponent(slug)}` : ""}`,
      );
      setSlugValue(result.slug);
      setSlugSuggestions(result.suggestions);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not check the slug.",
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (onboarding) {
        const result = await organizationRequest<{ slug: string }>("", {
          method: "POST",
          body: JSON.stringify(values),
        });
        router.push(`/workspace/${result.slug}`);
      } else {
        const slugChanged = Boolean(slugValue && slugValue !== slug);
        if (
          slugChanged &&
          !window.confirm(
            `Change the workspace URL to “${slugValue}”? Existing links using the old slug will stop working.`,
          )
        ) {
          setBusy(false);
          return;
        }
        const result = await organizationRequest<{ slug: string }>(
          encodeURIComponent(slug!),
          {
            method: "PATCH",
            body: JSON.stringify({
              ...(role === "owner" ? { name: values.name } : {}),
              description: values.description,
              logoUrl: values.logoUrl,
              contactEmail: values.contactEmail,
              phone: values.phone,
              website: values.website,
              country: values.country,
              industry: values.industry,
              taxId: values.taxId,
              ...(slugChanged
                ? { slug: slugValue, confirmSlugChange: true }
                : {}),
            }),
          },
        );
        if (result.slug !== slug)
          router.push(`/workspace/${result.slug}/settings`);
        else router.refresh();
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save the organization.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isOwner = onboarding || role === "owner";

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields
          .filter(([key]) => isOwner || key !== "name")
          .map(([key, label, type, required]) => (
            <div
              className={`space-y-2 ${key === "description" ? "sm:col-span-2" : ""}`}
              key={key}
            >
              <label className="text-sm font-medium" htmlFor={key}>
                {label}
              </label>
              {type === "textarea" ? (
                <textarea
                  className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  id={key}
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value || null,
                    }))
                  }
                  value={values[key] ?? ""}
                />
              ) : (
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  id={key}
                  maxLength={key === "name" ? 120 : 2048}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value || (key === "name" ? "" : null),
                    }))
                  }
                  required={required}
                  type={type}
                  value={values[key] ?? ""}
                />
              )}
            </div>
          ))}
      </div>
      {!onboarding && isOwner && (
        <section className="space-y-2 rounded-lg border p-4">
          <label className="text-sm font-medium" htmlFor="workspace-slug">
            Workspace URL
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm"
              id="workspace-slug"
              onChange={(event) => setSlugValue(event.target.value)}
              placeholder={slug}
              value={slugValue}
            />
            <button
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() => void checkSlug()}
              type="button"
            >
              Check availability
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Current URL: /workspace/{slug}
          </p>
          {slugSuggestions.length > 0 && (
            <p className="text-sm">
              Suggestions:{" "}
              {slugSuggestions.map((suggestion) => (
                <button
                  className="ml-2 underline"
                  key={suggestion}
                  onClick={() => setSlugValue(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </p>
          )}
        </section>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={busy}
        type="submit"
      >
        {busy ? "Saving…" : onboarding ? "Create workspace" : "Save changes"}
      </button>
    </form>
  );
}
