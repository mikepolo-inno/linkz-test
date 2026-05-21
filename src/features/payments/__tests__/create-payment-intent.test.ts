import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  PAYMENT_AMOUNT_CENTS,
  PAYMENT_CURRENCY,
} from "@/features/payments/config";
import { createPaymentIntent } from "@/features/payments/create-payment-intent";
import { PaymentStatus, SeatStatus } from "@/lib/enums";

const prisma = new PrismaClient();

async function reset() {
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(email = "buyer@example.com") {
  return prisma.user.create({
    data: { email, name: email, passwordHash: "n/a" },
  });
}

describe("createPaymentIntent", () => {
  beforeEach(reset);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns seat_not_found for an unknown seat id", async () => {
    const user = await createUser();

    const result = await createPaymentIntent({
      prisma,
      seatId: "does-not-exist",
      userId: user.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("seat_not_found");
    }
  });

  it("returns seat_unavailable when the seat is already reserved", async () => {
    const user = await createUser();
    const seat = await prisma.seat.create({
      data: { label: "A1", status: SeatStatus.RESERVED },
    });

    const result = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("seat_unavailable");
    }
  });

  it("creates a PENDING payment with the configured amount and currency", async () => {
    const user = await createUser();
    const seat = await prisma.seat.create({ data: { label: "A1" } });

    const result = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: result.value.paymentId },
    });
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.amountCents).toBe(PAYMENT_AMOUNT_CENTS);
    expect(payment.currency).toBe(PAYMENT_CURRENCY);
    expect(payment.userId).toBe(user.id);
    expect(payment.seatId).toBe(seat.id);
  });

  it("does NOT touch the seat row when creating a payment intent", async () => {
    const user = await createUser();
    const seat = await prisma.seat.create({ data: { label: "A1" } });

    await createPaymentIntent({ prisma, seatId: seat.id, userId: user.id });

    const after = await prisma.seat.findUniqueOrThrow({ where: { id: seat.id } });
    expect(after.status).toBe(SeatStatus.AVAILABLE);
    expect(after.reservedByUserId).toBeNull();
    expect(after.reservedAt).toBeNull();
  });

  it("permits multiple concurrent PENDING intents on the same seat", async () => {
    const first = await createUser("first@example.com");
    const second = await createUser("second@example.com");
    const seat = await prisma.seat.create({ data: { label: "A1" } });

    const a = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: first.id,
    });
    const b = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: second.id,
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const pendings = await prisma.payment.findMany({
      where: { seatId: seat.id, status: PaymentStatus.PENDING },
    });
    expect(pendings).toHaveLength(2);
  });

  it("generates unique idempotency keys per intent", async () => {
    const user = await createUser();
    const seat = await prisma.seat.create({ data: { label: "A1" } });

    const first = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
    });
    const second = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
    });

    if (!first.ok || !second.ok) throw new Error("both should succeed");

    const rows = await prisma.payment.findMany({
      where: { id: { in: [first.value.paymentId, second.value.paymentId] } },
      select: { idempotencyKey: true },
    });

    const keys = new Set(rows.map((row) => row.idempotencyKey));
    expect(keys.size).toBe(2);
  });
});
