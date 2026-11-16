"use client";

import { useCallback, useEffect, useState } from "react";
import { organizationRequest } from "@/lib/auth-api";

type Item = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  resourceUrl?: string;
};
type Roadmap = { id: string; goal: string; items: Item[] };
export function DeveloperRoadmaps({ slug }: { slug: string }) {
  const [rows, setRows] = useState<Roadmap[]>([]);
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [milestoneTimes, setMilestoneTimes] = useState<Record<string, string>>(
    {},
  );
  const base = `${encodeURIComponent(slug)}/developer/roadmaps`;
  const load = useCallback(async () => {
    try {
      setRows(await organizationRequest<Roadmap[]>(base));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load roadmaps.");
    }
  }, [base]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);
  async function create(ai: boolean) {
    setBusy(true);
    setError("");
    try {
      await organizationRequest(ai ? `${base}/generate` : base, {
        method: "POST",
        body: JSON.stringify({ goal }),
      });
      setGoal("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create roadmap.");
    } finally {
      setBusy(false);
    }
  }
  async function save(row: Roadmap) {
    setError("");
    try {
      await organizationRequest(`${base}/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ goal: row.goal, items: row.items }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save roadmap.");
    }
  }
  async function remove(id: string) {
    try {
      await organizationRequest(`${base}/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete roadmap.");
    }
  }
  async function schedule(row: Roadmap, item: Item) {
    const value = milestoneTimes[item.id];
    if (!value) {
      setError("Choose a date and time for the milestone.");
      return;
    }
    const start = new Date(value);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      await organizationRequest(
        `${encodeURIComponent(slug)}/developer/integrations/google_calendar/events`,
        {
          method: "POST",
          body: JSON.stringify({
            summary: `${row.goal}: ${item.title}`,
            description: item.description,
            start: start.toISOString(),
            end: end.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            idempotencyKey: `roadmap-${row.id}-${item.id}`,
          }),
        },
      );
      setError("Milestone scheduled in Google Calendar.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connect Google Calendar to schedule milestones.",
      );
    }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">Learning roadmaps</h1>
        <p className="mt-2 text-muted-foreground">
          Create a manual plan or ask AI for an editable draft based on your
          saved skills.
        </p>
      </header>
      {error && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create(false);
        }}
        className="space-y-3 rounded-xl border p-5"
      >
        <label className="block text-sm">
          Learning or career goal
          <input
            required
            maxLength={160}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background p-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="rounded-md border px-3 py-2">
            Create manual roadmap
          </button>
          <button
            type="button"
            disabled={busy || !goal.trim()}
            onClick={() => void create(true)}
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
          >
            Generate AI draft
          </button>
        </div>
      </form>
      {rows.map((row) => (
        <article key={row.id} className="space-y-3 rounded-xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{row.goal}</h2>
            <button
              type="button"
              onClick={() => void remove(row.id)}
              className="text-sm underline"
            >
              Delete
            </button>
          </div>
          <ul className="space-y-3">
            {row.items.map((item, index) => (
              <li key={item.id} className="rounded-lg bg-muted/30 p-3">
                <label className="flex gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(event) => {
                      const items = [...row.items];
                      items[index] = {
                        ...item,
                        completed: event.target.checked,
                      };
                      void save({ ...row, items });
                    }}
                  />
                  <input
                    aria-label="Milestone title"
                    maxLength={160}
                    value={item.title}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((candidate) =>
                          candidate.id !== row.id
                            ? candidate
                            : {
                                ...candidate,
                                items: candidate.items.map(
                                  (entry, entryIndex) =>
                                    entryIndex === index
                                      ? { ...entry, title: event.target.value }
                                      : entry,
                                ),
                              },
                        ),
                      )
                    }
                    className="rounded border bg-background px-2 py-1"
                  />
                </label>
                <textarea
                  aria-label="Milestone description"
                  maxLength={2000}
                  value={item.description}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((candidate) =>
                        candidate.id !== row.id
                          ? candidate
                          : {
                              ...candidate,
                              items: candidate.items.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      description: event.target.value,
                                    }
                                  : entry,
                              ),
                            },
                      ),
                    )
                  }
                  className="mt-1 min-h-16 w-full rounded border bg-background p-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void save(row)}
                  className="ml-6 text-sm underline"
                >
                  Save milestone changes
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                  <input
                    aria-label={`Schedule ${item.title}`}
                    type="datetime-local"
                    value={milestoneTimes[item.id] ?? ""}
                    onChange={(event) =>
                      setMilestoneTimes((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="rounded-md border bg-background p-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void schedule(row, item)}
                    className="text-sm underline"
                  >
                    Schedule in Google Calendar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              void save({
                ...row,
                items: [
                  ...row.items,
                  {
                    id: crypto.randomUUID(),
                    title: "New milestone",
                    description: "",
                    completed: false,
                  },
                ],
              })
            }
            className="text-sm underline"
          >
            Add milestone
          </button>
        </article>
      ))}
      {!rows.length && (
        <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          No roadmaps yet. Manual planning works without an AI key.
        </p>
      )}
    </section>
  );
}
