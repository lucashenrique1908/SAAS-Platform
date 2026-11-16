"use client";

import { useCallback, useEffect, useState } from "react";
import { organizationRequest } from "@/lib/auth-api";

export function DeveloperCv({ slug }: { slug: string }) {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{
    profile: {
      displayName: string;
      title: string | null;
      biography: string | null;
      skills: Array<{ id: string; kind: string; name: string }>;
    };
    experience: Array<{
      id: string;
      jobTitle: string;
      company: string;
      description: string | null;
      startDate: string;
      endDate: string | null;
    }>;
    education: Array<{
      id: string;
      course: string;
      institution: string;
      degree: string | null;
    }>;
    certifications: Array<{
      id: string;
      name: string;
      issuingInstitution: string;
    }>;
    projects: Array<{
      id: string;
      name: string;
      description: string;
      technologies: string[];
    }>;
  } | null>(null);
  const [included, setIncluded] = useState({
    profile: true,
    experience: true,
    education: true,
    certifications: true,
    projects: true,
    skills: true,
  });
  const base = `${encodeURIComponent(slug)}/developer`;
  const load = useCallback(async () => {
    try {
      setData(await organizationRequest(`${base}/cv`));
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Create your profile before building a CV.",
      );
    }
  }, [base]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);
  async function generate() {
    setBusy(true);
    setStatus("");
    try {
      const result = await organizationRequest<{ summary: string }>(
        `${base}/cv/summary`,
        { method: "POST", body: JSON.stringify(included) },
      );
      setSummary(result.summary);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not generate CV summary.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header className="no-print">
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">CV builder</h1>
        <p className="mt-2 text-muted-foreground">
          Choose sections, edit the generated summary and use Print / Save as
          PDF. When configured, profile facts are sent to the server-side AI
          provider to draft the summary.
        </p>
      </header>
      {data && (
        <div className="no-print flex flex-wrap gap-3 text-sm">
          {Object.entries(included).map(([key, value]) => (
            <label className="flex items-center gap-1" key={key}>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) =>
                  setIncluded((current) => ({
                    ...current,
                    [key]: e.target.checked,
                  }))
                }
              />
              Include {key}
            </label>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={busy || !data}
        onClick={() => void generate()}
        className="no-print rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        {busy ? "Generating…" : "Generate summary"}
      </button>
      {status && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {status}
        </p>
      )}
      {data && (
        <div className="no-print space-y-3">
          <label className="block space-y-2 text-sm font-medium">
            Professional summary
            <textarea
              aria-label="Editable CV summary"
              className="min-h-32 w-full rounded-md border bg-background p-3 font-normal"
              maxLength={2500}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Generate a draft or write your own summary."
            />
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border px-4 py-2"
          >
            Print / Save as PDF
          </button>
        </div>
      )}
      {data && (
        <article className="cv-print space-y-5 rounded-xl border p-6">
          <header>
            <h1 className="text-3xl font-bold">{data.profile.displayName}</h1>
            {data.profile.title && (
              <p className="text-lg">{data.profile.title}</p>
            )}
            {data.profile.biography && (
              <p className="mt-2 text-sm">{data.profile.biography}</p>
            )}
          </header>
          {summary && (
            <section>
              <h2 className="font-semibold">Professional summary</h2>
              <p className="whitespace-pre-wrap">{summary}</p>
            </section>
          )}
          {included.skills && (
            <section>
              <h2 className="font-semibold">Skills</h2>
              <p>
                {data.profile.skills.map((skill) => skill.name).join(" · ")}
              </p>
            </section>
          )}
          {included.experience && (
            <section>
              <h2 className="font-semibold">Experience</h2>
              {data.experience.map((item) => (
                <div key={item.id} className="mt-2">
                  <p className="font-medium">
                    {item.jobTitle} · {item.company}
                  </p>
                  <p className="text-sm">
                    {item.startDate} – {item.endDate ?? "Present"}
                  </p>
                  {item.description && (
                    <p className="text-sm">{item.description}</p>
                  )}
                </div>
              ))}
            </section>
          )}
          {included.education && data.education.length > 0 && (
            <section>
              <h2 className="font-semibold">Education</h2>
              {data.education.map((item) => (
                <p key={item.id}>
                  {item.course}, {item.institution}
                  {item.degree ? ` · ${item.degree}` : ""}
                </p>
              ))}
            </section>
          )}
          {included.certifications && data.certifications.length > 0 && (
            <section>
              <h2 className="font-semibold">Certifications</h2>
              {data.certifications.map((item) => (
                <p key={item.id}>
                  {item.name} · {item.issuingInstitution}
                </p>
              ))}
            </section>
          )}
          {included.projects && data.projects.length > 0 && (
            <section>
              <h2 className="font-semibold">Projects</h2>
              {data.projects.map((item) => (
                <div key={item.id}>
                  <p className="font-medium">{item.name}</p>
                  <p>{item.description}</p>
                  <p className="text-sm">{item.technologies.join(" · ")}</p>
                </div>
              ))}
            </section>
          )}
        </article>
      )}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .cv-print {
            border: 0 !important;
            padding: 0 !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </section>
  );
}
