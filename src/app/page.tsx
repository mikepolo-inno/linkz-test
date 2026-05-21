import { Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/features/auth/session";
import { SeatMap } from "@/features/seats/components/seat-map";
import { listSeats } from "@/features/seats/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const seats = await listSeats(session?.user?.id ?? null);

  const userReservation = seats.find((seat) => seat.reservedByCurrentUser);

  return (
    <>
      <SiteHeader email={session?.user?.email} />

      <main className="grid gap-10">
        <section className="grid gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Public reservation demo
          </span>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Reserve your seat in <span className="text-primary">seconds</span>.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Browse availability publicly, sign in to pick a seat, and finish a
            mock checkout. The seat moves to reserved only after a payment
            actually succeeds.
          </p>
          {userReservation ? (
            <p className="w-fit rounded-full bg-success/10 px-4 py-2 text-sm font-semibold text-success">
              You currently hold seat {userReservation.label}.
            </p>
          ) : null}
        </section>

        <SeatMap
          isAuthenticated={Boolean(session?.user)}
          seats={seats}
        />
      </main>

      <footer className="mt-auto pt-10 text-xs text-muted-foreground">
        Built with Next.js App Router, Server Components, Server Actions and Prisma.
      </footer>
    </>
  );
}
