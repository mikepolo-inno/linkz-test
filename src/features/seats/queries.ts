import type { PrismaClient } from "@prisma/client";

import { isSeatStatus, SeatStatus } from "@/lib/enums";

export type SeatView = {
  id: string;
  label: string;
  status: SeatStatus;
  reservedByCurrentUser: boolean;
};

type ListSeatsArgs = {
  prisma: PrismaClient;
  currentUserId: string | null;
};

/**
 * Loads every seat ordered by label and flags rows reserved by the current
 * user so the UI can render a personalised state without leaking other users'
 * identities.
 *
 * The Prisma client is injected so the function stays trivially testable and
 * matches the convention used by the payments domain.
 */
export async function listSeats({
  prisma,
  currentUserId,
}: ListSeatsArgs): Promise<SeatView[]> {
  const rows = await prisma.seat.findMany({
    orderBy: { label: "asc" },
    select: {
      id: true,
      label: true,
      status: true,
      reservedByUserId: true,
    },
  });

  return rows.map((seat) => ({
    id: seat.id,
    label: seat.label,
    status: isSeatStatus(seat.status) ? seat.status : SeatStatus.AVAILABLE,
    reservedByCurrentUser:
      Boolean(currentUserId) && seat.reservedByUserId === currentUserId,
  }));
}
