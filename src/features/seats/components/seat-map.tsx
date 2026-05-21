"use client";

import { CheckCircle2, Lock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createPaymentAction } from "@/features/payments/actions";
import { PAYMENT_AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/features/payments/config";
import type { SeatView } from "@/features/seats/queries";
import { cn } from "@/lib/cn";
import { SeatStatus } from "@/lib/enums";
import { formatMoney } from "@/lib/money";

type SeatMapProps = {
  isAuthenticated: boolean;
  seats: SeatView[];
};

export function SeatMap({ isAuthenticated, seats }: SeatMapProps) {
  const router = useRouter();
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSeat = useMemo(
    () => seats.find((seat) => seat.id === selectedSeatId) ?? null,
    [seats, selectedSeatId],
  );

  const availableCount = seats.filter((seat) => seat.status === SeatStatus.AVAILABLE)
    .length;

  const price = formatMoney({
    amountCents: PAYMENT_AMOUNT_CENTS,
    currency: PAYMENT_CURRENCY,
  });

  function selectSeat(seat: SeatView) {
    if (seat.status !== SeatStatus.AVAILABLE) return;
    setSelectedSeatId((current) => (current === seat.id ? null : seat.id));
  }

  function proceed() {
    if (!selectedSeat) return;

    if (!isAuthenticated) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(`/?seatId=${selectedSeat.id}`)}`,
      );
      return;
    }

    startTransition(async () => {
      const result = await createPaymentAction({ seatId: selectedSeat.id });

      if (!result.ok) {
        toast.error("Could not start payment", { description: result.message });
        if (result.code === "seat_unavailable") {
          setSelectedSeatId(null);
          router.refresh();
        }
        return;
      }

      router.push(`/payment/${result.value.paymentId}`);
    });
  }

  return (
    <section aria-label="Seat selection" className="grid gap-8">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col items-center gap-2 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent px-6 pb-8 pt-10 text-center">
          <Badge tone="info" className="uppercase tracking-widest">
            Stage
          </Badge>
          <div className="relative mt-4 h-16 w-full max-w-md">
            <div className="absolute inset-x-0 top-4 h-1 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
            <div className="absolute inset-x-12 top-1 h-2 rounded-[100%] bg-gradient-to-b from-primary/80 to-primary/30 blur-sm" />
            <p className="absolute inset-x-0 top-8 text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              You face this way
            </p>
          </div>
        </div>

        <div className="grid gap-4 px-6 pb-6 sm:grid-cols-3 sm:gap-6">
          {seats.map((seat) => (
            <SeatTile
              key={seat.id}
              seat={seat}
              isSelected={selectedSeat?.id === seat.id}
              onSelect={() => selectSeat(seat)}
            />
          ))}
        </div>

        <Legend />
      </Card>

      <SelectionPanel
        availableCount={availableCount}
        isAuthenticated={isAuthenticated}
        isPending={isPending}
        onProceed={proceed}
        price={price}
        selectedSeat={selectedSeat}
      />
    </section>
  );
}

type SeatTileProps = {
  seat: SeatView;
  isSelected: boolean;
  onSelect: () => void;
};

function SeatTile({ seat, isSelected, onSelect }: SeatTileProps) {
  const isAvailable = seat.status === SeatStatus.AVAILABLE;
  const isMine = seat.reservedByCurrentUser;

  const status: { tone: "success" | "danger" | "info"; label: string } = isMine
    ? { tone: "info", label: "Reserved by you" }
    : isAvailable
      ? { tone: "success", label: "Available" }
      : { tone: "danger", label: "Reserved" };

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isAvailable}
      aria-pressed={isSelected}
      aria-label={`Seat ${seat.label}, ${status.label}`}
      className={cn(
        "focus-ring group relative flex flex-col items-start justify-between gap-4 rounded-2xl border-2 p-5 text-left transition-[transform,border-color,background-color,box-shadow] duration-200",
        "min-h-[160px]",
        isAvailable
          ? "border-border bg-panel hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-panel"
          : "cursor-not-allowed border-dashed border-border bg-muted/40 opacity-80",
        isSelected && "border-primary bg-primary/5 shadow-glow",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-3xl font-black tracking-tight">{seat.label}</span>
        <Badge tone={status.tone}>
          {isAvailable ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          {status.label}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        {isMine
          ? "This is your seat. See you at the show."
          : isAvailable
            ? "Tap to select. Reserved after successful payment."
            : "Another guest has this one."}
      </p>

      <span
        className={cn(
          "pointer-events-none absolute inset-x-5 bottom-3 h-0.5 origin-left scale-x-0 rounded-full bg-primary transition-transform duration-200",
          isSelected && "scale-x-100",
        )}
      />
    </button>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-muted/20 px-6 py-4 text-xs font-medium text-muted-foreground">
      <li className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success" />
        Available
      </li>
      <li className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary" />
        Selected
      </li>
      <li className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-danger" />
        Reserved
      </li>
    </ul>
  );
}

type SelectionPanelProps = {
  availableCount: number;
  isAuthenticated: boolean;
  isPending: boolean;
  onProceed: () => void;
  price: string;
  selectedSeat: SeatView | null;
};

function SelectionPanel({
  availableCount,
  isAuthenticated,
  isPending,
  onProceed,
  price,
  selectedSeat,
}: SelectionPanelProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between",
        selectedSeat && "ring-1 ring-primary/30",
      )}
    >
      <div className="grid gap-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {selectedSeat ? "Selected seat" : "No seat selected"}
        </div>
        <p className="text-lg font-semibold">
          {selectedSeat ? (
            <>
              Seat <span className="text-primary">{selectedSeat.label}</span> — {price}
            </>
          ) : (
            <span className="text-muted-foreground">
              {availableCount === 0
                ? "All seats are reserved right now."
                : `Pick one of ${availableCount} available seat${availableCount === 1 ? "" : "s"} above.`}
            </span>
          )}
        </p>
      </div>

      <Button
        size="lg"
        onClick={onProceed}
        disabled={!selectedSeat}
        loading={isPending}
      >
        {!isAuthenticated && selectedSeat
          ? "Sign in to reserve"
          : isPending
            ? "Starting checkout..."
            : "Proceed to payment"}
      </Button>
    </Card>
  );
}
