import { describe, expect, expectTypeOf, it } from "vitest";

import { err, ok, type Result } from "@/lib/result";

describe("Result helpers", () => {
  it("ok() builds a success variant carrying the value", () => {
    const result = ok({ id: "abc" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: "abc" });
    }
  });

  it("err() builds a failure variant with code + message", () => {
    const result = err("seat_unavailable", "Seat is taken");

    expect(result).toEqual({
      ok: false,
      code: "seat_unavailable",
      message: "Seat is taken",
      details: undefined,
    });
  });

  it("err() preserves optional structured details", () => {
    const result = err("invalid_input", "Bad payload", { field: "seatId" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details).toEqual({ field: "seatId" });
    }
  });

  it("narrows the union by the ok discriminator", () => {
    function consume(value: Result<string, "boom">): string {
      if (!value.ok) {
        expectTypeOf(value.code).toEqualTypeOf<"boom">();
        return value.message;
      }
      expectTypeOf(value.value).toEqualTypeOf<string>();
      return value.value;
    }

    expect(consume(ok("hi"))).toBe("hi");
    expect(consume(err("boom", "nope"))).toBe("nope");
  });
});
