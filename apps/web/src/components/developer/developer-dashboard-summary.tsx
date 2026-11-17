"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { organizationRequest } from "@/lib/auth-api";

type Profile = {
  displayName: string;
  title: string | null;
  biography: string | null;
  location: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  photoFileId: string | null;
  skills: Array<{ id: string }>;
};
export function DeveloperDashboardSummary({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("Loading your profile…");
  const load = useCallback(async () => {
    try {
      setProfile(
        await organizationRequest<Profile>(
          `${encodeURIComponent(slug)}/developer/profile`,
        ),
      );
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Profile summary is unavailable.",
      );
    }
  }, [slug]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);
  if (!profile)
    return (
      <p
        role="status"
        className="rounded-xl border p-5 text-sm text-muted-foreground"
      >
        {message}.{" "}
        <Link
          className="underline"
          href={`/workspace/${encodeURIComponent(slug)}/developer/profile`}
        >
          Open your profile
        </Link>
      </p>
    );
  const checks = [
    Boolean(profile.displayName),
    Boolean(profile.title),
    Boolean(profile.biography),
    Boolean(profile.location),
    Boolean(profile.photoFileId),
    Boolean(profile.githubUrl || profile.linkedinUrl || profile.websiteUrl),
    profile.skills.length > 0,
  ];
  const complete = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100,
  );
  return (
    <section className="rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{profile.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {profile.title ?? "Add a professional title"}
            {profile.location ? ` · ${profile.location}` : ""}
          </p>
        </div>
        <span className="text-sm">
          {profile.skills.length} skills ·{" "}
          {profile.biography ? "Introduction added" : "Introduction missing"}
        </span>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span>Profile completion</span>
          <span>{complete}%</span>
        </div>
        <progress className="mt-2 w-full" max={100} value={complete}>
          {complete}%
        </progress>
      </div>
      <Link
        className="mt-3 inline-block text-sm underline"
        href={`/workspace/${encodeURIComponent(slug)}/developer/profile`}
      >
        Update profile
      </Link>
    </section>
  );
}
