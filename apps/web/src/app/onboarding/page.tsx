import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { OrganizationForm } from "@/components/workspace/organization-form";
import { getServerAuthData } from "@/lib/auth-session";

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <p role="status">Loading workspace setup...</p>
        </main>
      }
    >
      <OnboardingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OnboardingContent({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  await connection();
  const authData = await getServerAuthData();
  if (!authData) redirect("/login");
  const activeMemberships = authData.profile.memberships.filter(
    (item) => item.isActive,
  );
  const { create } = await searchParams;
  if (activeMemberships.length > 0 && create !== "1") {
    const organization =
      activeMemberships.find(
        (item) =>
          item.organizationSlug === authData.profile.activeOrganizationSlug,
      ) ?? activeMemberships[0]!;
    redirect(`/workspace/${organization.organizationSlug}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Get started</p>
        <h1 className="mt-2 text-3xl font-semibold">
          {activeMemberships.length
            ? "Create an organization"
            : "Create your first workspace"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          You will become its Owner. You can create additional organizations and
          invite teammates later.
        </p>
      </div>
      <OrganizationForm onboarding />
    </main>
  );
}
