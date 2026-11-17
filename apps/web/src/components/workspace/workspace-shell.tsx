"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  Building2,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { ProfileData } from "@/lib/auth-session";
import type { WorkspaceData } from "@/lib/workspace-api";

const moduleLabels: Record<string, string> = {
  developer: "Developer",
  barber: "Barber",
  hairdresser: "Hairdresser",
  dentist: "Dentist",
};

const WorkspaceContext = createContext<{
  workspace: WorkspaceData;
  profile: ProfileData;
} | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace context is unavailable.");
  return value.workspace;
}

export function useAuthProfile() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace context is unavailable.");
  return value.profile;
}

export function WorkspaceShell({
  profile,
  workspace,
  children,
}: {
  profile: ProfileData;
  workspace: WorkspaceData;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { organization, role, permissions, modules } = workspace;
  const canManage = role === "owner" || role === "admin";
  const visibleModules = modules.filter(
    ({ key, enabled }) =>
      enabled && (canManage || permissions.includes(`${key}:read`)),
  );
  const links = [
    {
      href: `/workspace/${organization.slug}`,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: `/workspace/${organization.slug}/members`,
      label: "Members",
      icon: Users,
    },
    ...(canManage
      ? [
          {
            href: `/workspace/${organization.slug}/modules`,
            label: "Modules",
            icon: Boxes,
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            href: `/workspace/${organization.slug}/settings`,
            label: "Organization settings",
            icon: Settings,
          },
        ]
      : []),
    ...visibleModules.map(({ key }) => ({
      href: `/workspace/${organization.slug}/modules/${key}`,
      label: moduleLabels[key] ?? key,
      icon: Boxes,
    })),
  ];

  const sidebar = (
    <nav aria-label="Workspace navigation" className="space-y-1 p-3">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href.endsWith("/settings") && pathname.startsWith(`${href}/`));
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${active ? "bg-sidebar-accent font-medium" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
            href={href}
            key={href}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? label : undefined}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
      {!collapsed && (
        <Link
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          href="/onboarding?create=1"
        >
          <Building2 aria-hidden="true" className="size-4" />
          Add organization
        </Link>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b bg-background px-4 sm:px-6">
        <button
          aria-label="Open navigation"
          className="rounded-md border p-2 lg:hidden"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <Menu className="size-4" />
        </button>
        <Link
          className="flex min-w-0 items-center gap-3"
          href={`/workspace/${organization.slug}`}
        >
          <span
            aria-label={organization.name}
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            role="img"
            style={
              organization.logoUrl
                ? {
                    backgroundImage: `url("${organization.logoUrl}")`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }
                : undefined
            }
          >
            {!organization.logoUrl &&
              organization.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-48 truncate font-semibold sm:block">
            {organization.name}
          </span>
        </Link>
        <label className="sr-only" htmlFor="organization-switcher">
          Active organization
        </label>
        <select
          className="h-9 max-w-48 rounded-md border bg-background px-2 text-sm sm:max-w-64"
          id="organization-switcher"
          onChange={(event) => router.push(`/workspace/${event.target.value}`)}
          value={organization.slug}
        >
          {profile.memberships
            .filter((membership) => membership.isActive)
            .map((membership) => (
              <option
                key={membership.organizationId}
                value={membership.organizationSlug}
              >
                {membership.organizationName}
              </option>
            ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {canManage && (
            <Link
              className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent sm:inline-flex"
              href={`/workspace/${organization.slug}/settings`}
            >
              Settings
            </Link>
          )}
          <Link
            aria-label="Account profile"
            className="flex size-9 items-center justify-center rounded-full border bg-muted text-sm font-semibold"
            href="/profile"
            title={profile.email}
          >
            {profile.email.slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          className={`hidden shrink-0 border-r bg-background transition-[width] lg:block ${collapsed ? "w-16" : "w-64"}`}
        >
          <div className="flex justify-end p-3">
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>
          {sidebar}
        </aside>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <aside
              className="h-full w-72 bg-background shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b p-4">
                <span className="font-semibold">{organization.name}</span>
                <button
                  aria-label="Close navigation"
                  className="rounded-md p-2"
                  onClick={() => setMobileOpen(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}
        <WorkspaceContext.Provider value={{ workspace, profile }}>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </WorkspaceContext.Provider>
      </div>
    </div>
  );
}
