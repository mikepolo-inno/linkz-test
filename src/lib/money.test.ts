import { describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/money";

describe("formatMoney", () => {
  it("formats USD cents into a localised currency string", () => {
    expect(formatMoney({ amountCents: 5000, currency: "USD" })).toBe("$50.00");
  });

  it("formats zero as a positive value", () => {
    expect(formatMoney({ amountCents: 0, currency: "USD" })).toBe("$0.00");
  });

  it("formats sub-dollar amounts without rounding errors", () => {
    expect(formatMoney({ amountCents: 99, currency: "USD" })).toBe("$0.99");
  });

  it("respects the requested ISO currency", () => {
    expect(formatMoney({ amountCents: 1234, currency: "EUR", locale: "en-IE" })).toBe(
      "€12.34",
    );
  });

  it("honors a non-default locale", () => {
    const formatted = formatMoney({
      amountCents: 100000,
      currency: "USD",
      locale: "de-DE",
    });

    expect(formatted.replace(/\s/g, " ")).toMatch(/1\.000,00\s\$/);
  });
});
