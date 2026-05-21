import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPaymentIntent } from "@/lib/payments";
import { completePaymentAndReserve } from "@/lib/reservations";
import { seedDemoData } from "@/lib/seed-data";
import { PaymentStatus, SeatStatus } from "@/lib/status";

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      passwordHash: "not-used-in-tests",
    },
  });
}

async function createSeat(label = "A1") {
  return prisma.seat.create({
    data: { label },
  });
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
    const payment = await createPaymentIntent(prisma, {
      seatId: seat.id,
      userId: user.id,
    });

    expect(payment.ok).toBe(true);
    if (!payment.ok) {
      throw new Error("payment should be created");
    }

    const result = await completePaymentAndReserve(prisma, {
      paymentId: payment.paymentId,
      userId: user.id,
      outcome: "success",
    });

    const reservedSeat = await prisma.seat.findUniqueOrThrow({
      where: { id: seat.id },
    });
    const storedPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.paymentId },
    });

    expect(result).toMatchObject({ ok: true, status: "reserved" });
    expect(reservedSeat.status).toBe(SeatStatus.RESERVED);
    expect(reservedSeat.reservedByUserId).toBe(user.id);
    expect(storedPayment.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it("keeps a seat available when payment fails", async () => {
    const user = await createUser("buyer@example.com");
    const seat = await createSeat();
    const payment = await createPaymentIntent(prisma, {
      seatId: seat.id,
      userId: user.id,
    });

    if (!payment.ok) {
      throw new Error("payment should be created");
    }

    const result = await completePaymentAndReserve(prisma, {
      paymentId: payment.paymentId,
      userId: user.id,
      outcome: "failure",
    });

    const availableSeat = await prisma.seat.findUniqueOrThrow({
      where: { id: seat.id },
    });

    expect(result).toMatchObject({ ok: true, status: "failed" });
    expect(availableSeat.status).toBe(SeatStatus.AVAILABLE);
  });

  it("rejects another user's completion attempt", async () => {
    const owner = await createUser("owner@example.com");
    const attacker = await createUser("attacker@example.com");
    const seat = await createSeat();
    const payment = await createPaymentIntent(prisma, {
      seatId: seat.id,
      userId: owner.id,
    });

    if (!payment.ok) {
      throw new Error("payment should be created");
    }

    const result = await completePaymentAndReserve(prisma, {
      paymentId: payment.paymentId,
      userId: attacker.id,
      outcome: "success",
    });

    expect(result).toMatchObject({ ok: false, status: "forbidden" });
  });

  it("prevents a second user from reserving an already reserved seat", async () => {
    const firstUser = await createUser("first@example.com");
    const secondUser = await createUser("second@example.com");
    const seat = await createSeat();
    const firstPayment = await createPaymentIntent(prisma, {
      seatId: seat.id,
      userId: firstUser.id,
    });

    if (!firstPayment.ok) {
      throw new Error("first payment should be created");
    }

    await completePaymentAndReserve(prisma, {
      paymentId: firstPayment.paymentId,
      userId: firstUser.id,
      outcome: "success",
    });

    const secondPayment = await createPaymentIntent(prisma, {
      seatId: seat.id,
      userId: secondUser.id,
    });

    expect(secondPayment).toMatchObject({
      ok: false,
      status: "conflict",
    });
  });

  it("treats repeated successful completion as idempotent", async () => {
    const user = await createUser("buyer@example.com");
    const seat = await createSeat();
    const payment = await createPaymentIntent(prisma, {
      seatId: seat.id,
      userId: user.id,
    });

    if (!payment.ok) {
      throw new Error("payment should be created");
    }

    const firstResult = await completePaymentAndReserve(prisma, {
      paymentId: payment.paymentId,
      userId: user.id,
      outcome: "success",
    });
    const secondResult = await completePaymentAndReserve(prisma, {
      paymentId: payment.paymentId,
      userId: user.id,
      outcome: "success",
    });
    const reservationCount = await prisma.reservation.count();

    expect(firstResult).toMatchObject({ ok: true, status: "reserved" });
    expect(secondResult).toMatchObject({ ok: true, status: "already_reserved" });
    expect(reservationCount).toBe(1);
  });
});
