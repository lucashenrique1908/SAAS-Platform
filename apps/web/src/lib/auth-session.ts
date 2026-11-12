import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "saas_session";

export type ProfileData = {
  id: string;
  email: string;
  emailVerifiedAt: string;
  createdAt: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: "owner" | "admin" | "member";
  }>;
};

export type SessionData = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export async function getServerAuthData(): Promise<{
  profile: ProfileData;
  sessions: SessionData[];
} | null> {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    return null;
  }
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const cookieHeader = `${SESSION_COOKIE_NAME}=${sessionCookie.value}`;
  const profileResponse = await fetch(new URL("/auth/me", apiBaseUrl), {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (profileResponse.status === 401) {
    return null;
  }
  if (!profileResponse.ok) {
    throw new Error("Could not load the authenticated profile.");
  }
  const profile = (await profileResponse.json()) as ProfileData;
  const sessionsResponse = await fetch(new URL("/auth/sessions", apiBaseUrl), {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!sessionsResponse.ok) {
    throw new Error("Could not load authenticated sessions.");
  }
  const sessions = (await sessionsResponse.json()) as SessionData[];
  return { profile, sessions };
}
