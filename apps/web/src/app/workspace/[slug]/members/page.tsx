"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  useAuthProfile,
  useWorkspace,
} from "@/components/workspace/workspace-shell";
import { organizationRequest } from "@/lib/auth-api";

type Role = "owner" | "admin" | "member";
type Member = {
  userId: string;
  email: string;
  role: Role;
  permissions: string[];
  joinedAt: string;
};
type Invitation = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
};
type Action = (
  action: () => Promise<unknown>,
  success: string,
) => Promise<void>;

const moduleLabels: Record<string, string> = {
  developer: "Developer",
  barber: "Barber",
  hairdresser: "Hairdresser",
  dentist: "Dentist",
};

export default function MembersPage() {
  const workspace = useWorkspace();
  const profile = useAuthProfile();
  const { organization, role: currentRole } = workspace;
  const canManage = currentRole === "owner" || currentRole === "admin";
  const base = encodeURIComponent(organization.slug);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("member");
  const [isInvite, setIsInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const people = await organizationRequest<Member[]>(`${base}/members`);
    setMembers(people);
    if (canManage)
      setInvitations(
        await organizationRequest<Invitation[]>(`${base}/invitations`),
      );
  }, [base, canManage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Could not load members.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isInvite) {
        await organizationRequest(`${base}/invitations`, {
          method: "POST",
          body: JSON.stringify({ email, role: memberRole }),
        });
        setNotice(
          "Invitation sent. The recipient must create or sign in to an account, verify that email, then accept the invitation.",
        );
      } else {
        await organizationRequest(`${base}/members`, {
          method: "POST",
          body: JSON.stringify({ email, role: memberRole }),
        });
        setNotice("Member added.");
      }
      setEmail("");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not add the member.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(success);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
        <h1 className="mt-1 text-3xl font-semibold">Members</h1>
        <p className="mt-2 text-muted-foreground">
          See who belongs to this workspace and manage their access.
        </p>
      </header>

      {canManage && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Add a teammate</h2>
          <div className="mt-4 flex gap-2 text-sm">
            <button
              aria-pressed={isInvite}
              className={`rounded-md px-3 py-2 ${isInvite ? "bg-primary text-primary-foreground" : "border"}`}
              onClick={() => setIsInvite(true)}
              type="button"
            >
              Invite by email
            </button>
            <button
              aria-pressed={!isInvite}
              className={`rounded-md px-3 py-2 ${!isInvite ? "bg-primary text-primary-foreground" : "border"}`}
              onClick={() => setIsInvite(false)}
              type="button"
            >
              Add existing account
            </button>
          </div>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto]"
            onSubmit={(event) => void submitMember(event)}
          >
            <label className="sr-only" htmlFor="member-email">
              Email address
            </label>
            <input
              autoComplete="email"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              id="member-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              required
              type="email"
              value={email}
            />
            <label className="sr-only" htmlFor="member-role">
              Role
            </label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              id="member-role"
              onChange={(event) => setMemberRole(event.target.value as Role)}
              value={memberRole}
            >
              <option value="member">Member</option>
              {currentRole === "owner" && (
                <>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </>
              )}
            </select>
            <button
              className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              {isInvite ? "Send invitation" : "Add member"}
            </button>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">People ({members.length})</h2>
        </div>
        {members.length ? (
          <ul className="divide-y">
            {members.map((member) => (
              <MemberRow
                currentUserId={profile.id}
                currentRole={currentRole}
                key={member.userId}
                member={member}
                organizationSlug={organization.slug}
                onAction={runAction}
                busy={busy}
              />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            No members found.
          </p>
        )}
      </section>

      {canManage && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Pending invitations</h2>
          </div>
          {invitations.length ? (
            <ul className="divide-y">
              {invitations.map((invitation) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  key={invitation.id}
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invitation.role} · expires{" "}
                      {new Date(invitation.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className="rounded-md border px-3 py-2 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        () =>
                          organizationRequest(
                            `${base}/invitations/${invitation.id}`,
                            { method: "DELETE" },
                          ),
                        "Invitation revoked.",
                      )
                    }
                    type="button"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              No pending invitations.
            </p>
          )}
        </section>
      )}

      {notice && (
        <p className="text-sm text-foreground" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function MemberRow({
  member,
  currentRole,
  currentUserId,
  organizationSlug,
  busy,
  onAction,
}: {
  member: Member;
  currentRole: Role;
  currentUserId: string;
  organizationSlug: string;
  busy: boolean;
  onAction: Action;
}) {
  const isSelf = member.userId === currentUserId;
  const canManageTarget =
    currentRole === "owner" ||
    (currentRole === "admin" && member.role === "member");
  const base = encodeURIComponent(organizationSlug);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {member.email}
            {isSelf && (
              <span className="ml-2 text-xs text-muted-foreground">You</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Joined {new Date(member.joinedAt).toLocaleDateString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {member.permissions.length
              ? `Module access: ${member.permissions.join(", ")}`
              : "No additional module permissions"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
            {member.role}
          </span>
          {!isSelf &&
            canManageTarget &&
            currentRole === "owner" &&
            member.role === "member" && (
              <button
                className="rounded-md border px-3 py-2 text-xs"
                disabled={busy}
                onClick={() =>
                  void onAction(
                    () =>
                      organizationRequest(
                        `${base}/members/${member.userId}/role`,
                        {
                          method: "PATCH",
                          body: JSON.stringify({ role: "admin" }),
                        },
                      ),
                    "Member promoted to Admin.",
                  )
                }
                type="button"
              >
                Promote to Admin
              </button>
            )}
          {!isSelf &&
            canManageTarget &&
            currentRole === "owner" &&
            member.role === "admin" && (
              <button
                className="rounded-md border px-3 py-2 text-xs"
                disabled={busy}
                onClick={() =>
                  void onAction(
                    () =>
                      organizationRequest(
                        `${base}/members/${member.userId}/role`,
                        {
                          method: "PATCH",
                          body: JSON.stringify({ role: "member" }),
                        },
                      ),
                    "Admin changed to Member.",
                  )
                }
                type="button"
              >
                Demote to Member
              </button>
            )}
          {!isSelf && currentRole === "owner" && member.role === "owner" && (
            <button
              className="rounded-md border px-3 py-2 text-xs"
              disabled={busy}
              onClick={() =>
                void onAction(
                  () =>
                    organizationRequest(
                      `${base}/members/${member.userId}/role`,
                      {
                        method: "PATCH",
                        body: JSON.stringify({ role: "admin" }),
                      },
                    ),
                  "Owner changed to Admin.",
                )
              }
              type="button"
            >
              Change Owner to Admin
            </button>
          )}
          {!isSelf && currentRole === "owner" && member.role === "owner" && (
            <button
              className="rounded-md border px-3 py-2 text-xs"
              disabled={busy}
              onClick={() =>
                void onAction(
                  () =>
                    organizationRequest(
                      `${base}/members/${member.userId}/role`,
                      {
                        method: "PATCH",
                        body: JSON.stringify({ role: "member" }),
                      },
                    ),
                  "Owner changed to Member.",
                )
              }
              type="button"
            >
              Change Owner to Member
            </button>
          )}
          {!isSelf && currentRole === "owner" && member.role !== "owner" && (
            <button
              className="rounded-md border px-3 py-2 text-xs"
              disabled={busy}
              onClick={() =>
                void onAction(
                  () =>
                    organizationRequest(`${base}/ownership/transfer`, {
                      method: "POST",
                      body: JSON.stringify({ userId: member.userId }),
                    }),
                  "Ownership transferred.",
                )
              }
              type="button"
            >
              Transfer ownership
            </button>
          )}
          {!isSelf && canManageTarget && (
            <button
              className="rounded-md border px-3 py-2 text-xs text-destructive"
              disabled={busy}
              onClick={() =>
                void onAction(
                  () =>
                    organizationRequest(`${base}/members/${member.userId}`, {
                      method: "DELETE",
                    }),
                  "Member removed.",
                )
              }
              type="button"
            >
              Remove
            </button>
          )}
          {isSelf && (
            <button
              className="rounded-md border px-3 py-2 text-xs text-destructive"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Leave this organization?"))
                  void onAction(
                    () =>
                      organizationRequest(`${base}/members/me/leave`, {
                        method: "POST",
                      }),
                    "You left the organization.",
                  );
              }}
              type="button"
            >
              Leave
            </button>
          )}
        </div>
      </div>
      {!isSelf && canManageTarget && (
        <MemberPermissionEditor
          member={member}
          busy={busy}
          onSave={(permissions) =>
            onAction(
              () =>
                organizationRequest(
                  `${base}/members/${member.userId}/permissions`,
                  { method: "PATCH", body: JSON.stringify({ permissions }) },
                ),
              "Module permissions updated.",
            )
          }
        />
      )}
    </li>
  );
}

function MemberPermissionEditor({
  member,
  busy,
  onSave,
}: {
  member: Member;
  busy: boolean;
  onSave: (permissions: string[]) => Promise<void>;
}) {
  const [permissions, setPermissions] = useState(member.permissions);
  const available = ["developer", "barber", "hairdresser", "dentist"];
  function toggle(permission: string) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }
  return (
    <details className="mt-3 text-sm">
      <summary className="w-fit cursor-pointer text-muted-foreground">
        Manage module permissions
      </summary>
      <form
        className="mt-3 grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(permissions);
        }}
      >
        {available.map((key) => (
          <fieldset className="space-y-2" key={key}>
            <legend className="font-medium">{moduleLabels[key]}</legend>
            {(["read", "write"] as const).map((action) => {
              const permission = `${key}:${action}`;
              return (
                <label
                  className="flex items-center gap-2 text-muted-foreground"
                  key={permission}
                >
                  <input
                    checked={permissions.includes(permission)}
                    onChange={() => toggle(permission)}
                    type="checkbox"
                  />
                  {action === "read" ? "View module" : "Edit module records"}
                </label>
              );
            })}
          </fieldset>
        ))}
        <button
          className="w-fit rounded-md border px-3 py-2 text-xs disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          Save permissions
        </button>
      </form>
    </details>
  );
}
