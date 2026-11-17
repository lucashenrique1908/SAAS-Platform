import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { getServerAuthData } from "@/lib/auth-session";

const productHighlights = [
  "Unified developer workflows",
  "Secure workspace collaboration",
  "Operational visibility across teams",
];

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6 py-24">
          <p
            className="text-sm font-medium text-muted-foreground"
            role="status"
          >
            Loading workspace...
          </p>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();
  const authData = await getServerAuthData();
  if (authData) {
    const { activeOrganizationSlug } = authData.profile;
    const memberships = authData.profile.memberships.filter(
      (item) => item.isActive,
    );
    if (memberships.length === 0) redirect("/onboarding");
    const organization =
      memberships.find(
        (item) => item.organizationSlug === activeOrganizationSlug,
      ) ?? memberships[0]!;
    redirect(`/workspace/${organization.organizationSlug}`);
  }

  return (
    <main className="flex w-full min-w-0 min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-[calc(100vw-3rem)] min-w-0 max-w-6xl rounded-[2rem] border border-border/80 bg-card/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm md:p-10">
        <header className="flex items-center justify-between gap-4 border-b border-border/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-sm shadow-primary/25">
              S
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                SaaS platform
              </p>
              <p className="text-lg font-semibold text-foreground">
                SaaS Platform
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/login">Sign in</Link>
            <Link href="/register">Create account</Link>
          </nav>
        </header>

        <section className="grid min-w-0 items-center gap-10 pt-10 md:grid-cols-[1.2fr_0.8fr] md:pt-14">
          <div className="min-w-0 text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Built for modern teams
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Run your operations from one secure workspace.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Organize projects, onboard teams, coordinate developers, and keep
              every workflow aligned from a single SaaS platform designed for
              scale.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-5 py-3.5 text-sm font-semibold text-foreground transition hover:border-border/80 hover:bg-accent"
              >
                Create account
              </Link>
            </div>

            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              {productHighlights.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/80 p-6 shadow-inner shadow-primary/5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Platform status
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    Operational
                  </p>
                </div>
                <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  ["Workspaces", "12 active"],
                  ["Developers", "38 onboarded"],
                  ["Security", "Full audit trail"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
