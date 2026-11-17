"use client";

import { useCallback, useEffect, useState } from "react";
import { organizationRequest } from "@/lib/auth-api";

type Integration = {
  provider: "github" | "linkedin" | "google_calendar";
  connected: boolean;
  accountName: string | null;
  scopes: string[];
  updatedAt: string | null;
};
type CalendarEvent = {
  id: string;
  summary?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
};
const labels: Record<Integration["provider"], string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  google_calendar: "Google Calendar",
};

export function DeveloperIntegrations({
  slug,
  result,
}: {
  slug: string;
  result?: string;
}) {
  const [items, setItems] = useState<Integration[]>([]);
  const [message, setMessage] = useState(
    result === "connected"
      ? "Provider connected."
      : result === "failed"
        ? "Connection was not completed."
        : "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({});
  const path = `${encodeURIComponent(slug)}/developer/integrations`;
  const load = useCallback(async () => {
    try {
      setItems(await organizationRequest<Integration[]>(path));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load integrations.",
      );
    }
  }, [path]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function connect(provider: Integration["provider"]) {
    setBusy(provider);
    setMessage("");
    try {
      const response = await organizationRequest<{ authorizationUrl: string }>(
        `${path}/${provider}/connect`,
        { method: "POST" },
      );
      window.location.assign(response.authorizationUrl);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Provider connection is unavailable.",
      );
      setBusy(null);
    }
  }
  async function disconnect(provider: Integration["provider"]) {
    setBusy(provider);
    setMessage("");
    try {
      await organizationRequest(`${path}/${provider}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not disconnect provider.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function loadEvents() {
    try {
      const result = await organizationRequest<{ items: CalendarEvent[] }>(
        `${path}/google_calendar/events`,
      );
      setEvents(result.items ?? []);
      setEventTitles(
        Object.fromEntries(
          (result.items ?? []).map((event) => [
            event.id,
            event.summary ?? "Calendar event",
          ]),
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load calendar events.",
      );
    }
  }
  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("event");
    setMessage("");
    const key = eventKey ?? crypto.randomUUID();
    setEventKey(key);
    try {
      await organizationRequest(`${path}/google_calendar/events`, {
        method: "POST",
        body: JSON.stringify({
          summary: eventTitle,
          start: new Date(eventStart).toISOString(),
          end: new Date(eventEnd).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          idempotencyKey: key,
        }),
      });
      setEventTitle("");
      setEventKey(null);
      await loadEvents();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create calendar event.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function updateEvent(eventId: string) {
    setBusy(eventId);
    try {
      await organizationRequest(
        `${path}/google_calendar/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ summary: eventTitles[eventId] }),
        },
      );
      setMessage("Calendar event updated.");
      await loadEvents();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update calendar event.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteEvent(eventId: string) {
    if (!window.confirm("Delete this calendar event?")) return;
    setBusy(eventId);
    try {
      await organizationRequest(
        `${path}/google_calendar/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      setEvents((current) => current.filter((event) => event.id !== eventId));
      setMessage("Calendar event deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete calendar event.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">Integrations</h1>
        <p className="mt-2 text-muted-foreground">
          Connect your own provider account. Credentials stay on the server and
          are encrypted at rest.
        </p>
      </header>
      {message && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {message}
        </p>
      )}
      <ul className="space-y-3">
        {(["github", "linkedin", "google_calendar"] as const).map(
          (provider) => {
            const item = items.find(
              (candidate) => candidate.provider === provider,
            );
            return (
              <li
                key={provider}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5"
              >
                <div>
                  <h2 className="font-semibold">{labels[provider]}</h2>
                  <p className="text-sm text-muted-foreground">
                    {item?.connected
                      ? `Connected${item.accountName ? ` as ${item.accountName}` : ""}`
                      : "Not connected"}
                  </p>
                  {provider === "linkedin" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Only provider-approved identity fields are imported. Add
                      work history manually.
                    </p>
                  )}
                </div>
                {item?.connected ? (
                  <button
                    type="button"
                    disabled={busy === provider}
                    onClick={() => void disconnect(provider)}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    {busy === provider ? "Working…" : "Disconnect"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy === provider}
                    onClick={() => void connect(provider)}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                  >
                    {busy === provider ? "Connecting…" : "Connect"}
                  </button>
                )}
              </li>
            );
          },
        )}
      </ul>
      {items.find((item) => item.provider === "google_calendar")?.connected && (
        <div className="space-y-4 rounded-xl border p-5">
          <h2 className="text-lg font-semibold">Google Calendar events</h2>
          <form
            onSubmit={(e) => void createEvent(e)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <input
              required
              aria-label="Event title"
              placeholder="Event title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="rounded-md border bg-background p-2"
            />
            <input
              required
              aria-label="Start"
              type="datetime-local"
              value={eventStart}
              onChange={(e) => setEventStart(e.target.value)}
              className="rounded-md border bg-background p-2"
            />
            <input
              required
              aria-label="End"
              type="datetime-local"
              value={eventEnd}
              onChange={(e) => setEventEnd(e.target.value)}
              className="rounded-md border bg-background p-2"
            />
            <button
              disabled={busy === "event"}
              className="rounded-md border px-3 py-2"
            >
              Create event
            </button>
          </form>
          <button
            type="button"
            onClick={() => void loadEvents()}
            className="text-sm underline"
          >
            Load upcoming events
          </button>
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                {event.htmlLink ? (
                  <a
                    className="underline"
                    href={event.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {event.summary ?? "Calendar event"}
                  </a>
                ) : (
                  (event.summary ?? "Calendar event")
                )}{" "}
                · {event.start?.dateTime ?? event.start?.date ?? ""}
                <label className="sr-only" htmlFor={`event-title-${event.id}`}>
                  Event title
                </label>
                <input
                  id={`event-title-${event.id}`}
                  value={eventTitles[event.id] ?? event.summary ?? ""}
                  onChange={(change) =>
                    setEventTitles((current) => ({
                      ...current,
                      [event.id]: change.target.value,
                    }))
                  }
                  className="min-w-0 rounded-md border bg-background px-2 py-1"
                />
                <button
                  type="button"
                  disabled={busy === event.id}
                  onClick={() => void updateEvent(event.id)}
                  className="rounded-md border px-2 py-1"
                >
                  Save title
                </button>
                <button
                  type="button"
                  disabled={busy === event.id}
                  onClick={() => void deleteEvent(event.id)}
                  className="rounded-md border px-2 py-1 text-destructive"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        GitHub import is limited to public repositories. Google Calendar and
        LinkedIn require valid OAuth application credentials configured by the
        service operator.
      </p>
    </section>
  );
}
