"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney, formatDuration } from "@/lib/value-format";

type Row = { id: string; [key: string]: string | number | boolean | null };
type Slot = {
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string;
};
const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const EXCEPTION_TYPES = [
  "DAY_OFF",
  "VACATION",
  "ABSENCE",
  "APPOINTMENT",
  "BLOCK",
];

function dayInZone(zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function localDateTime(iso: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function displayDateTime(iso: string, zone: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function BarberOperations({
  slug,
  canWrite,
  canAdmin,
  editableProfessionalIds,
}: {
  slug: string;
  canWrite: boolean;
  canAdmin: boolean;
  editableProfessionalIds: string[];
}) {
  const [professionals, setProfessionals] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  const [clients, setClients] = useState<Row[]>([]);
  const [appointments, setAppointments] = useState<Row[]>([]);
  const [exceptions, setExceptions] = useState<Row[]>([]);
  const [dashboard, setDashboard] = useState<{
    timeZone: string;
    today: number;
    upcoming: Row[];
    counts: Record<string, number>;
  } | null>(null);
  const [date, setDate] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [appointmentProfessionalId, setAppointmentProfessionalId] =
    useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [workingHours, setWorkingHours] = useState<Row[]>([]);
  const [hoursScope, setHoursScope] = useState("");
  const [scheduleText, setScheduleText] = useState<Record<number, string>>({});
  const [editingAppointment, setEditingAppointment] = useState<Row | null>(
    null,
  );
  const [editingException, setEditingException] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const timeZone = dashboard?.timeZone ?? "Europe/Lisbon";
  const apiBase = `/api/organizations/${encodeURIComponent(slug)}/barber`;

  const request = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(`${apiBase}/${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        conflicts?: unknown;
      } | null;
      if (!response.ok) {
        const conflicts = Array.isArray(data?.conflicts)
          ? (data.conflicts as Array<{
              clientName?: string;
              startsAt?: string;
            }>)
          : [];
        const details = conflicts.length
          ? `: ${conflicts.map((item) => `${item.clientName ?? "Cliente"} · ${item.startsAt ? displayDateTime(item.startsAt, timeZone) : "horário por confirmar"}`).join("; ")}`
          : "";
        throw new Error(
          `${data?.message ?? "Não foi possível concluir a operação."}${details}`,
        );
      }
      return data;
    },
    [apiBase, timeZone],
  );

  const refresh = useCallback(
    async (targetDate?: string) => {
      setLoading(true);
      setError("");
      try {
        const profile = (await request("profile")) as {
          timezone?: string;
        } | null;
        const zone = profile?.timezone ?? "Europe/Lisbon";
        const selectedDate = targetDate ?? date ?? dayInZone(zone);
        if (!date) setDate(selectedDate);
        const [summary, people, catalog, customerList, agenda, absent] =
          await Promise.all([
            request("dashboard"),
            request("professionals"),
            request("services"),
            request("clients"),
            request(
              `appointments?date=${encodeURIComponent(selectedDate)}${selectedProfessional ? `&professionalId=${encodeURIComponent(selectedProfessional)}` : ""}${selectedClient ? `&clientId=${encodeURIComponent(selectedClient)}` : ""}${selectedStatus ? `&status=${encodeURIComponent(selectedStatus)}` : ""}`,
            ),
            request("availability-exceptions"),
          ]);
        setDashboard(summary as typeof dashboard);
        setProfessionals(people as Row[]);
        setServices(catalog as Row[]);
        setClients(customerList as Row[]);
        setAppointments(agenda as Row[]);
        setExceptions(absent as Row[]);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Erro ao carregar a agenda.",
        );
      } finally {
        setLoading(false);
      }
    },
    [date, request, selectedClient, selectedProfessional, selectedStatus],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const query = new URLSearchParams({ serviceId, date });
    if (appointmentProfessionalId)
      query.set("professionalId", appointmentProfessionalId);
    if (editingAppointment)
      query.set("excludingAppointmentId", String(editingAppointment.id));
    if (!serviceId || !date) return;
    let active = true;
    void request(`availability?${query}`)
      .then((result) => {
        if (active) setSlots(result as Slot[]);
      })
      .catch((cause) => {
        if (active) {
          setSlots([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Erro ao consultar disponibilidade.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [appointmentProfessionalId, date, editingAppointment, request, serviceId]);

  useEffect(() => {
    let active = true;
    const path = `working-hours${hoursScope ? `?professionalId=${encodeURIComponent(hoursScope)}` : ""}`;
    void request(path)
      .then((result) => {
        if (!active) return;
        const rows = result as Row[];
        setWorkingHours(rows);
        const values: Record<number, string> = {};
        for (let weekday = 0; weekday < 7; weekday++) {
          values[weekday] = rows
            .filter((row) => Number(row.weekday) === weekday)
            .map(
              (row) =>
                `${String(row.startTime).slice(0, 5)}-${String(row.endTime).slice(0, 5)}`,
            )
            .join(", ");
        }
        setScheduleText(values);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Erro ao carregar horários.",
          );
      });
    return () => {
      active = false;
    };
  }, [hoursScope, request]);

  const professionalsById = useMemo(
    () => new Map(professionals.map((item) => [item.id, item])),
    [professionals],
  );
  const displaySlots = serviceId && date ? slots : [];

  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const periods: Array<{
        weekday: number;
        startTime: string;
        endTime: string;
      }> = [];
      for (const [day, text] of Object.entries(scheduleText)) {
        if (!text.trim()) continue;
        for (const pair of text.split(",")) {
          const match = pair
            .trim()
            .match(/^([01]\d|2[0-3]):[0-5]\d\s*-\s*([01]\d|2[0-3]):[0-5]\d$/);
          if (!match)
            throw new Error(
              `Horário inválido em ${WEEKDAYS[Number(day)]}. Use HH:mm-HH:mm e separe períodos com vírgulas.`,
            );
          periods.push({
            weekday: Number(day),
            startTime: match[0].slice(0, 5),
            endTime: match[0].slice(-5),
          });
        }
      }
      await request("working-hours", "PUT", {
        professionalId: hoursScope || null,
        periods,
      });
      setMessage("Horários guardados.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao guardar horários.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveException(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const body: Record<string, string | null> = Object.fromEntries(
      [...data.entries()].map(([key, value]) => [
        key,
        typeof value === "string" ? value : "",
      ]),
    );
    body.professionalId = String(body.professionalId ?? "") || null;
    try {
      await request(
        editingException
          ? `availability-exceptions/${editingException.id}`
          : "availability-exceptions",
        editingException ? "PUT" : "POST",
        body,
      );
      event.currentTarget.reset();
      setEditingException(null);
      setMessage("Indisponibilidade guardada.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Erro ao registar indisponibilidade.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeException(id: string) {
    setBusy(true);
    setError("");
    try {
      await request(`availability-exceptions/${id}`, "DELETE");
      setMessage("Indisponibilidade removida.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Erro ao remover indisponibilidade.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const slotKey = String(data.get("slot") ?? "");
    const [professionalId, startTime] = slotKey.split("|");
    const body = {
      clientId: String(data.get("clientId") ?? ""),
      professionalId,
      serviceId: String(data.get("serviceId") ?? ""),
      date: String(data.get("date") ?? ""),
      startTime,
      notes: String(data.get("notes") ?? "") || null,
    };
    try {
      if (editingAppointment)
        await request(`appointments/${editingAppointment.id}`, "PUT", body);
      else await request("appointments", "POST", body);
      setEditingAppointment(null);
      setMessage("Marcação guardada.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao guardar marcação.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function status(id: string, next: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(`appointments/${id}/status`, "PATCH", { status: next });
      setMessage(`Marcação ${next.toLowerCase()}.`);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao atualizar marcação.",
      );
    } finally {
      setBusy(false);
    }
  }

  function editAppointment(item: Row) {
    const local = localDateTime(String(item.startsAt), timeZone);
    setEditingAppointment(item);
    setServiceId(String(item.serviceId));
    setAppointmentProfessionalId(String(item.professionalId));
    setDate(local.date);
  }

  const statusLabel: Record<string, string> = {
    PENDING: "Pendente",
    CONFIRMED: "Confirmada",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };
  const inputClass = "rounded-md border bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
        >
          {message}
        </p>
      )}
      <section
        aria-labelledby="barber-dashboard-title"
        className="space-y-4 rounded-xl border bg-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="barber-dashboard-title" className="text-xl font-semibold">
              Operação e agenda
            </h2>
            <p className="text-sm text-muted-foreground">
              Fuso horário: {timeZone}
            </p>
          </div>
          <button
            type="button"
            className={inputClass}
            onClick={() => void refresh()}
          >
            Atualizar
          </button>
        </div>
        {loading ? (
          <p role="status">A carregar a agenda…</p>
        ) : dashboard ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Marcações hoje" value={dashboard.today} />
              <Metric label="Pendentes" value={dashboard.counts.pending ?? 0} />
              <Metric
                label="Confirmadas"
                value={dashboard.counts.confirmed ?? 0}
              />
              <Metric
                label="Concluídas"
                value={dashboard.counts.completed ?? 0}
              />
              <Metric
                label="Canceladas"
                value={dashboard.counts.cancelled ?? 0}
              />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <section className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h3 className="font-semibold">Calendário diário</h3>
                  <div className="flex flex-wrap gap-2">
                    <input
                      aria-label="Data da agenda"
                      type="date"
                      value={date}
                      className={inputClass}
                      onChange={(event) => {
                        setDate(event.target.value);
                        void refresh(event.target.value);
                      }}
                    />
                    <select
                      aria-label="Filtrar por profissional"
                      value={selectedProfessional}
                      className={inputClass}
                      onChange={(event) =>
                        setSelectedProfessional(event.target.value)
                      }
                    >
                      <option value="">Todos os profissionais</option>
                      {professionals.map((person) => (
                        <option key={person.id} value={person.id}>
                          {String(person.displayName)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filtrar por cliente"
                      value={selectedClient}
                      className={inputClass}
                      onChange={(event) =>
                        setSelectedClient(event.target.value)
                      }
                    >
                      <option value="">Todos os clientes</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {String(client.fullName)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filtrar por estado"
                      value={selectedStatus}
                      className={inputClass}
                      onChange={(event) =>
                        setSelectedStatus(event.target.value)
                      }
                    >
                      <option value="">Todos os estados</option>
                      {Object.entries({
                        PENDING: "Pendente",
                        CONFIRMED: "Confirmada",
                        COMPLETED: "Concluída",
                        CANCELLED: "Cancelada",
                      }).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {appointments.length ? (
                  <ol className="divide-y">
                    {appointments.map((item) => (
                      <li key={item.id} className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {String(item.clientNameSnapshot)} ·{" "}
                              {String(item.serviceNameSnapshot)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {displayDateTime(String(item.startsAt), timeZone)}
                              –
                              {new Intl.DateTimeFormat("pt-PT", {
                                timeZone,
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(String(item.endsAt)))}{" "}
                              · {String(item.professionalNameSnapshot)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDuration(
                                Number(item.durationMinutesSnapshot),
                              )}{" "}
                              · {formatMoney(Number(item.priceCentsSnapshot))} ·{" "}
                              {statusLabel[String(item.status)] ??
                                String(item.status)}
                            </p>
                            {item.notes && (
                              <p className="mt-1 text-sm">
                                {String(item.notes)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {canWrite &&
                              item.canManage === true &&
                              ["PENDING", "CONFIRMED"].includes(
                                String(item.status),
                              ) && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className={inputClass}
                                    onClick={() => editAppointment(item)}
                                  >
                                    Reagendar
                                  </button>
                                  {item.status === "PENDING" && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className={inputClass}
                                      onClick={() =>
                                        void status(
                                          String(item.id),
                                          "CONFIRMED",
                                        )
                                      }
                                    >
                                      Confirmar
                                    </button>
                                  )}
                                  {item.status === "CONFIRMED" && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className={inputClass}
                                      onClick={() =>
                                        void status(
                                          String(item.id),
                                          "COMPLETED",
                                        )
                                      }
                                    >
                                      Concluir
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className={`${inputClass} text-destructive`}
                                    onClick={() =>
                                      void status(String(item.id), "CANCELLED")
                                    }
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Sem marcações para esta data e filtro.
                  </p>
                )}
              </section>
              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="font-semibold">Próximas marcações</h3>
                {dashboard.upcoming.length ? (
                  <ol className="divide-y">
                    {dashboard.upcoming.map((item) => (
                      <li key={item.id} className="py-2">
                        <p className="font-medium">
                          {String(item.clientNameSnapshot)} ·{" "}
                          {String(item.serviceNameSnapshot)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {displayDateTime(String(item.startsAt), timeZone)} ·{" "}
                          {String(item.professionalNameSnapshot)} ·{" "}
                          {statusLabel[String(item.status)]}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Não existem próximas marcações.
                  </p>
                )}
              </section>
            </div>
          </>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Sem dados operacionais disponíveis.
          </p>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <form
          onSubmit={saveSchedule}
          className="space-y-4 rounded-xl border bg-card p-5"
        >
          <div>
            <h2 className="text-lg font-semibold">Horários semanais</h2>
            <p className="text-sm text-muted-foreground">
              Introduza um ou mais períodos por dia separados por vírgulas. Ex.:
              09:00-12:00, 14:00-19:00.
            </p>
          </div>
          <label className="grid gap-1 text-sm">
            <span>Agenda</span>
            <select
              value={hoursScope}
              onChange={(event) => setHoursScope(event.target.value)}
              className={inputClass}
            >
              <option value="">
                {canAdmin ? "Barbearia" : "Escolher profissional atribuído"}
              </option>
              {professionals
                .filter(
                  (person) =>
                    canAdmin || editableProfessionalIds.includes(person.id),
                )
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {String(person.displayName)}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEEKDAYS.map((label, weekday) => (
              <label key={weekday} className="grid gap-1 text-sm">
                <span>{label}</span>
                <input
                  aria-label={`Horário ${label}`}
                  disabled={!canWrite || (hoursScope === "" && !canAdmin)}
                  value={scheduleText[weekday] ?? ""}
                  onChange={(event) =>
                    setScheduleText((current) => ({
                      ...current,
                      [weekday]: event.target.value,
                    }))
                  }
                  placeholder="Fechado"
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          {canWrite && (
            <button
              disabled={busy || (!canAdmin && !hoursScope)}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Guardar horários
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            Períodos configurados: {workingHours.length}. Os intervalos
            sobrepostos são rejeitados no servidor.
          </p>
        </form>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">
              Folgas, ausências e bloqueios
            </h2>
            <p className="text-sm text-muted-foreground">
              Conflitos com marcações existentes são devolvidos antes de gravar;
              as marcações não são alteradas automaticamente.
            </p>
          </div>
          {canWrite && (
            <form
              onSubmit={(event) => void saveException(event)}
              className="grid gap-2 sm:grid-cols-2"
            >
              <select
                name="professionalId"
                key={`exception-scope-${editingException?.id ?? "new"}`}
                aria-label="Âmbito da indisponibilidade"
                disabled={!canAdmin && !editableProfessionalIds.length}
                defaultValue={String(editingException?.professionalId ?? "")}
                className={inputClass}
              >
                <option value="">Toda a barbearia</option>
                {professionals
                  .filter(
                    (person) =>
                      canAdmin || editableProfessionalIds.includes(person.id),
                  )
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {String(person.displayName)}
                    </option>
                  ))}
              </select>
              <select
                name="type"
                aria-label="Tipo de indisponibilidade"
                key={`exception-type-${editingException?.id ?? "new"}`}
                defaultValue={String(editingException?.type ?? "DAY_OFF")}
                className={inputClass}
              >
                {EXCEPTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <label className="grid gap-1 text-sm">
                Data de início
                <input
                  required
                  name="date"
                  type="date"
                  key={`exception-date-${editingException?.id ?? "new"}`}
                  defaultValue={
                    editingException
                      ? localDateTime(
                          String(editingException.startsAt),
                          timeZone,
                        ).date
                      : ""
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Hora de início
                <input
                  required
                  name="startTime"
                  type="time"
                  key={`exception-start-${editingException?.id ?? "new"}`}
                  defaultValue={
                    editingException
                      ? localDateTime(
                          String(editingException.startsAt),
                          timeZone,
                        ).time
                      : ""
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Data de fim
                <input
                  required
                  name="endDate"
                  type="date"
                  key={`exception-enddate-${editingException?.id ?? "new"}`}
                  defaultValue={
                    editingException
                      ? localDateTime(String(editingException.endsAt), timeZone)
                          .date
                      : ""
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Hora de fim
                <input
                  required
                  name="endTime"
                  type="time"
                  key={`exception-end-${editingException?.id ?? "new"}`}
                  defaultValue={
                    editingException
                      ? localDateTime(String(editingException.endsAt), timeZone)
                          .time
                      : ""
                  }
                  className={inputClass}
                />
              </label>
              <input
                name="reason"
                key={`exception-reason-${editingException?.id ?? "new"}`}
                defaultValue={String(editingException?.reason ?? "")}
                placeholder="Motivo ou observação"
                className={`${inputClass} sm:col-span-2`}
              />
              <div className="flex gap-2 sm:col-span-2">
                <button
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                >
                  {editingException
                    ? "Guardar alterações"
                    : "Registar indisponibilidade"}
                </button>
                {editingException && (
                  <button
                    type="button"
                    className={inputClass}
                    onClick={() => setEditingException(null)}
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
          )}
          <ul className="divide-y">
            {exceptions.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  {String(item.type).replaceAll("_", " ")} ·{" "}
                  {professionalsById.get(String(item.professionalId))
                    ?.displayName ?? "Toda a barbearia"}{" "}
                  · {displayDateTime(String(item.startsAt), timeZone)} –{" "}
                  {displayDateTime(String(item.endsAt), timeZone)}
                  {item.reason ? ` · ${String(item.reason)}` : ""}
                </span>
                {canWrite &&
                  (canAdmin ||
                    (item.professionalId &&
                      editableProfessionalIds.includes(
                        String(item.professionalId),
                      ))) && (
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        type="button"
                        onClick={() => setEditingException(item)}
                        className="underline"
                      >
                        Editar
                      </button>
                      <button
                        disabled={busy}
                        type="button"
                        onClick={() => void removeException(String(item.id))}
                        className="text-destructive underline"
                      >
                        Remover
                      </button>
                    </div>
                  )}
              </li>
            ))}
          </ul>
          {!exceptions.length && (
            <p className="text-sm text-muted-foreground">
              Sem indisponibilidades registadas.
            </p>
          )}
        </section>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">
          {editingAppointment ? "Reagendar marcação" : "Nova marcação"}
        </h2>
        {canWrite ? (
          <form
            onSubmit={(event) => void saveAppointment(event)}
            className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            <select
              required
              name="clientId"
              key={`client-${editingAppointment?.id ?? "new"}`}
              defaultValue={String(editingAppointment?.clientId ?? "")}
              className={inputClass}
            >
              <option value="">Selecionar cliente</option>
              {editingAppointment &&
                !clients.some(
                  (client) => client.id === editingAppointment.clientId,
                ) && (
                  <option value={String(editingAppointment.clientId)}>
                    {String(editingAppointment.clientNameSnapshot)} · marcação
                    atual
                  </option>
                )}
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {String(client.fullName)} · {String(client.phone)}
                </option>
              ))}
            </select>
            <select
              required
              aria-label="Profissional da marcação"
              value={appointmentProfessionalId}
              onChange={(event) =>
                setAppointmentProfessionalId(event.target.value)
              }
              className={inputClass}
            >
              <option value="">Todos os profissionais</option>
              {professionals
                .filter((person) => person.isActive !== false)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {String(person.displayName)}
                  </option>
                ))}
            </select>
            <select
              required
              aria-label="Serviço da marcação"
              name="serviceId"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className={inputClass}
            >
              <option value="">Selecionar serviço</option>
              {services
                .filter((service) => service.isActive !== false)
                .map((service) => (
                  <option key={service.id} value={service.id}>
                    {String(service.name)} ·{" "}
                    {formatDuration(Number(service.durationMinutes))} ·{" "}
                    {formatMoney(Number(service.priceCents))}
                  </option>
                ))}
            </select>
            <input
              required
              name="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
            <select
              required
              name="slot"
              key={`${serviceId}-${date}-${appointmentProfessionalId}-${editingAppointment?.id ?? "new"}`}
              defaultValue={
                editingAppointment
                  ? `${editingAppointment.professionalId}|${localDateTime(String(editingAppointment.startsAt), timeZone).time}`
                  : ""
              }
              className={inputClass}
            >
              <option value="">Selecionar horário disponível</option>
              {displaySlots.map((slot) => (
                <option
                  key={`${slot.professionalId}-${slot.startsAt}`}
                  value={`${slot.professionalId}|${slot.startTime}`}
                >
                  {slot.startTime}–{slot.endTime} · {slot.professionalName}
                </option>
              ))}
            </select>
            <input
              name="notes"
              defaultValue={String(editingAppointment?.notes ?? "")}
              placeholder="Observações"
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                disabled={busy || !displaySlots.length}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                {editingAppointment ? "Guardar novo horário" : "Criar marcação"}
              </button>
              {editingAppointment && (
                <button
                  type="button"
                  className={inputClass}
                  onClick={() => setEditingAppointment(null)}
                >
                  Fechar edição
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              A disponibilidade é calculada no servidor com horários, serviço,
              ausências e marcações ativas; a gravação repete as validações
              dentro de uma transação.
            </p>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            A sua conta tem acesso de consulta.
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
