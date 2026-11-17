"use client";

import { useState } from "react";
import Image from "next/image";
import { organizationRequest } from "@/lib/auth-api";
type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  createdAt: string | null;
  source: string;
  workplace: "remote" | "hybrid" | "onsite" | "unknown";
  workplaceClassification: "text_match";
};
export function DeveloperJobs({ slug }: { slug: string }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("gb");
  const [workplace, setWorkplace] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("https://www.adzuna.com/");
  const [attributionLogoUrl, setAttributionLogoUrl] = useState<string | null>(
    null,
  );
  async function search(nextPage = 1) {
    setError("");
    const params = new URLSearchParams({ page: String(nextPage), country });
    if (query) params.set("q", query);
    if (location) params.set("location", location);
    if (workplace) params.set("workplace", workplace);
    try {
      const result = await organizationRequest<{
        jobs: Job[];
        page: number;
        source: string;
        sourceUrl: string;
        attributionLogoUrl: string | null;
      }>(`${encodeURIComponent(slug)}/developer/jobs?${params}`);
      setJobs(result.jobs);
      setPage(result.page);
      setSource(result.source);
      setSourceUrl(result.sourceUrl);
      setAttributionLogoUrl(result.attributionLogoUrl);
    } catch (e) {
      setJobs([]);
      setError(
        e instanceof Error ? e.message : "Live job search is unavailable.",
      );
    }
  }
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">Job opportunities</h1>
        <p className="mt-2 text-muted-foreground">
          Live listings come from Adzuna when the operator has configured
          credentials. No sample listings are shown.
        </p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="grid gap-3 rounded-xl border p-5 sm:grid-cols-2"
      >
        <label className="text-sm">
          Keyword or technology
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-md border bg-background p-2"
          />
        </label>
        <label className="text-sm">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-md border bg-background p-2"
          />
        </label>
        <label className="text-sm">
          Country code
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            minLength={2}
            maxLength={2}
            className="mt-1 w-full rounded-md border bg-background p-2"
          />
        </label>
        <label className="text-sm">
          Workplace type (matched from listing text)
          <select
            value={workplace}
            onChange={(e) => setWorkplace(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background p-2"
          >
            <option value="">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </label>
        <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground sm:col-span-2">
          Search listings
        </button>
      </form>
      {error && (
        <div role="status" className="rounded-lg border p-3 text-sm">
          <p>{error}</p>
          <a
            className="mt-2 inline-block underline"
            href={directSearchUrl(query, location, country)}
            target="_blank"
            rel="noreferrer"
          >
            Search directly on Adzuna
          </a>
        </div>
      )}
      {jobs.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Source: {source} · Search time: {new Date().toLocaleString()}
        </p>
      )}
      <ul className="space-y-3">
        {jobs.map((job) => (
          <li key={job.id} className="space-y-2 rounded-xl border p-5">
            <h2 className="font-semibold">{job.title}</h2>
            <p className="text-sm">
              {job.company} · {job.location}
              {job.workplace !== "unknown"
                ? ` · ${job.workplace} (text match)`
                : ""}
            </p>
            <p className="line-clamp-4 text-sm text-muted-foreground">
              {job.description}
            </p>
            <p className="flex min-h-[23px] min-w-[116px] items-center text-xs text-muted-foreground">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Jobs by Adzuna"
                className="inline-flex min-h-[23px] min-w-[116px] items-center underline"
              >
                {attributionLogoUrl ? (
                  <Image
                    src={attributionLogoUrl}
                    alt="Adzuna"
                    width={116}
                    height={23}
                    unoptimized
                  />
                ) : (
                  "Adzuna"
                )}
              </a>{" "}
              ·{" "}
              {job.createdAt
                ? new Date(job.createdAt).toLocaleDateString()
                : "Date not provided"}
            </p>
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              View original listing
            </a>
          </li>
        ))}
      </ul>
      {jobs.length > 0 && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => void search(page - 1)}
            className="rounded-md border px-3 py-2"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => void search(page + 1)}
            className="rounded-md border px-3 py-2"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

function directSearchUrl(query: string, location: string, country: string) {
  const domain =
    country.toLowerCase() === "gb"
      ? "www.adzuna.co.uk"
      : country.toLowerCase() === "au"
        ? "www.adzuna.com.au"
        : "www.adzuna.com";
  const url = new URL("/search", `https://${domain}`);
  if (query.trim()) url.searchParams.set("q", query.trim());
  if (location.trim()) url.searchParams.set("where", location.trim());
  return url.toString();
}
