export const DEFAULT_LOCALE = "pt-PT";
export const DEFAULT_CURRENCY = "EUR";
export const MAX_PRICE_CENTS = 10_000_000;
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 1440;

function formatLocalizedNumber(value: number, locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(value);
  if (locale.toLowerCase() !== "pt-pt")
    return parts.map((part) => part.value).join("");
  const integer =
    parts
      .filter((part) => part.type === "integer")
      .map((part) => part.value)
      .join("") || "0";
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let inserted = false;
  return parts
    .map((part) => {
      if (part.type === "integer") {
        if (inserted) return "";
        inserted = true;
        return grouped;
      }
      if (part.type === "group") return "";
      return part.value;
    })
    .join("");
}

export function formatMoney(
  cents: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE,
): string {
  if (!Number.isSafeInteger(cents)) return "—";
  const number = formatLocalizedNumber(cents / 100, locale);
  let numericValueInserted = false;
  return new Intl.NumberFormat(locale, { style: "currency", currency })
    .formatToParts(0)
    .map((part) => {
      if (["integer", "group", "decimal", "fraction"].includes(part.type)) {
        if (numericValueInserted) return "";
        numericValueInserted = true;
        return number;
      }
      return part.value;
    })
    .join("");
}

/** Parses localized decimal money into integer minor units without float rounding. */
export function parseMoneyToCents(input: string): number | null {
  const text = input.trim().replace(/[\s\u00a0\u202f€$£]/g, "");
  if (!text || text.startsWith("-") || !/^\d[\d.,]*$/.test(text)) return null;

  let whole: string;
  let fraction = "";
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimalIndex = Math.max(comma, dot);
    const decimalSeparator = text[decimalIndex];
    const integerPart = text.slice(0, decimalIndex);
    fraction = text.slice(decimalIndex + 1);
    // With both separators, the last one is decimal and the other groups thousands.
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    if (integerPart.includes(decimalSeparator)) return null;
    whole = integerPart.split(groupingSeparator).join("");
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    const count = [...text].filter((char) => char === separator).length;
    const parts = text.split(separator);
    if (count === 1 && parts[1].length <= 2) {
      [whole, fraction = ""] = parts;
    } else if (
      separator === "." &&
      parts.slice(1).every((part) => part.length === 3)
    ) {
      whole = parts.join("");
    } else {
      return null;
    }
  } else {
    whole = text;
  }

  if (!whole || (fraction && !/^\d{1,2}$/.test(fraction))) return null;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || 0);
  return Number.isSafeInteger(cents) && cents <= MAX_PRICE_CENTS ? cents : null;
}

export function formatMoneyInput(
  cents: number,
  locale = DEFAULT_LOCALE,
): string {
  return formatLocalizedNumber(cents / 100, locale);
}

export function formatDuration(minutes: number): string {
  if (
    !Number.isInteger(minutes) ||
    minutes < MIN_DURATION_MINUTES ||
    minutes > MAX_DURATION_MINUTES
  )
    return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes} min`;
  if (!remainder) return `${hours} h`;
  return `${hours} h ${remainder} min`;
}

export function parseDuration(input: string): number | null {
  if (!/^\d+$/.test(input.trim())) return null;
  const minutes = Number(input);
  return Number.isInteger(minutes) &&
    minutes >= MIN_DURATION_MINUTES &&
    minutes <= MAX_DURATION_MINUTES
    ? minutes
    : null;
}
