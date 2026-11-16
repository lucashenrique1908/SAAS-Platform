"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type PublicProfile = {
  publicId: string;
  displayName: string;
  title: string | null;
  biography: string | null;
  location: string | null;
  yearsExperience: number | null;
  availability: string;
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
  skills: Array<{
    kind: string;
    name: string;
    category: string | null;
    proficiency: string | null;
  }>;
  experiences: Array<{
    jobTitle: string;
    company: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    description: string | null;
  }>;
  education: Array<{
    institution: string;
    course: string;
    degree: string | null;
    isInProgress: boolean;
  }>;
  certifications: Array<{
    name: string;
    issuingInstitution: string;
    issueDate: string | null;
    credentialUrl: string | null;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    coverUrl: string | null;
    liveUrl: string | null;
    repositoryUrl: string | null;
    isFeatured: boolean;
  }>;
};

export function PublicDeveloperProfile({ publicId }: { publicId: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/developers/${encodeURIComponent(publicId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) throw new Error("missing");
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()) as PublicProfile;
      })
      .then((data) => {
        setProfile(data);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState(
          error instanceof Error && error.message === "missing"
            ? "missing"
            : "error",
        );
      });
    return () => controller.abort();
  }, [publicId]);

  if (state === "loading")
    return (
      <main className="mx-auto max-w-4xl p-8" role="status">
        Loading profile…
      </main>
    );
  if (state !== "ready" || !profile)
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold">
          {state === "missing" ? "Profile not found" : "Profile unavailable"}
        </h1>
      </main>
    );

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
      <header className="rounded-2xl border bg-card p-8">
        <p className="text-sm text-muted-foreground">
          {[
            profile.location,
            profile.yearsExperience !== null
              ? `${profile.yearsExperience} years of experience`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Professional profile"}
        </p>
        {profile.photoUrl && (
          <Image
            className="mt-4 h-24 w-24 rounded-full object-cover"
            src={profile.photoUrl}
            alt={`${profile.displayName} profile`}
            width={96}
            height={96}
            unoptimized
          />
        )}
        <h1 className="mt-2 text-3xl font-semibold">{profile.displayName}</h1>
        {profile.title && <p className="mt-2 text-lg">{profile.title}</p>}
        {profile.biography && (
          <p className="mt-4 whitespace-pre-wrap text-muted-foreground">
            {profile.biography}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-4 text-sm underline">
          {profile.githubUrl && (
            <a href={profile.githubUrl} rel="noreferrer noopener">
              GitHub
            </a>
          )}
          {profile.linkedinUrl && (
            <a href={profile.linkedinUrl} rel="noreferrer noopener">
              LinkedIn
            </a>
          )}
          {profile.websiteUrl && (
            <a href={profile.websiteUrl} rel="noreferrer noopener">
              Website
            </a>
          )}
        </div>
      </header>
      <section>
        <h2 className="text-xl font-semibold">Skills</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {profile.skills.map((skill) => (
            <li
              className="rounded-full border px-3 py-1 text-sm"
              key={`${skill.kind}-${skill.name}`}
            >
              {skill.name}
              {skill.proficiency ? ` · ${skill.proficiency}` : ""}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Experience</h2>
        <div className="mt-3 space-y-3">
          {profile.experiences.map((item) => (
            <article
              className="rounded-xl border p-4"
              key={`${item.jobTitle}-${item.company}-${item.startDate}`}
            >
              <h3 className="font-medium">
                {item.jobTitle} · {item.company}
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.startDate} —{" "}
                {item.isCurrent ? "Present" : (item.endDate ?? "")}
              </p>
              {item.description && (
                <p className="mt-2 text-sm">{item.description}</p>
              )}
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Projects</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {profile.projects.map((item) => (
            <article
              className="rounded-xl border p-4"
              key={`${item.name}-${item.description.slice(0, 20)}`}
            >
              {item.coverUrl && (
                <Image
                  className="mb-3 max-h-48 w-full rounded-md object-cover"
                  src={item.coverUrl}
                  alt={`${item.name} cover`}
                  width={768}
                  height={384}
                  unoptimized
                />
              )}
              <h3 className="font-medium">
                {item.name}
                {item.isFeatured ? " · Featured" : ""}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
              <p className="mt-2 text-xs">{item.technologies.join(" · ")}</p>
              {item.liveUrl && (
                <a
                  className="mt-2 inline-block text-sm underline"
                  href={item.liveUrl}
                  rel="noreferrer noopener"
                >
                  Live project
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
      {profile.education.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Education</h2>
          <ul className="mt-3 space-y-2">
            {profile.education.map((item) => (
              <li key={`${item.institution}-${item.course}`}>
                {item.course} · {item.institution}
                {item.degree ? ` · ${item.degree}` : ""}
                {item.isInProgress ? " (in progress)" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      {profile.certifications.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Certifications</h2>
          <ul className="mt-3 space-y-2">
            {profile.certifications.map((item) => (
              <li key={`${item.name}-${item.issuingInstitution}`}>
                {item.name} · {item.issuingInstitution}
                {item.credentialUrl ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      className="underline"
                      href={item.credentialUrl}
                      rel="noreferrer noopener"
                    >
                      Credential
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
