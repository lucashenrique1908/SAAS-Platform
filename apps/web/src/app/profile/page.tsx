import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ProfilePanel } from "@/components/auth/profile-panel";
import { getServerAuthData } from "@/lib/auth-session";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <p role="status">Loading profile...</p>
        </main>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  await connection();
  const authData = await getServerAuthData();
  if (!authData) {
    redirect("/login");
  }
  return (
    <ProfilePanel
      initialSessions={authData.sessions}
      profile={authData.profile}
    />
  );
}
