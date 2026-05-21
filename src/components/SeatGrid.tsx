"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Seat = {
  id: string;
  label: string;
  status: string;
  reservedByUserId: string | null;
};

type SeatGridProps = {
  isAuthenticated: boolean;
  seats: Seat[];
};

export function SeatGrid({ isAuthenticated, seats }: SeatGridProps) {
  const router = useRouter();
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleProceed() {
    if (!selectedSeatId) {
      return;
    }

    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/?seatId=${selectedSeatId}`);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ seatId: selectedSeatId }),
    });

    const payload = (await response.json()) as { paymentId?: string; error?: string };
    setIsSubmitting(false);

    if (!response.ok || !payload.paymentId) {
      setError(payload.error ?? "Unable to start payment.");
      router.refresh();
      return;
    }

    router.push(`/payment/${payload.paymentId}`);
  }

  return (
    <>
      <div className="seat-grid">
        {seats.map((seat) => {
          const isAvailable = seat.status === "AVAILABLE";
          const isSelected = selectedSeatId === seat.id;

          return (
            <article className="panel seat-card" key={seat.id}>
              <div>
                <span className="seat-label">{seat.label}</span>
                <p className={`status ${isAvailable ? "available" : "reserved"}`}>
                  {isAvailable ? "Available" : "Reserved"}
                </p>
              </div>
              <p className="muted">
                {isAvailable
                  ? "Reserve this seat after completing mock payment."
                  : "This seat has already been reserved."}
              </p>
              <button
                className={isSelected ? "secondary" : undefined}
                disabled={!isAvailable}
                onClick={() => setSelectedSeatId(seat.id)}
                type="button"
              >
                {isSelected ? "Selected" : isAvailable ? "Select seat" : "Reserved"}
              </button>
            </article>
          );
        })}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="payment-actions">
        <button disabled={!selectedSeatId || isSubmitting} onClick={handleProceed} type="button">
          {isAuthenticated ? "Proceed to payment" : "Login to reserve"}
        </button>
      </div>
    </>
  );
}
