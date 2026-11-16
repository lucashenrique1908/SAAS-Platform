"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { organizationRequest, organizationUpload } from "@/lib/auth-api";

type Profile = {
  publicId: string;
  displayName: string;
  title: string | null;
  biography: string | null;
  location: string | null;
  yearsExperience: number | null;
  availability: "available" | "open_to_offers" | "not_looking";
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  isPublic: boolean;
  photoFileId: string | null;
};

const fields = [
  ["displayName", "Professional name"],
  ["title", "Professional title"],
  ["location", "Location"],
  ["yearsExperience", "Years of experience"],
  ["githubUrl", "GitHub URL"],
  ["linkedinUrl", "LinkedIn URL"],
  ["websiteUrl", "Personal website"],
] as const;

export function DeveloperProfileEditor({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({
    displayName: "",
    title: "",
    biography: "",
    location: "",
    yearsExperience: "",
    availability: "open_to_offers",
    githubUrl: "",
    linkedinUrl: "",
    websiteUrl: "",
    isPublic: true,
  });
  const [status, setStatus] = useState("Loading profile…");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let mounted = true;
    organizationRequest<Profile>(
      `${encodeURIComponent(slug)}/developer/profile`,
    )
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setValues({
          displayName: data.displayName,
          title: data.title ?? "",
          biography: data.biography ?? "",
          location: data.location ?? "",
          yearsExperience:
            data.yearsExperience === null ? "" : String(data.yearsExperience),
          availability: data.availability,
          githubUrl: data.githubUrl ?? "",
          linkedinUrl: data.linkedinUrl ?? "",
          websiteUrl: data.websiteUrl ?? "",
          isPublic: data.isPublic,
        });
        setStatus("");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(
          error instanceof Error && "status" in error && error.status === 404
            ? ""
            : "Could not load your profile.",
        );
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const saved = await organizationRequest<Profile>(
        `${encodeURIComponent(slug)}/developer/profile`,
        {
          method: "PUT",
          body: JSON.stringify(values),
        },
      );
      setProfile(saved);
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await organizationUpload<{ fileId: string }>(
        `${encodeURIComponent(slug)}/developer/files/profile-photo`,
        file,
      );
      setProfile((current) =>
        current ? { ...current, photoFileId: result.fileId } : current,
      );
      setStatus("Profile photo uploaded. Save profile changes if needed.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not upload the photo.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">Professional profile</h1>
        <p className="mt-2 text-muted-foreground">
          Education and certifications are optional. Your profile is public by
          default and can be made private at any time.
        </p>
      </header>
      {status && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {status}
        </p>
      )}
      <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={save}>
        {profile?.photoFileId && (
          <Image
            className="h-24 w-24 rounded-full object-cover"
            src={`/api/organizations/${encodeURIComponent(slug)}/developer/files/${profile.photoFileId}`}
            alt={`${profile.displayName} profile`}
            width={96}
            height={96}
            unoptimized
          />
        )}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Profile photograph</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={(event) => void uploadPhoto(event.target.files?.[0])}
          />
          <span className="block text-xs text-muted-foreground">
            PNG, JPEG or WebP; maximum 5 MB.
          </span>
        </label>
        {fields.map(([key, label]) => (
          <label className="block space-y-1" key={key}>
            <span className="text-sm font-medium">
              {label}
              {key === "displayName" ? " *" : ""}
            </span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              required={key === "displayName"}
              maxLength={key === "displayName" ? 120 : 2048}
              type={
                key.endsWith("Url")
                  ? "url"
                  : key === "yearsExperience"
                    ? "number"
                    : "text"
              }
              min={key === "yearsExperience" ? 0 : undefined}
              max={key === "yearsExperience" ? 80 : undefined}
              value={String(values[key] ?? "")}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Biography</span>
          <textarea
            className="min-h-32 w-full rounded-md border bg-background px-3 py-2"
            maxLength={5000}
            value={String(values.biography ?? "")}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                biography: event.target.value,
              }))
            }
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Availability</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={String(values.availability)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                availability: event.target.value,
              }))
            }
          >
            <option value="available">Available</option>
            <option value="open_to_offers">Open to offers</option>
            <option value="not_looking">Not looking</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(values.isPublic)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                isPublic: event.target.checked,
              }))
            }
          />
          <span className="text-sm">Show this profile publicly</span>
        </label>
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
      {profile && (
        <a
          className="text-sm underline"
          href={`/developers/${profile.publicId}`}
          target="_blank"
          rel="noreferrer"
        >
          Open shareable profile
        </a>
      )}
    </section>
  );
}
