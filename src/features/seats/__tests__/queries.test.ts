import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { listSeats } from "@/features/seats/queries";
import { SeatStatus } from "@/lib/enums";

const prisma = new PrismaClient();

async function reset() {
  await prisma.paymentEvent.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.user.deleteMany();
}

describe("listSeats", () => {
  beforeEach(reset);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns an empty array when no seats exist", async () => {
    const seats = await listSeats({ prisma, currentUserId: null });
    expect(seats).toEqual([]);
  });

  it("orders seats alphabetically by label", async () => {
    await prisma.seat.createMany({
      data: [{ label: "A3" }, { label: "A1" }, { label: "A2" }],
    });

    const seats = await listSeats({ prisma, currentUserId: null });

    expect(seats.map((seat) => seat.label)).toEqual(["A1", "A2", "A3"]);
  });

  it("reports every seat as AVAILABLE when freshly created", async () => {
    await prisma.seat.createMany({
      data: [{ label: "A1" }, { label: "A2" }],
    });

    const seats = await listSeats({ prisma, currentUserId: null });

    for (const seat of seats) {
      expect(seat.status).toBe(SeatStatus.AVAILABLE);
      expect(seat.reservedByCurrentUser).toBe(false);
    }
  });

  it("flags reservedByCurrentUser only for the matching reservation owner", async () => {
    const owner = await prisma.user.create({
      data: { clerkUserId: "clerk_owner", email: "owner@example.com", name: "owner" },
    });
    const seat = await prisma.seat.create({
      data: {
        label: "A1",
        status: SeatStatus.RESERVED,
        reservedByUserId: owner.id,
        reservedAt: new Date(),
      },
    });

    const ownerView = await listSeats({ prisma, currentUserId: owner.id });
    const ownerSeat = ownerView.find((row) => row.id === seat.id);
    expect(ownerSeat?.reservedByCurrentUser).toBe(true);
    expect(ownerSeat?.status).toBe(SeatStatus.RESERVED);

    const strangerView = await listSeats({
      prisma,
      currentUserId: "other-user-id",
    });
    const strangerSeat = strangerView.find((row) => row.id === seat.id);
    expect(strangerSeat?.reservedByCurrentUser).toBe(false);
    expect(strangerSeat?.status).toBe(SeatStatus.RESERVED);
  });

  it("never marks a seat as reservedByCurrentUser when the user is anonymous", async () => {
    const owner = await prisma.user.create({
      data: { clerkUserId: "clerk_u", email: "u@example.com", name: "u" },
    });
    await prisma.seat.create({
      data: {
        label: "A1",
        status: SeatStatus.RESERVED,
        reservedByUserId: owner.id,
      },
    });

    const seats = await listSeats({ prisma, currentUserId: null });

    expect(seats[0]?.reservedByCurrentUser).toBe(false);
  });

  it("falls back to AVAILABLE for an unrecognised stored status value", async () => {
    await prisma.seat.create({
      data: { label: "A1", status: "BOGUS" },
    });

    const [seat] = await listSeats({ prisma, currentUserId: null });

    expect(seat.status).toBe(SeatStatus.AVAILABLE);
  });

  it("derives LOCKED status for active seat holds", async () => {
    const owner = await prisma.user.create({
      data: {
        clerkUserId: "clerk_lock_owner",
        email: "lock-owner@example.com",
        name: "owner",
      },
    });
    await prisma.seat.create({
      data: {
        label: "A1",
        lockedByUserId: owner.id,
        lockExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    const [seat] = await listSeats({ prisma, currentUserId: owner.id });

    expect(seat.status).toBe(SeatStatus.LOCKED);
    expect(seat.lockedByCurrentUser).toBe(true);
    expect(seat.lockExpiresAt).toBeInstanceOf(Date);
  });
});
