"use client";

import { useState, type FormEvent } from "react";

export type AuthField = {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  minLength?: number;
};

type AuthFormProps = {
  title: string;
  description: string;
  fields: AuthField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<string>;
};

export function AuthForm({
  title,
  description,
  fields,
  submitLabel,
  onSubmit,
}: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      setMessage(await onSubmit(values));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The request failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <div className="space-y-2" key={field.name}>
            <label className="text-sm font-medium" htmlFor={field.name}>
              {field.label}
            </label>
            <input
              autoComplete={field.autoComplete}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id={field.name}
              minLength={field.minLength}
              name={field.name}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
              required
              type={field.type}
              value={values[field.name] ?? ""}
            />
          </div>
        ))}
        {error && (
          <p
            aria-live="polite"
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            aria-live="polite"
            className="text-sm text-foreground"
            role="status"
          >
            {message}
          </p>
        )}
        <button
          className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Please wait..." : submitLabel}
        </button>
      </form>
    </section>
  );
}
