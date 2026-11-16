import Link from "next/link";
import { DeveloperDashboardSummary } from "@/components/developer/developer-dashboard-summary";

export default async function DeveloperDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const base = `/workspace/${encodeURIComponent(slug)}/developer`;
  const sections = [
    [
      "Professional profile",
      "Manage visibility and professional links.",
      "profile",
    ],
    [
      "Skills & languages",
      "Add technical skills, soft skills and languages.",
      "skills",
    ],
    [
      "Experience",
      "Record roles, achievements and technologies.",
      "experiences",
    ],
    ["Education", "Optional education history.", "education"],
    [
      "Certifications",
      "Optional credentials and certificates.",
      "certifications",
    ],
    ["Portfolio", "Create and feature professional projects.", "projects"],
    [
      "Search",
      "Discover professionals and projects in this organization.",
      "search",
    ],
    [
      "Integrations",
      "GitHub, LinkedIn, AI, opportunities and calendar status.",
      "integrations",
    ],
    ["CV builder", "Create an editable CV summary and print it as PDF.", "cv"],
    [
      "Learning roadmap",
      "Plan learning goals and track milestones.",
      "roadmap",
    ],
    ["Opportunities", "Search opportunities from configured sources.", "jobs"],
  ] as const;
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="mt-1 text-3xl font-semibold">Professional workspace</h1>
        <p className="mt-2 text-muted-foreground">
          Build your profile and portfolio. You manage your own professional
          information.
        </p>
      </header>
      <DeveloperDashboardSummary slug={slug} />
      <nav
        aria-label="Developer module sections"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {sections.map(([title, description, path]) => (
          <Link
            className="rounded-xl border bg-card p-5 transition hover:border-primary"
            href={`${base}/${path}`}
            key={path}
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
