import { describe, expect, it } from "vitest";

import { isPaymentStatus, isSeatStatus, PaymentStatus, SeatStatus } from "@/lib/enums";

describe("seat status guard", () => {
  it("accepts the documented values", () => {
    expect(isSeatStatus(SeatStatus.AVAILABLE)).toBe(true);
    expect(isSeatStatus(SeatStatus.LOCKED)).toBe(true);
    expect(isSeatStatus(SeatStatus.RESERVED)).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isSeatStatus("")).toBe(false);
    expect(isSeatStatus("available")).toBe(false);
    expect(isSeatStatus("PENDING")).toBe(false);
  });
});

describe("payment status guard", () => {
  it("accepts all three known statuses", () => {
    expect(isPaymentStatus(PaymentStatus.PENDING)).toBe(true);
    expect(isPaymentStatus(PaymentStatus.SUCCEEDED)).toBe(true);
    expect(isPaymentStatus(PaymentStatus.FAILED)).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isPaymentStatus("succeeded")).toBe(false);
    expect(isPaymentStatus("REFUNDED")).toBe(false);
    expect(isPaymentStatus("")).toBe(false);
  });
});
