"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-shell";
import { DurationField, MoneyField } from "@/components/shared/value-fields";
import { formatDuration, formatMoney, parseDuration } from "@/lib/value-format";

type Item = { id: string; [key: string]: string | number | boolean | null };
type MemberItem = {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
};

export default function BarberWorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const workspace = useWorkspace();
  const [profile, setProfile] = useState<Item | null>(null);
  const [professionals, setProfessionals] = useState<Item[]>([]);
  const [editableProfessionalIds, setEditableProfessionalIds] = useState<
    string[]
  >([]);
  const [services, setServices] = useState<Item[]>([]);
  const [clients, setClients] = useState<Item[]>([]);
  const [associations, setAssociations] = useState<Item[]>([]);
  const [managers, setManagers] = useState<Item[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite =
    workspace.role !== "member" ||
    workspace.permissions.includes("barber:write");
  const canAdmin = workspace.role === "owner" || workspace.role === "admin";

  const request = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(slug)}/barber/${path}`,
        {
          method,
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          result?.message ?? "Não foi possível carregar os dados.",
        );
      return result;
    },
    [slug],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        p,
        pros,
        editablePros,
        svcs,
        cls,
        links,
        assignments,
        membersResponse,
      ] = await Promise.all([
        request("profile"),
        request("professionals"),
        request("professional-access"),
        request("services"),
        request("clients"),
        request("professional-services"),
        canAdmin ? request("professional-managers") : Promise.resolve([]),
        canAdmin
          ? fetch(`/api/organizations/${encodeURIComponent(slug)}/members`, {
              cache: "no-store",
            }).then(async (response) => {
              if (!response.ok)
                throw new Error("Não foi possível carregar os Members.");
              return response.json();
            })
          : Promise.resolve([]),
      ]);
      setProfile(p as Item | null);
      setProfessionals(pros as Item[]);
      setEditableProfessionalIds(editablePros as string[]);
      setServices(svcs as Item[]);
      setClients(cls as Item[]);
      setAssociations(links as Item[]);
      setManagers(assignments as Item[]);
      setMembers(membersResponse as MemberItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar o módulo.");
    } finally {
      setLoading(false);
    }
  }, [canAdmin, request, slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    path: string,
    fields: string[],
    method = "POST",
  ) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const body: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      const value = String(data[field] ?? "").trim();
      if (field === "priceCents") {
        const cents = Number(data[`${field}__cents`] ?? "");
        if (!Number.isSafeInteger(cents) || cents < 0 || cents > 10_000_000) {
          setError("Introduza um preço válido entre 0,00 € e 100.000,00 €.");
          setBusy(false);
          return;
        }
        body[field] = cents;
      } else if (value) {
        if (field === "durationMinutes") {
          const minutes = parseDuration(value);
          if (minutes === null) {
            setError("Introduza uma duração inteira entre 1 e 1.440 minutos.");
            setBusy(false);
            return;
          }
          body[field] = minutes;
          continue;
        }
        body[field] = field === "isActive" ? value === "true" : value;
      }
    }
    try {
      await request(path, method, body);
      event.currentTarget.reset();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function setAssociation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const submitter =
        event.nativeEvent instanceof SubmitEvent
          ? event.nativeEvent.submitter
          : null;
      const enabled =
        submitter instanceof HTMLButtonElement && submitter.value === "true";
      await request("professional-services", "PUT", {
        professionalId: form.get("professionalId"),
        serviceId: form.get("serviceId"),
        enabled,
      });
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar a associação.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setManager(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const submitter =
      event.nativeEvent instanceof SubmitEvent
        ? event.nativeEvent.submitter
        : null;
    try {
      await request("professional-managers", "PUT", {
        professionalId: form.get("professionalId"),
        userId: form.get("userId"),
        enabled:
          submitter instanceof HTMLButtonElement && submitter.value === "true",
      });
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar a atribuição.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeProfessional(id: string) {
    if (
      !window.confirm(
        "Excluir definitivamente este profissional e remover as suas associações?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`professionals/${id}`, "DELETE");
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível excluir o profissional.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {workspace.organization.name}
          </p>
          <h1 className="text-3xl font-semibold">Barber</h1>
          <p className="mt-1 text-muted-foreground">
            Perfil, equipa, serviços e clientes.
          </p>
        </div>
        <Link className="text-sm underline" href={`/workspace/${slug}`}>
          Voltar ao painel
        </Link>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="rounded-xl border bg-card p-6">
          A carregar dados da barbearia…
        </p>
      ) : (
        <>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-xl font-semibold">Perfil da barbearia</h2>
            {profile ? (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <b>Nome:</b> {String(profile.businessName ?? "—")}
                </p>
                <p>
                  <b>Telefone:</b> {String(profile.phone ?? "—")}
                </p>
                <p>
                  <b>Email:</b> {String(profile.email ?? "—")}
                </p>
                <p>
                  <b>Fuso horário:</b>{" "}
                  {String(profile.timezone ?? "Europe/Lisbon")}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Ainda não existe perfil da barbearia.
              </p>
            )}
            {canAdmin && (
              <form
                className="mt-4 grid gap-2 sm:grid-cols-2"
                onSubmit={(e) =>
                  void submit(
                    e,
                    "profile",
                    ["businessName", "phone", "email", "address", "timezone"],
                    "PUT",
                  )
                }
              >
                <input
                  required
                  name="businessName"
                  defaultValue={String(profile?.businessName ?? "")}
                  placeholder="Nome comercial"
                  className="rounded-md border bg-background px-3 py-2"
                />
                <input
                  name="phone"
                  defaultValue={String(profile?.phone ?? "")}
                  placeholder="Telefone"
                  className="rounded-md border bg-background px-3 py-2"
                />
                <input
                  name="email"
                  type="email"
                  defaultValue={String(profile?.email ?? "")}
                  placeholder="Email"
                  className="rounded-md border bg-background px-3 py-2"
                />
                <input
                  name="address"
                  defaultValue={String(profile?.address ?? "")}
                  placeholder="Morada"
                  className="rounded-md border bg-background px-3 py-2"
                />
                <input
                  name="timezone"
                  defaultValue={String(profile?.timezone ?? "Europe/Lisbon")}
                  placeholder="Timezone IANA"
                  className="rounded-md border bg-background px-3 py-2"
                />
                <button
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                >
                  Guardar perfil
                </button>
              </form>
            )}
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-xl font-semibold">
                Profissionais{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {professionals.length}
                </span>
              </h2>
              <div className="mt-3 divide-y">
                {professionals.map((p) => (
                  <article key={p.id} className="py-3">
                    <p className="font-medium">
                      {String(p.displayName)}
                      {p.isActive === false && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Inativo
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {String(p.email ?? "Sem email")} ·{" "}
                      {String(p.phone ?? "Sem telefone")}
                    </p>
                    {(canAdmin ||
                      editableProfessionalIds.includes(String(p.id))) && (
                      <form
                        className="mt-2 flex flex-wrap gap-2"
                        onSubmit={(e) =>
                          void submit(
                            e,
                            `professionals/${p.id}`,
                            ["displayName", "phone", "email", "isActive"],
                            "PUT",
                          )
                        }
                      >
                        <input
                          required
                          name="displayName"
                          defaultValue={String(p.displayName)}
                          aria-label="Nome do profissional"
                          className="rounded-md border bg-background px-3 py-2"
                        />
                        <input
                          name="phone"
                          defaultValue={String(p.phone ?? "")}
                          aria-label="Telefone do profissional"
                          className="rounded-md border bg-background px-3 py-2"
                        />
                        <input
                          name="email"
                          type="email"
                          defaultValue={String(p.email ?? "")}
                          aria-label="Email do profissional"
                          className="rounded-md border bg-background px-3 py-2"
                        />
                        <select
                          name="isActive"
                          defaultValue={String(p.isActive !== false)}
                          aria-label="Estado do profissional"
                          className="rounded-md border bg-background px-3 py-2"
                        >
                          <option value="true">Ativo</option>
                          <option value="false">Inativo</option>
                        </select>
                        <button
                          disabled={busy}
                          className="rounded-md border px-3 py-2"
                        >
                          Guardar
                        </button>
                        {workspace.role === "owner" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void removeProfessional(String(p.id))
                            }
                            className="rounded-md border border-destructive/40 px-3 py-2 text-destructive"
                          >
                            Excluir
                          </button>
                        )}
                      </form>
                    )}
                  </article>
                ))}
                {!professionals.length && (
                  <p className="py-3 text-sm text-muted-foreground">
                    Sem profissionais registados.
                  </p>
                )}
              </div>
              {canAdmin && (
                <form
                  className="mt-4 grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) =>
                    void submit(e, "professionals", [
                      "displayName",
                      "phone",
                      "email",
                    ])
                  }
                >
                  <input
                    required
                    name="displayName"
                    placeholder="Nome do profissional"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <input
                    name="phone"
                    placeholder="Telefone"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <button
                    disabled={busy}
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                  >
                    Adicionar profissional
                  </button>
                </form>
              )}
            </section>
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-xl font-semibold">
                Serviços{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {services.length}
                </span>
              </h2>
              <div className="mt-3 divide-y">
                {services.map((s) => (
                  <article key={s.id} className="py-3">
                    <p className="font-medium">{String(s.name)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(Number(s.priceCents ?? 0))} ·{" "}
                      {formatDuration(Number(s.durationMinutes))}
                    </p>
                    {canAdmin && (
                      <form
                        className="mt-2 flex flex-wrap gap-2"
                        onSubmit={(e) =>
                          void submit(
                            e,
                            `services/${s.id}`,
                            [
                              "name",
                              "priceCents",
                              "durationMinutes",
                              "isActive",
                            ],
                            "PUT",
                          )
                        }
                      >
                        <input
                          required
                          name="name"
                          defaultValue={String(s.name)}
                          aria-label="Nome do serviço"
                          className="rounded-md border bg-background px-3 py-2"
                        />
                        <MoneyField
                          name="priceCents"
                          defaultValue={Number(s.priceCents)}
                          aria-label="Preço do serviço"
                          className="w-36 rounded-md border bg-background px-3 py-2"
                        />
                        <DurationField
                          name="durationMinutes"
                          defaultValue={Number(s.durationMinutes)}
                          aria-label="Duração em minutos"
                          className="w-40 rounded-md border bg-background px-3 py-2"
                        />
                        <select
                          name="isActive"
                          defaultValue={String(s.isActive !== false)}
                          aria-label="Estado do serviço"
                          className="rounded-md border bg-background px-3 py-2"
                        >
                          <option value="true">Ativo</option>
                          <option value="false">Desativado</option>
                        </select>
                        <button
                          disabled={busy}
                          className="rounded-md border px-3 py-2"
                        >
                          Guardar
                        </button>
                      </form>
                    )}
                  </article>
                ))}
                {!services.length && (
                  <p className="py-3 text-sm text-muted-foreground">
                    Sem serviços registados.
                  </p>
                )}
              </div>
              {canAdmin && (
                <form
                  className="mt-4 grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) =>
                    void submit(e, "services", [
                      "name",
                      "priceCents",
                      "durationMinutes",
                    ])
                  }
                >
                  <input
                    required
                    name="name"
                    placeholder="Nome do serviço"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <MoneyField
                    name="priceCents"
                    aria-label="Preço do serviço"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <DurationField
                    name="durationMinutes"
                    aria-label="Duração em minutos"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <button
                    disabled={busy}
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                  >
                    Adicionar serviço
                  </button>
                </form>
              )}
            </section>
            <section className="rounded-xl border bg-card p-5 lg:col-span-2">
              <h2 className="text-xl font-semibold">
                Clientes{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {clients.length}
                </span>
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clients.map((c) => (
                  <article key={c.id} className="rounded-lg border p-3">
                    <p className="font-medium">{String(c.fullName)}</p>
                    <p className="text-sm text-muted-foreground">
                      {String(c.phone)}
                      {c.email ? ` · ${String(c.email)}` : ""}
                    </p>
                    {canWrite && (
                      <form
                        className="mt-3 space-y-2"
                        onSubmit={(e) =>
                          void submit(
                            e,
                            `clients/${c.id}`,
                            ["fullName", "phone", "email"],
                            "PUT",
                          )
                        }
                      >
                        <input
                          required
                          name="fullName"
                          defaultValue={String(c.fullName)}
                          aria-label="Nome do cliente"
                          className="w-full rounded-md border bg-background px-3 py-2"
                        />
                        <input
                          required
                          name="phone"
                          defaultValue={String(c.phone)}
                          aria-label="Telefone do cliente"
                          className="w-full rounded-md border bg-background px-3 py-2"
                        />
                        <input
                          name="email"
                          type="email"
                          defaultValue={String(c.email ?? "")}
                          aria-label="Email do cliente"
                          className="w-full rounded-md border bg-background px-3 py-2"
                        />
                        <button
                          disabled={busy}
                          className="rounded-md border px-3 py-2"
                        >
                          Guardar alterações
                        </button>
                      </form>
                    )}
                  </article>
                ))}
                {!clients.length && (
                  <p className="text-sm text-muted-foreground">
                    Sem clientes visíveis para esta conta.
                  </p>
                )}
              </div>
              {canWrite && (
                <form
                  className="mt-4 grid gap-2 sm:grid-cols-3"
                  onSubmit={(e) =>
                    void submit(e, "clients", ["fullName", "phone", "email"])
                  }
                >
                  <input
                    required
                    name="fullName"
                    placeholder="Nome"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <input
                    required
                    name="phone"
                    placeholder="Telefone"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email opcional"
                    className="rounded-md border bg-background px-3 py-2"
                  />
                  <button
                    disabled={busy}
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                  >
                    Adicionar cliente
                  </button>
                </form>
              )}
            </section>
          </div>
          {canAdmin && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-xl font-semibold">
                Serviços por profissional
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Apenas Owner e Admin podem alterar estas associações.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {associations.map((a) => (
                  <span className="rounded-full border px-3 py-1" key={a.id}>
                    {professionals.find((p) => p.id === a.professionalId)
                      ?.displayName ?? "Profissional"}{" "}
                    ·{" "}
                    {services.find((s) => s.id === a.serviceId)?.name ??
                      "Serviço"}
                  </span>
                ))}
                {!associations.length && (
                  <span className="text-muted-foreground">
                    Sem associações.
                  </span>
                )}
              </div>
              <form
                className="mt-4 flex flex-wrap gap-2"
                onSubmit={(e) => void setAssociation(e)}
              >
                <select
                  required
                  name="professionalId"
                  className="rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Escolher profissional</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {String(p.displayName)}
                    </option>
                  ))}
                </select>
                <select
                  required
                  name="serviceId"
                  className="rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Escolher serviço</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {String(s.name)}
                    </option>
                  ))}
                </select>
                <button
                  name="enabled"
                  value="true"
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                >
                  Associar serviço
                </button>
                <button
                  name="enabled"
                  value="false"
                  disabled={busy}
                  className="rounded-md border px-4 py-2"
                >
                  Remover associação
                </button>
              </form>
            </section>
          )}
          {canAdmin && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-xl font-semibold">
                Atribuição de Members a profissionais
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Apenas Owner e Admin podem alterar estas atribuições.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {managers.map((a) => (
                  <span className="rounded-full border px-3 py-1" key={a.id}>
                    {professionals.find((p) => p.id === a.professionalId)
                      ?.displayName ?? "Profissional"}{" "}
                    ·{" "}
                    {members.find((m) => m.userId === a.userId)?.email ??
                      "Member"}
                  </span>
                ))}
                {!managers.length && (
                  <span className="text-muted-foreground">
                    Sem atribuições.
                  </span>
                )}
              </div>
              <form
                className="mt-4 flex flex-wrap gap-2"
                onSubmit={(e) => void setManager(e)}
              >
                <select
                  required
                  name="professionalId"
                  className="rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Escolher profissional</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {String(p.displayName)}
                    </option>
                  ))}
                </select>
                <select
                  required
                  name="userId"
                  className="rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Escolher Member</option>
                  {members
                    .filter((m) => m.role === "member")
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.email}
                      </option>
                    ))}
                </select>
                <button
                  name="enabled"
                  value="true"
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                >
                  Atribuir Member
                </button>
                <button
                  name="enabled"
                  value="false"
                  disabled={busy}
                  className="rounded-md border px-4 py-2"
                >
                  Remover atribuição
                </button>
              </form>
            </section>
          )}
          {!canAdmin && !canWrite && (
            <p className="text-sm text-muted-foreground">
              Acesso de consulta. A sua conta não tem permissão para editar.
            </p>
          )}
        </>
      )}
    </section>
  );
}
