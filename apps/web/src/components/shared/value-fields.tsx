"use client";

import { useState } from "react";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  formatDuration,
  formatMoney,
  formatMoneyInput,
  MAX_DURATION_MINUTES,
  MAX_PRICE_CENTS,
  parseDuration,
  parseMoneyToCents,
} from "@/lib/value-format";

type FieldProps = {
  name: string;
  defaultValue?: number;
  className?: string;
  "aria-label": string;
};

type MoneyFieldProps = FieldProps & { locale?: string; currency?: string };

export function MoneyField({
  name,
  defaultValue = 0,
  className,
  locale = DEFAULT_LOCALE,
  currency = DEFAULT_CURRENCY,
  ...props
}: MoneyFieldProps) {
  const [value, setValue] = useState(() =>
    formatMoneyInput(defaultValue, locale),
  );
  const cents = parseMoneyToCents(value);
  return (
    <label className="grid gap-1">
      <input
        {...props}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
        aria-invalid={cents === null}
        className={className}
        placeholder="0,00"
      />
      <span className="text-xs text-muted-foreground" aria-live="polite">
        Pré-visualização:{" "}
        {cents === null
          ? "valor inválido"
          : formatMoney(cents, currency, locale)}
      </span>
      <input type="hidden" name={`${name}__cents`} value={cents ?? ""} />
    </label>
  );
}

export function DurationField({
  name,
  defaultValue,
  className,
  ...props
}: FieldProps) {
  const [value, setValue] = useState(
    defaultValue === undefined ? "" : String(defaultValue),
  );
  const minutes = parseDuration(value);
  return (
    <label className="grid gap-1">
      <input
        {...props}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
        aria-invalid={minutes === null}
        aria-describedby={`${name}-duration-limit`}
        className={className}
        placeholder="Duração em minutos"
        maxLength={4}
      />
      <span
        id={`${name}-duration-limit`}
        className="text-xs text-muted-foreground"
      >
        Máximo: {MAX_DURATION_MINUTES} minutos
      </span>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        Pré-visualização:{" "}
        {minutes === null ? "duração inválida" : formatDuration(minutes)}
      </span>
    </label>
  );
}

export { MAX_PRICE_CENTS };
