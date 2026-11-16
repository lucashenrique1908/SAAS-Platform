"use client";

import { Loader2 } from "lucide-react";
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
    <section className="w-full max-w-md rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm shadow-primary/25">
          S
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Access portal
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <div className="space-y-2" key={field.name}>
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={field.name}
            >
              {field.label}
            </label>
            <input
              autoComplete={field.autoComplete}
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-sm transition focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/20"
              id={field.name}
              minLength={field.minLength}
              name={field.name}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
              placeholder={field.label}
              required
              type={field.type}
              value={values[field.name] ?? ""}
            />
          </div>
        ))}
        {error && (
          <p
            aria-live="polite"
            className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            aria-live="polite"
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            {message}
          </p>
        )}
        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait...
            </>
          ) : (
            submitLabel
          )}
        </button>
      </form>
    </section>
  );
}
