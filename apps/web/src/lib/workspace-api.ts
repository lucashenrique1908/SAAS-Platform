import { cookies } from "next/headers";
import type { ProfileData } from "./auth-session";

export type WorkspaceData = {
  organization: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    contactEmail: string | null;
    phone: string | null;
    website: string | null;
    country: string | null;
    industry: string | null;
    taxId: string | null;
    isActive: boolean;
    deactivatedAt: string | null;
    createdAt: string;
  };
  role: "owner" | "admin" | "member";
  permissions: string[];
  membersCount: number;
  modules: Array<{ key: string; enabled: boolean }>;
  activity: Array<{
    id: string;
    type: string;
    details: Record<string, unknown>;
    createdAt: string;
    actorEmail: string | null;
  }>;
};

async function fetchOrganization<T>(
  slug: string,
  sessionCookie: string,
  method: "GET" | "POST",
): Promise<T> {
  const origin = process.env.FRONTEND_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(
    new URL(
      `/organizations/${encodeURIComponent(slug)}${method === "POST" ? "/active" : ""}`,
      process.env.API_BASE_URL ?? "http://localhost:3001",
    ),
    {
      method,
      headers: {
        cookie: `saas_session=${sessionCookie}`,
        origin,
        ...(method === "POST" ? { "x-csrf-protection": "1" } : {}),
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 404)
      throw new WorkspaceAccessError(response.status);
    throw new Error("Could not load the organization workspace.");
  }
  return (await response.json()) as T;
}

export class WorkspaceAccessError extends Error {
  constructor(readonly status: number) {
    super("The organization is unavailable or you do not have access.");
  }
}

export async function getServerWorkspaceData(slug: string): Promise<{
  profile: ProfileData;
  workspace: WorkspaceData;
} | null> {
  const sessionCookie = (await cookies()).get("saas_session")?.value;
  if (!sessionCookie) return null;
  const profileResponse = await fetch(
    new URL("/auth/me", process.env.API_BASE_URL ?? "http://localhost:3001"),
    { headers: { cookie: `saas_session=${sessionCookie}` }, cache: "no-store" },
  );
  if (profileResponse.status === 401) return null;
  if (!profileResponse.ok)
    throw new Error("Could not load the authenticated profile.");
  const profile = (await profileResponse.json()) as ProfileData;
  const member = profile.memberships.find(
    (item) => item.organizationSlug === slug,
  );
  if (!member) throw new WorkspaceAccessError(404);
  await fetchOrganization(slug, sessionCookie, "POST");
  const workspace = await fetchOrganization<WorkspaceData>(
    slug,
    sessionCookie,
    "GET",
  );
  return { profile, workspace };
}
