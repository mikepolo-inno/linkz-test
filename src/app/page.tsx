import { AuthButton } from "@/components/AuthButton";
import { SeatGrid } from "@/components/SeatGrid";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, seats] = await Promise.all([
    getSession(),
    prisma.seat.findMany({
      orderBy: { label: "asc" },
      select: {
        id: true,
        label: true,
        status: true,
        reservedByUserId: true,
      },
    }),
  ]);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Public reservation demo</p>
          <h1>Reserve one of three seats.</h1>
          <p className="muted">
            Browse availability publicly, then log in and complete the mock
            payment before a seat is reserved.
          </p>
        </div>
        <AuthButton email={session?.user?.email} />
      </header>
      <SeatGrid isAuthenticated={Boolean(session?.user)} seats={seats} />
    </main>
  );
}
