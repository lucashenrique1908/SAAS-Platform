import type { ReactNode } from "react";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import {
  getServerWorkspaceData,
  WorkspaceAccessError,
} from "@/lib/workspace-api";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6">
          <p role="status">Loading workspace...</p>
        </main>
      }
    >
      <WorkspaceContent params={params}>{children}</WorkspaceContent>
    </Suspense>
  );
}

async function WorkspaceContent({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  let data;
  try {
    data = await getServerWorkspaceData(slug);
  } catch (error) {
    if (error instanceof WorkspaceAccessError) notFound();
    throw error;
  }
  if (!data) redirect("/login");
  return (
    <WorkspaceShell profile={data.profile} workspace={data.workspace}>
      {children}
    </WorkspaceShell>
  );
}
