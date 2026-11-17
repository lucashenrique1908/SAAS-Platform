"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/workspace/workspace-shell";
import { useAuthProfile } from "@/components/workspace/workspace-shell";

const names: Record<string, string> = {
  developer: "Developer",
  barber: "Barber",
  hairdresser: "Hairdresser",
  dentist: "Dentist",
};

export default function WorkspaceDashboardPage() {
  const workspace = useWorkspace();
  const profile = useAuthProfile();
  const { organization, modules, role, permissions, membersCount, activity } =
    workspace;
  const canManage = role === "owner" || role === "admin";
  const availableModules = modules.filter(
    ({ key, enabled }) =>
      enabled && (canManage || permissions.includes(`${key}:read`)),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{organization.name}</p>
          <h1 className="mt-1 text-3xl font-semibold">
            Welcome, {profile.email.split("@")[0]}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {organization.description ||
              "Your workspace is ready. Manage people, configure modules, and bring your team together."}
          </p>
        </div>
        {canManage && (
          <Link
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            href={`/workspace/${organization.slug}/settings`}
          >
            Organization settings
          </Link>
        )}
      </div>

      <section
        aria-label="Workspace overview"
        className="grid gap-4 sm:grid-cols-2"
      >
        <article className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Members</p>
          <p className="mt-2 text-3xl font-semibold">{membersCount}</p>
          <Link
            className="mt-4 inline-block text-sm underline"
            href={`/workspace/${organization.slug}/members`}
          >
            View members
          </Link>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Active modules</p>
          <p className="mt-2 text-3xl font-semibold">
            {availableModules.length}
          </p>
          {canManage && (
            <Link
              className="mt-4 inline-block text-sm underline"
              href={`/workspace/${organization.slug}/modules`}
            >
              Manage modules
            </Link>
          )}
        </article>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Your modules</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a module available to your role.
            </p>
          </div>
        </div>
        {availableModules.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {availableModules.map(({ key }) => (
              <Link
                className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent"
                href={`/workspace/${organization.slug}/modules/${key}`}
                key={key}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                  {names[key]?.slice(0, 1)}
                </span>
                <h3 className="mt-4 font-semibold">{names[key] ?? key}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Workspace module
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card px-5 py-8 text-center">
            <h3 className="font-medium">No modules available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage
                ? "Enable a module to make it available in this workspace."
                : "Ask an Owner or Admin to enable a module and grant you access."}
            </p>
            {canManage && (
              <Link
                className="mt-4 inline-block text-sm underline"
                href={`/workspace/${organization.slug}/modules`}
              >
                Configure modules
              </Link>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          {activity.length ? (
            <ul className="mt-4 space-y-4">
              {activity.map((item) => (
                <li className="border-l-2 pl-4" key={item.id}>
                  <p className="text-sm">
                    {describeActivity(item.type, item.details, item.actorEmail)}
                  </p>
                  <time
                    className="mt-1 block text-xs text-muted-foreground"
                    dateTime={item.createdAt}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              No organization activity has been recorded yet.
            </p>
          )}
        </section>
        <section
          aria-label="Notifications"
          className="rounded-xl border bg-card p-5"
        >
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            You’re all caught up. There are no notifications.
          </p>
        </section>
      </div>
    </div>
  );
}

function describeActivity(
  type: string,
  details: Record<string, unknown>,
  actorEmail: string | null,
) {
  const actor = actorEmail ?? "A former member";
  switch (type) {
    case "organization.created":
      return `${actor} created the organization.`;
    case "organization.updated":
      return `${actor} updated organization settings.`;
    case "organization.deactivated":
      return `${actor} deactivated the organization.`;
    case "organization.reactivated":
      return `${actor} reactivated the organization.`;
    case "organization.ownership_transferred":
      return `${actor} transferred workspace ownership.`;
    case "member.added":
      return `${String(details.email ?? "A user")} joined as ${String(details.role ?? "member")}.`;
    case "member.removed":
      return `${actor} removed a member.`;
    case "member.left":
      return `${actor} left the organization.`;
    case "member.role_changed":
      return `${actor} changed a member’s role to ${String(details.to ?? "a new role")}.`;
    case "member.permissions_changed":
      return `${actor} updated a member’s module permissions.`;
    case "invitation.sent":
      return `${actor} invited ${String(details.email ?? "a teammate")}.`;
    case "invitation.accepted":
      return `${actor} accepted an invitation.`;
    case "invitation.revoked":
      return `${actor} revoked an invitation.`;
    case "module.state_changed":
      return `${actor} ${details.enabled ? "enabled" : "disabled"} the ${String(details.key ?? "workspace")} module.`;
    default:
      return "A workspace change was recorded.";
  }
}
