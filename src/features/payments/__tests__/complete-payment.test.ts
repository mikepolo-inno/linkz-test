import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { completePaymentAndReserve } from "@/features/payments/complete-payment";
import { createPaymentIntent } from "@/features/payments/create-payment-intent";
import { PaymentStatus, SeatStatus } from "@/lib/enums";

const prisma = new PrismaClient();

async function reset() {
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.user.deleteMany();
}

async function setup() {
  const user = await prisma.user.create({
    data: {
      email: "buyer@example.com",
      name: "buyer",
      passwordHash: "n/a",
    },
  });
  const seat = await prisma.seat.create({ data: { label: "A1" } });
  const intent = await createPaymentIntent({
    prisma,
    seatId: seat.id,
    userId: user.id,
  });
  if (!intent.ok) throw new Error("seed payment intent failed");
  return { user, seat, paymentId: intent.value.paymentId };
}

describe("completePaymentAndReserve", () => {
  beforeEach(reset);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns payment_not_found for an unknown payment id", async () => {
    const user = await prisma.user.create({
      data: { email: "u@example.com", name: "u", passwordHash: "n/a" },
    });

    const result = await completePaymentAndReserve({
      prisma,
      paymentId: "does-not-exist",
      userId: user.id,
      outcome: "success",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("payment_not_found");
    }
  });

  it("marks the payment FAILED and records a reason on outcome=failure", async () => {
    const { user, paymentId } = await setup();

    const result = await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      outcome: "failure",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.kind).toBe("failed");

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(payment.failureReason).toMatch(/mock/i);
    expect(payment.completedAt).toBeInstanceOf(Date);
  });

  it("does not create a reservation when payment fails", async () => {
    const { user, seat, paymentId } = await setup();

    await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      outcome: "failure",
    });

    const reservation = await prisma.reservation.findFirst({
      where: { seatId: seat.id },
    });
    expect(reservation).toBeNull();

    const seatRow = await prisma.seat.findUniqueOrThrow({ where: { id: seat.id } });
    expect(seatRow.status).toBe(SeatStatus.AVAILABLE);
  });

  it("re-completing a previously failed payment reports it as failed without flipping state", async () => {
    const { user, paymentId } = await setup();

    await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      outcome: "failure",
    });
    const beforeRow = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    const result = await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      outcome: "success",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.kind).toBe("failed");

    const afterRow = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    expect(afterRow.status).toBe(PaymentStatus.FAILED);
    expect(afterRow.completedAt?.getTime()).toBe(beforeRow.completedAt?.getTime());
  });

  it("stamps reservedAt and reservedByUserId on a successful claim", async () => {
    const { user, seat, paymentId } = await setup();
    const before = new Date();

    const result = await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      outcome: "success",
    });

    expect(result.ok).toBe(true);
    const seatRow = await prisma.seat.findUniqueOrThrow({ where: { id: seat.id } });
    expect(seatRow.status).toBe(SeatStatus.RESERVED);
    expect(seatRow.reservedByUserId).toBe(user.id);
    expect(seatRow.reservedAt).toBeInstanceOf(Date);
    expect(seatRow.reservedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("creates exactly one reservation row linked to seat, user, and payment", async () => {
    const { user, seat, paymentId } = await setup();

    await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      outcome: "success",
    });

    const reservations = await prisma.reservation.findMany();
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({
      userId: user.id,
      seatId: seat.id,
      paymentId,
    });
  });

  it("denies completion for someone other than the payment owner", async () => {
    const { paymentId } = await setup();
    const attacker = await prisma.user.create({
      data: {
        email: "attacker@example.com",
        name: "attacker",
        passwordHash: "n/a",
      },
    });

    const result = await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: attacker.id,
      outcome: "success",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("forbidden");
    }

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });
});
