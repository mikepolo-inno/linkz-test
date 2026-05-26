import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { completePaymentAndReserve } from "@/features/payments/complete-payment";
import { createPaymentIntent } from "@/features/payments/create-payment-intent";
import { PaymentStatus, SeatStatus } from "@/lib/enums";
import { seedDemoData } from "@/lib/seed";

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.paymentEvent.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(email: string) {
  return prisma.user.create({
    data: {
      clerkUserId: `clerk_${email}`,
      email,
      name: email.split("@")[0],
    },
  });
}

async function createSeat(label = "A1") {
  return prisma.seat.create({ data: { label } });
}

describe("reservation workflow", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates exactly three seeded seats", async () => {
    await seedDemoData(prisma);

    const seats = await prisma.seat.findMany({
      orderBy: { label: "asc" },
      select: { label: true, status: true },
    });

    expect(seats).toEqual([
      { label: "A1", status: SeatStatus.AVAILABLE },
      { label: "A2", status: SeatStatus.AVAILABLE },
      { label: "A3", status: SeatStatus.AVAILABLE },
    ]);
  });

  it("reserves a seat only after successful payment", async () => {
    const user = await createUser("buyer@example.com");
    const seat = await createSeat();
    const payment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey: randomUUID(),
    });

    expect(payment.ok).toBe(true);
    if (!payment.ok) throw new Error("payment should be created");

    const result = await completePaymentAndReserve({
      prisma,
      paymentId: payment.value.paymentId,
      userId: user.id,
      gatewayEventId: "evt_workflow_success",
      gatewayStatus: "succeeded",
    });

    const reservedSeat = await prisma.seat.findUniqueOrThrow({
      where: { id: seat.id },
    });
    const storedPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.value.paymentId },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected successful completion");
    expect(result.value.kind).toBe("reserved");
    expect(reservedSeat.status).toBe(SeatStatus.RESERVED);
    expect(reservedSeat.reservedByUserId).toBe(user.id);
    expect(storedPayment.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it("keeps a seat available when payment fails", async () => {
    const user = await createUser("buyer@example.com");
    const seat = await createSeat();
    const payment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey: randomUUID(),
    });
    if (!payment.ok) throw new Error("payment should be created");

    const result = await completePaymentAndReserve({
      prisma,
      paymentId: payment.value.paymentId,
      userId: user.id,
      gatewayEventId: "evt_workflow_failure",
      gatewayStatus: "failed",
      failureReason: "Mock gateway declined the payment.",
    });

    const availableSeat = await prisma.seat.findUniqueOrThrow({
      where: { id: seat.id },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.value.kind).toBe("failed");
    expect(availableSeat.status).toBe(SeatStatus.AVAILABLE);
  });

  it("rejects another user's completion attempt", async () => {
    const owner = await createUser("owner@example.com");
    const attacker = await createUser("attacker@example.com");
    const seat = await createSeat();
    const payment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: owner.id,
      idempotencyKey: randomUUID(),
    });
    if (!payment.ok) throw new Error("payment should be created");

    const result = await completePaymentAndReserve({
      prisma,
      paymentId: payment.value.paymentId,
      userId: attacker.id,
      gatewayEventId: "evt_workflow_attack",
      gatewayStatus: "succeeded",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.code).toBe("forbidden");
  });

  it("prevents a second user from reserving an already reserved seat", async () => {
    const firstUser = await createUser("first@example.com");
    const secondUser = await createUser("second@example.com");
    const seat = await createSeat();
    const firstPayment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: firstUser.id,
      idempotencyKey: randomUUID(),
    });
    if (!firstPayment.ok) throw new Error("first payment should be created");

    await completePaymentAndReserve({
      prisma,
      paymentId: firstPayment.value.paymentId,
      userId: firstUser.id,
      gatewayEventId: "evt_first_success",
      gatewayStatus: "succeeded",
    });

    const secondPayment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: secondUser.id,
      idempotencyKey: randomUUID(),
    });

    expect(secondPayment.ok).toBe(false);
    if (secondPayment.ok) throw new Error("expected conflict");
    expect(secondPayment.code).toBe("seat_unavailable");
  });

  it("treats repeated successful completion as idempotent", async () => {
    const user = await createUser("buyer@example.com");
    const seat = await createSeat();
    const payment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: user.id,
      idempotencyKey: randomUUID(),
    });
    if (!payment.ok) throw new Error("payment should be created");

    const firstResult = await completePaymentAndReserve({
      prisma,
      paymentId: payment.value.paymentId,
      userId: user.id,
      gatewayEventId: "evt_repeat_success",
      gatewayStatus: "succeeded",
    });
    const secondResult = await completePaymentAndReserve({
      prisma,
      paymentId: payment.value.paymentId,
      userId: user.id,
      gatewayEventId: "evt_repeat_success",
      gatewayStatus: "succeeded",
    });
    const reservationCount = await prisma.reservation.count();

    expect(firstResult.ok).toBe(true);
    if (!firstResult.ok) throw new Error("expected ok first");
    expect(firstResult.value.kind).toBe("reserved");

    expect(secondResult.ok).toBe(true);
    if (!secondResult.ok) throw new Error("expected ok second");
    expect(secondResult.value.kind).toBe("already_reserved");

    expect(reservationCount).toBe(1);
  });

  it("rejects a second buyer while the first checkout holds the seat", async () => {
    const firstUser = await createUser("first@example.com");
    const secondUser = await createUser("second@example.com");
    const seat = await createSeat();

    const firstPayment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: firstUser.id,
      idempotencyKey: randomUUID(),
    });
    const secondPayment = await createPaymentIntent({
      prisma,
      seatId: seat.id,
      userId: secondUser.id,
      idempotencyKey: randomUUID(),
    });

    expect(secondPayment.ok).toBe(false);
    if (secondPayment.ok) throw new Error("expected lock conflict");
    expect(secondPayment.code).toBe("seat_locked");

    const pendingPayments = await prisma.payment.count({
      where: { seatId: seat.id, status: PaymentStatus.PENDING },
    });
    expect(firstPayment.ok).toBe(true);
    expect(pendingPayments).toBe(1);
  });
});
