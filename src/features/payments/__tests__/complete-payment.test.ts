import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { completePaymentAndReserve } from "@/features/payments/complete-payment";
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

async function setup() {
  const user = await prisma.user.create({
    data: {
      clerkUserId: "clerk_buyer",
      email: "buyer@example.com",
      name: "buyer",
    },
  });
  const seat = await prisma.seat.create({ data: { label: "A1" } });
  const intent = await createPaymentIntent({
    prisma,
    seatId: seat.id,
    userId: user.id,
    idempotencyKey: randomUUID(),
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
      data: { clerkUserId: "clerk_u", email: "u@example.com", name: "u" },
    });

    const result = await completePaymentAndReserve({
      prisma,
      paymentId: "does-not-exist",
      userId: user.id,
      gatewayEventId: "evt_missing_success",
      gatewayStatus: "succeeded",
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
      gatewayEventId: "evt_failed",
      gatewayStatus: "failed",
      failureReason: "Mock gateway declined the payment.",
      source: "mock_gateway",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.kind).toBe("failed");

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(payment.failureReason).toMatch(/mock gateway/i);
    expect(payment.completedAt).toBeInstanceOf(Date);

    const event = await prisma.paymentEvent.findFirstOrThrow({
      where: { paymentId, type: "GATEWAY_PAYMENT_FAILED" },
    });
    expect(event.gatewayEventId).toBe("evt_failed");
  });

  it("does not create a reservation when payment fails", async () => {
    const { user, seat, paymentId } = await setup();

    await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      gatewayEventId: "evt_failed_no_reservation",
      gatewayStatus: "failed",
      failureReason: "Mock gateway declined the payment.",
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
      gatewayEventId: "evt_failed_once",
      gatewayStatus: "failed",
      failureReason: "Mock gateway declined the payment.",
    });
    const beforeRow = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    const result = await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: user.id,
      gatewayEventId: "evt_success_after_failed",
      gatewayStatus: "succeeded",
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
      gatewayEventId: "evt_success_stamp",
      gatewayStatus: "succeeded",
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
      gatewayEventId: "evt_success_reservation",
      gatewayStatus: "succeeded",
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
        clerkUserId: "clerk_attacker",
        email: "attacker@example.com",
        name: "attacker",
      },
    });

    const result = await completePaymentAndReserve({
      prisma,
      paymentId,
      userId: attacker.id,
      gatewayEventId: "evt_attacker",
      gatewayStatus: "succeeded",
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
