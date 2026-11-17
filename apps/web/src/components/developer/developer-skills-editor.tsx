"use client";

import { useCallback, useEffect, useState } from "react";
import { organizationRequest } from "@/lib/auth-api";

type Skill = {
  id: string;
  kind: "technical" | "soft" | "language";
  name: string;
  category: string | null;
  proficiency: string | null;
  yearsExperience: number | null;
  description: string | null;
};

export function DeveloperSkillsEditor({ slug }: { slug: string }) {
  const [items, setItems] = useState<Skill[]>([]);
  const [kind, setKind] = useState<Skill["kind"]>("technical");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [proficiency, setProficiency] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading skills…");

  const load = useCallback(async () => {
    try {
      const rows = await organizationRequest<Skill[]>(
        `${encodeURIComponent(slug)}/developer/skills`,
      );
      setItems(rows);
      setStatus("");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not load skills.",
      );
    }
  }, [slug]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    try {
      await organizationRequest(
        `${encodeURIComponent(slug)}/developer/skills${editing ? `/${editing}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            kind,
            name,
            category: category || undefined,
            proficiency: proficiency || undefined,
            yearsExperience: yearsExperience || undefined,
            description: description || undefined,
          }),
        },
      );
      setName("");
      setCategory("");
      setProficiency("");
      setYearsExperience("");
      setDescription("");
      setEditing(null);
      await load();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not add skill.",
      );
    }
  }

  async function remove(id: string) {
    try {
      await organizationRequest(
        `${encodeURIComponent(slug)}/developer/skills/${id}`,
        { method: "DELETE" },
      );
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not remove skill.",
      );
    }
  }

  function edit(item: Skill) {
    setEditing(item.id);
    setKind(item.kind);
    setName(item.name);
    setCategory(item.category ?? "");
    setProficiency(item.proficiency ?? "");
    setYearsExperience(
      item.yearsExperience == null ? "" : String(item.yearsExperience),
    );
    setDescription(item.description ?? "");
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Developer module</p>
        <h1 className="text-3xl font-semibold">Skills & languages</h1>
      </header>
      {status && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {status}
        </p>
      )}
      <form
        onSubmit={add}
        className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-2"
      >
        <label className="space-y-1 text-sm">
          Kind
          <select
            className="w-full rounded-md border bg-background p-2"
            value={kind}
            onChange={(event) => setKind(event.target.value as Skill["kind"])}
          >
            <option value="technical">Technical skill</option>
            <option value="soft">Soft skill</option>
            <option value="language">Language</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Name *
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={120}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Category
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={80}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Proficiency
          <select
            className="w-full rounded-md border bg-background p-2"
            value={proficiency}
            onChange={(event) => setProficiency(event.target.value)}
          >
            <option value="">Not specified</option>
            {[
              "beginner",
              "intermediate",
              "advanced",
              "expert",
              "A1",
              "A2",
              "B1",
              "B2",
              "C1",
              "C2",
              "native",
            ].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Years of experience (optional)
          <input
            className="w-full rounded-md border bg-background p-2"
            type="number"
            min="0"
            max="80"
            step="0.5"
            value={yearsExperience}
            onChange={(event) => setYearsExperience(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Description (optional)
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
            {editing ? "Save changes" : "Add skill"}
          </button>
          {editing && (
            <button
              type="button"
              className="rounded-md border px-4 py-2"
              onClick={() => {
                setEditing(null);
                setName("");
                setCategory("");
                setProficiency("");
                setYearsExperience("");
                setDescription("");
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 rounded-lg border p-4"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {item.kind}
                {item.category ? ` · ${item.category}` : ""}
                {item.proficiency ? ` · ${item.proficiency}` : ""}
                {item.yearsExperience != null
                  ? ` · ${item.yearsExperience} years`
                  : ""}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="text-sm underline"
                onClick={() => edit(item)}
                type="button"
              >
                Edit
              </button>
              <button
                className="text-sm underline"
                onClick={() => void remove(item.id)}
                type="button"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && !status && (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No skills added yet.
        </p>
      )}
    </section>
  );
}
