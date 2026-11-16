"use client";

import { useCallback, useEffect, useState } from "react";
import { organizationRequest, organizationUpload } from "@/lib/auth-api";

type Kind = "experiences" | "education" | "certifications" | "projects";
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  array?: boolean;
};
type RecordItem = Record<string, unknown> & { id: string };

const configs: Record<Kind, { title: string; fields: Field[] }> = {
  experiences: {
    title: "Professional experience",
    fields: [
      { name: "jobTitle", label: "Job title", required: true },
      { name: "company", label: "Company", required: true },
      { name: "location", label: "Location" },
      {
        name: "employmentType",
        label: "Employment type",
        options: [
          "full_time",
          "part_time",
          "contract",
          "freelance",
          "internship",
        ],
      },
      {
        name: "workModality",
        label: "Work modality",
        options: ["onsite", "hybrid", "remote"],
      },
      { name: "startDate", label: "Start date", type: "date", required: true },
      { name: "endDate", label: "End date", type: "date" },
      { name: "isCurrent", label: "Current position", type: "checkbox" },
      { name: "description", label: "Description", type: "textarea" },
      {
        name: "responsibilities",
        label: "Responsibilities (comma separated)",
        array: true,
      },
      {
        name: "achievements",
        label: "Achievements (comma separated)",
        array: true,
      },
      {
        name: "technologies",
        label: "Technologies (comma separated)",
        array: true,
      },
      { name: "companyUrl", label: "Company URL", type: "url" },
    ],
  },
  education: {
    title: "Education",
    fields: [
      { name: "institution", label: "Institution", required: true },
      { name: "course", label: "Course", required: true },
      { name: "degree", label: "Degree" },
      { name: "startDate", label: "Start date", type: "date" },
      { name: "endDate", label: "End date", type: "date" },
      { name: "isInProgress", label: "In progress", type: "checkbox" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "institutionUrl", label: "Institution URL", type: "url" },
    ],
  },
  certifications: {
    title: "Certifications",
    fields: [
      { name: "name", label: "Certification", required: true },
      {
        name: "issuingInstitution",
        label: "Issuing institution",
        required: true,
      },
      { name: "issueDate", label: "Issue date", type: "date" },
      { name: "expirationDate", label: "Expiration date", type: "date" },
      { name: "credentialUrl", label: "Credential URL", type: "url" },
    ],
  },
  projects: {
    title: "Projects & portfolio",
    fields: [
      { name: "name", label: "Project name", required: true },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
      { name: "problemSolved", label: "Problem solved", type: "textarea" },
      {
        name: "technologies",
        label: "Technologies (comma separated)",
        array: true,
      },
      { name: "liveUrl", label: "Live project URL", type: "url" },
      { name: "repositoryUrl", label: "Repository URL", type: "url" },
      { name: "startDate", label: "Start date", type: "date" },
      { name: "completionDate", label: "Completion date", type: "date" },
      {
        name: "status",
        label: "Status",
        options: ["in_progress", "completed", "archived"],
      },
      { name: "memberRole", label: "Your role" },
      {
        name: "projectType",
        label: "Project type",
        options: ["individual", "team"],
      },
      {
        name: "mainFeatures",
        label: "Main features (comma separated)",
        array: true,
      },
      { name: "isFeatured", label: "Featured project", type: "checkbox" },
      { name: "displayOrder", label: "Display order", type: "number" },
    ],
  },
};

export function DeveloperRecordEditor({
  slug,
  kind,
}: {
  slug: string;
  kind: Kind;
}) {
  const config = configs[kind];
  const endpoint = `${encodeURIComponent(slug)}/developer/${kind}`;
  const [items, setItems] = useState<RecordItem[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [busy, setBusy] = useState(false);
  const [repositories, setRepositories] = useState<
    Array<{ repositoryUrl: string; name: string }>
  >([]);

  const load = useCallback(async () => {
    try {
      const rows = await organizationRequest<RecordItem[]>(endpoint);
      setItems(rows);
      setStatus("");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not load records.",
      );
    }
  }, [endpoint]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  function reset() {
    setEditingId(null);
    setValues(
      Object.fromEntries(
        config.fields.map((field) => [
          field.name,
          field.type === "checkbox" ? false : "",
        ]),
      ),
    );
  }

  function edit(item: RecordItem) {
    setEditingId(item.id);
    setValues(
      Object.fromEntries(
        config.fields.map((field) => {
          const value = item[field.name];
          return [
            field.name,
            field.array
              ? Array.isArray(value)
                ? value.join(", ")
                : ""
              : value == null
                ? field.type === "checkbox"
                  ? false
                  : ""
                : (value as string | boolean),
          ];
        }),
      ),
    );
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      const value = values[field.name];
      if (field.array)
        payload[field.name] = String(value ?? "")
          .split(/[\n,]/)
          .map((entry) => entry.trim())
          .filter(Boolean);
      else if (field.type === "checkbox") payload[field.name] = Boolean(value);
      else if (field.type === "number")
        payload[field.name] = value === "" ? 0 : Number(value);
      else payload[field.name] = value === "" ? null : value;
    }
    try {
      await organizationRequest(endpoint + (editingId ? `/${editingId}` : ""), {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      reset();
      await load();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save record.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await organizationRequest(`${endpoint}/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) reset();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not remove record.",
      );
    }
  }

  async function uploadAttachment(id: string, file: File) {
    setStatus("");
    try {
      const path =
        kind === "projects"
          ? `${encodeURIComponent(slug)}/developer/files/projects/${id}/cover`
          : `${encodeURIComponent(slug)}/developer/files/certifications/${id}`;
      await organizationUpload(path, file);
      setStatus("File uploaded successfully.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not upload file.",
      );
    }
  }

  async function loadGithubRepositories() {
    setStatus("");
    try {
      setRepositories(
        await organizationRequest<
          Array<{ repositoryUrl: string; name: string }>
        >(
          `${encodeURIComponent(slug)}/developer/integrations/github/repositories`,
        ),
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Connect GitHub before importing a repository.",
      );
    }
  }

  async function previewGithubRepository(repositoryUrl: string) {
    setStatus("");
    try {
      const preview = await organizationRequest<{
        name: string;
        description: string;
        technologies: string[];
        repositoryUrl: string;
        liveUrl: string | null;
        status: string;
        projectType: string;
      }>(
        `${encodeURIComponent(slug)}/developer/integrations/github/import-preview`,
        { method: "POST", body: JSON.stringify({ repositoryUrl }) },
      );
      setValues((current) => ({
        ...current,
        name: preview.name,
        description: preview.description,
        technologies: preview.technologies.join(", "),
        repositoryUrl: preview.repositoryUrl,
        liveUrl: preview.liveUrl ?? "",
        status: preview.status,
        projectType: preview.projectType,
      }));
      setStatus(
        "GitHub project preview loaded. Review the form and save it to your portfolio.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not preview the repository.",
      );
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">{config.title}</h1>
      </header>
      {status && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {status}
        </p>
      )}
      {kind === "projects" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => void loadGithubRepositories()}
          >
            Load public GitHub repositories
          </button>
          {repositories.length > 0 && (
            <select
              aria-label="GitHub repository"
              className="rounded-md border bg-background p-2"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value)
                  void previewGithubRepository(event.target.value);
              }}
            >
              <option value="">Choose repository to preview</option>
              {repositories.map((repository) => (
                <option
                  key={repository.repositoryUrl}
                  value={repository.repositoryUrl}
                >
                  {repository.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <form
        onSubmit={save}
        className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2"
      >
        {config.fields.map((field) => (
          <label
            className={`space-y-1 text-sm ${field.type === "textarea" ? "md:col-span-2" : ""}`}
            key={field.name}
          >
            {field.type === "checkbox" ? (
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(values[field.name])}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: event.target.checked,
                    }))
                  }
                />
                {field.label}
              </span>
            ) : (
              <>
                <span>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                {field.options ? (
                  <select
                    className="w-full rounded-md border bg-background p-2"
                    value={String(values[field.name] ?? "")}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose…</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" || field.array ? (
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-background p-2"
                    required={field.required}
                    value={String(values[field.name] ?? "")}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <input
                    className="w-full rounded-md border bg-background p-2"
                    type={field.type ?? "text"}
                    required={field.required}
                    value={String(values[field.name] ?? "")}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                )}
              </>
            )}
          </label>
        ))}
        <div className="flex gap-3">
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Saving…" : editingId ? "Update" : "Add"}
          </button>
          {editingId && (
            <button
              type="button"
              className="rounded-md border px-4 py-2"
              onClick={reset}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <article
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            key={item.id}
          >
            <div>
              <h2 className="font-medium">
                {String(
                  item.name ??
                    item.jobTitle ??
                    item.course ??
                    item.institution ??
                    "",
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {String(
                  item.company ?? item.issuingInstitution ?? item.status ?? "",
                )}
              </p>
              {(kind === "projects" || kind === "certifications") && (
                <label className="mt-2 block text-xs">
                  {kind === "projects"
                    ? "Project cover"
                    : "Private certificate"}
                  <input
                    type="file"
                    accept={
                      kind === "projects"
                        ? "image/png,image/jpeg,image/webp"
                        : "application/pdf,image/png,image/jpeg,image/webp"
                    }
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAttachment(item.id, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <div className="flex gap-3">
              <button
                className="text-sm underline"
                type="button"
                onClick={() => edit(item)}
              >
                Edit
              </button>
              <button
                className="text-sm underline"
                type="button"
                onClick={() => void remove(item.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 && !status && (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Nothing added yet. These records are optional.
          </p>
        )}
      </div>
    </section>
  );
}
