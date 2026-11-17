"use client";

import { useState } from "react";
import Link from "next/link";
import { organizationRequest } from "@/lib/auth-api";

type MemberResult = {
  publicId: string;
  displayName: string;
  title: string | null;
  location: string | null;
  availability: string;
};
type ProjectResult = {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  liveUrl: string | null;
  isFeatured: boolean;
};
type Page<T> = { data: T[]; page: number; pageSize: number; total: number };

export function DeveloperSearch({ slug }: { slug: string }) {
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [technology, setTechnology] = useState("");
  const [language, setLanguage] = useState("");
  const [location, setLocation] = useState("");
  const [minYearsExperience, setMinYearsExperience] = useState("");
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [status, setStatus] = useState(
    "Search for professionals or projects in this organization.",
  );

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Searching…");
    const base = `${encodeURIComponent(slug)}/developer/search`;
    const query = new URLSearchParams();
    if (q.trim()) query.set("q", q.trim());
    if (skill.trim()) query.set("skill", skill.trim());
    if (language.trim()) query.set("language", language.trim());
    if (location.trim()) query.set("location", location.trim());
    if (minYearsExperience) query.set("minYearsExperience", minYearsExperience);
    const projectQuery = new URLSearchParams(query);
    if (technology.trim()) projectQuery.set("technology", technology.trim());
    try {
      const [memberPage, projectPage] = await Promise.all([
        organizationRequest<Page<MemberResult>>(`${base}/members?${query}`),
        organizationRequest<Page<ProjectResult>>(
          `${base}/projects?${projectQuery}`,
        ),
      ]);
      setMembers(memberPage.data);
      setProjects(projectPage.data);
      setStatus(
        `${memberPage.total} professionals and ${projectPage.total} projects found.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Search is unavailable.",
      );
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">Search & discovery</h1>
      </header>
      <form
        onSubmit={search}
        className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-3"
      >
        <label className="space-y-1 text-sm">
          Name, title or project
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={120}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Technical skill
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={120}
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Project technology
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={120}
            value={technology}
            onChange={(event) => setTechnology(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Language
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={120}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Location
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={160}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Minimum years of experience
          <input
            className="w-full rounded-md border bg-background p-2"
            type="number"
            min={0}
            max={80}
            value={minYearsExperience}
            onChange={(event) => setMinYearsExperience(event.target.value)}
          />
        </label>
        <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground md:col-span-3">
          Search
        </button>
      </form>
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold">Professionals</h2>
          <ul className="mt-3 space-y-2">
            {members.map((item) => (
              <li className="rounded-lg border p-4" key={item.publicId}>
                <Link
                  className="font-medium underline"
                  href={`/workspace/${encodeURIComponent(slug)}/developer/profiles/${item.publicId}`}
                >
                  {item.displayName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {item.title ?? "Developer"}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Projects</h2>
          <ul className="mt-3 space-y-2">
            {projects.map((item) => (
              <li className="rounded-lg border p-4" key={item.id}>
                <h3 className="font-medium">
                  {item.name}
                  {item.isFeatured ? " · Featured" : ""}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
                <p className="mt-2 text-xs">{item.technologies.join(" · ")}</p>
                {item.liveUrl && (
                  <a
                    className="mt-2 inline-block text-sm underline"
                    href={item.liveUrl}
                    rel="noopener noreferrer"
                  >
                    Open project
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
