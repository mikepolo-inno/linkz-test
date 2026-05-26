import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PAYMENT_AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/features/payments/config";
import { createPaymentIntent } from "@/features/payments/create-payment-intent";
import { PaymentStatus, SeatStatus } from "@/lib/enums";

const prisma = new PrismaClient();

async function reset() {
  await prisma.paymentEvent.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(email = "buyer@example.com") {
  return prisma.user.create({
    data: { clerkUserId: `clerk_${email}`, email, name: email },
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
      idempotencyKey: randomUUID(),
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
      idempotencyKey: randomUUID(),
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
      idempotencyKey: randomUUID(),
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

    const lock = await prisma.seatLock.findUniqueOrThrow({
      where: { paymentId: payment.id },
    });
    expect(lock.expiresAt).toBeInstanceOf(Date);
  });

  it("locks the seat while checkout is pending", async () => {
    const user = await createUser();
    const seat = await prisma.seat.create({ data: { label: "A1" } });

    await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey: randomUUID(),
    });

    const after = await prisma.seat.findUniqueOrThrow({ where: { id: seat.id } });
    expect(after.status).toBe(SeatStatus.AVAILABLE);
    expect(after.lockedByUserId).toBe(user.id);
    expect(after.lockPaymentId).toBeTruthy();
    expect(after.lockExpiresAt).toBeInstanceOf(Date);
  });

  it("rejects another buyer while the seat is locked", async () => {
    const first = await createUser("first@example.com");
    const second = await createUser("second@example.com");
    const seat = await prisma.seat.create({ data: { label: "A1" } });

    const a = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: first.id,
      idempotencyKey: randomUUID(),
    });
    const b = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: second.id,
      idempotencyKey: randomUUID(),
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
    if (b.ok) throw new Error("second payment should not be created");
    expect(b.code).toBe("seat_locked");

    const pendings = await prisma.payment.findMany({
      where: { seatId: seat.id, status: PaymentStatus.PENDING },
    });
    expect(pendings).toHaveLength(1);
  });

  it("returns the existing pending payment for the same user lock", async () => {
    const user = await createUser();
    const seat = await prisma.seat.create({ data: { label: "A1" } });

    const first = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey: randomUUID(),
    });
    const second = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey: randomUUID(),
    });

    if (!first.ok || !second.ok) throw new Error("both should succeed");

    expect(second.value.paymentId).toBe(first.value.paymentId);
  });

  it("uses a client-provided idempotency key to recover the same checkout", async () => {
    const user = await createUser();
    const seat = await prisma.seat.create({ data: { label: "A1" } });
    const idempotencyKey = randomUUID();

    const first = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey,
    });
    const retry = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey,
    });

    if (!first.ok || !retry.ok) throw new Error("retry should succeed");
    expect(retry.value.paymentId).toBe(first.value.paymentId);
    await expect(prisma.payment.count()).resolves.toBe(1);
  });

  it("expires abandoned pending checkouts before creating a new lock", async () => {
    const first = await createUser("first@example.com");
    const second = await createUser("second@example.com");
    const seat = await prisma.seat.create({ data: { label: "A1" } });
    const firstIntent = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: first.id,
      idempotencyKey: randomUUID(),
    });
    if (!firstIntent.ok) throw new Error("first intent should succeed");

    const expiredAt = new Date(Date.now() - 60_000);
    await prisma.seat.update({
      where: { id: seat.id },
      data: { lockExpiresAt: expiredAt },
    });
    await prisma.seatLock.update({
      where: { paymentId: firstIntent.value.paymentId },
      data: { expiresAt: expiredAt },
    });

    const secondIntent = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: second.id,
      idempotencyKey: randomUUID(),
    });

    expect(secondIntent.ok).toBe(true);
    const expiredPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: firstIntent.value.paymentId },
    });
    expect(expiredPayment.status).toBe(PaymentStatus.FAILED);
    expect(expiredPayment.failureReason).toMatch(/checkout session expired/i);
  });
});
