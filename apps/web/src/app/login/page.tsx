"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLinks } from "@/components/auth/auth-links";
import { authRequest } from "@/lib/auth-api";

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <AuthForm
        description="Sign in to your SaaS Platform account."
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
        onSubmit={async (values) => {
          await authRequest("login", {
            method: "POST",
            body: JSON.stringify(values),
          });
          if (sessionStorage.getItem("saas_invitation_token")) {
            router.push("/invite/accept");
          } else {
            const profile = await authRequest<{
              memberships: Array<{ organizationSlug: string }>;
              activeOrganizationSlug: string | null;
            }>("me");
            if (profile.memberships.length === 0) {
              router.push("/onboarding");
            } else {
              const organization =
                profile.memberships.find(
                  (item) =>
                    item.organizationSlug === profile.activeOrganizationSlug,
                ) ?? profile.memberships[0]!;
              router.push(`/workspace/${organization.organizationSlug}`);
            }
          }
          router.refresh();
          return "Signed in.";
        }}
        submitLabel="Sign in"
        title="Welcome back"
      />
      <AuthLinks
        links={[
          { href: "/register", label: "Create an account" },
          { href: "/forgot-password", label: "Forgot your password?" },
          { href: "/verify-email", label: "Resend verification email" },
        ]}
      />
    </main>
  );
}
