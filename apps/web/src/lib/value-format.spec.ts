import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatMoney,
  formatMoneyInput,
  MAX_PRICE_CENTS,
  parseDuration,
  parseMoneyToCents,
} from "./value-format";

describe("money formatting and parsing", () => {
  it.each([
    [27, "0,27 €"],
    [2700, "27,00 €"],
    [275050, "2.750,50 €"],
    [100000000, "1.000.000,00 €"],
  ])("formats %i cents", (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });

  it.each([
    ["27", 2700],
    ["2750,50", 275050],
    ["2.750,50", 275050],
    ["2750.50", 275050],
    ["2.750", 275000],
  ])("parses %s into integer cents", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it("round trips existing stored cents when editing", () => {
    const storedPriceCents = 2700;
    expect(formatMoneyInput(storedPriceCents)).toBe("27,00");
    expect(parseMoneyToCents(formatMoneyInput(storedPriceCents))).toBe(2700);
    expect(formatMoney(storedPriceCents)).toContain("27,00");
  });

  it.each(["", "   ", "-1", "abc", "1,234", "1.2.3", "100000,01"])(
    "rejects invalid or out of range value %s",
    (input) => expect(parseMoneyToCents(input)).toBeNull(),
  );
  it("keeps the existing API maximum in minor units", () => {
    expect(parseMoneyToCents("100000,00")).toBe(MAX_PRICE_CENTS);
    expect(parseMoneyToCents("100000,01")).toBeNull();
    expect(parseMoneyToCents("2700")).toBe(270000); // entered euros, not stored cents
  });
});

describe("duration formatting and validation", () => {
  it.each([
    [30, "30 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
    [120, "2 h"],
    [150, "2 h 30 min"],
  ])("formats %i minutes", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
    expect(parseDuration(String(minutes))).toBe(minutes);
  });
  it.each(["", "0", "1.5", "-5", "1441", "abc"])(
    "rejects invalid duration %s",
    (input) => expect(parseDuration(input)).toBeNull(),
  );
  it("previews valid input directly from the current text", () => {
    expect(formatMoney(parseMoneyToCents("27,50")!)).toContain("27,50");
    expect(formatDuration(parseDuration("90")!)).toBe("1 h 30 min");
  });
});
