"use client";

import { useEffect, useState } from "react";
import { organizationRequest } from "@/lib/auth-api";

type OrganizationProfile = {
  displayName: string;
  title: string | null;
  biography: string | null;
  location: string | null;
  skills: Array<{ name: string; kind: string; proficiency: string | null }>;
  experiences: Array<{
    jobTitle: string;
    company: string;
    startDate: string;
    endDate: string | null;
    description: string | null;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
  }>;
};

export function OrganizationDeveloperProfile({
  slug,
  publicId,
}: {
  slug: string;
  publicId: string;
}) {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [error, setError] = useState("Loading profile…");
  useEffect(() => {
    let active = true;
    organizationRequest<OrganizationProfile>(
      `${encodeURIComponent(slug)}/developer/profiles/${encodeURIComponent(publicId)}`,
    )
      .then((value) => {
        if (active) {
          setProfile(value);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Profile unavailable.",
          );
      });
    return () => {
      active = false;
    };
  }, [slug, publicId]);
  if (!profile)
    return (
      <p role="status" className="rounded-lg border p-5">
        {error}
      </p>
    );
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          Organization member profile
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{profile.displayName}</h1>
        {profile.title && <p className="mt-2">{profile.title}</p>}
        {profile.location && (
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.location}
          </p>
        )}
        {profile.biography && (
          <p className="mt-4 whitespace-pre-wrap">{profile.biography}</p>
        )}
      </header>
      <section>
        <h2 className="text-xl font-semibold">Skills</h2>
        <p className="mt-2">
          {profile.skills
            .map(
              (skill) =>
                `${skill.name}${skill.proficiency ? ` (${skill.proficiency})` : ""}`,
            )
            .join(" · ")}
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Experience</h2>
        <ul className="mt-2 space-y-2">
          {profile.experiences.map((item, index) => (
            <li
              className="rounded-lg border p-4"
              key={`${item.company}-${item.startDate}-${index}`}
            >
              <strong>
                {item.jobTitle} · {item.company}
              </strong>
              <p className="text-sm text-muted-foreground">
                {item.startDate}
                {item.endDate ? ` — ${item.endDate}` : " — Present"}
              </p>
              {item.description && (
                <p className="mt-2 text-sm">{item.description}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Projects</h2>
        <ul className="mt-2 space-y-2">
          {profile.projects.map((item, index) => (
            <li className="rounded-lg border p-4" key={`${item.name}-${index}`}>
              <strong>{item.name}</strong>
              <p className="mt-1 text-sm">{item.description}</p>
              <p className="mt-2 text-xs">{item.technologies.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
