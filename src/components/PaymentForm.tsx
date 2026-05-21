"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PaymentFormProps = {
  paymentId: string;
};

type CompletionPayload = {
  error?: string;
  reason?: string;
  seatLabel?: string;
  status?: "reserved" | "already_reserved" | "failed";
};

export function PaymentForm({ paymentId }: PaymentFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function complete(outcome: "success" | "failure") {
    setIsSubmitting(true);
    setMessage(null);
    setMessageType(null);

    const response = await fetch(`/api/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ outcome }),
    });

    const payload = (await response.json()) as CompletionPayload;
    setIsSubmitting(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to complete payment.");
      setMessageType("error");
      router.refresh();
      return;
    }

    if (payload.status === "failed") {
      setMessage(payload.reason ?? "Payment failed. The seat remains available.");
      setMessageType("error");
      router.refresh();
      return;
    }

    setMessage(
      payload.status === "already_reserved"
        ? `Seat ${payload.seatLabel} was already reserved for this payment.`
        : `Payment succeeded. Seat ${payload.seatLabel} is reserved.`,
    );
    setMessageType("success");
    router.refresh();
  }

  return (
    <div>
      {message ? <p className={messageType ?? undefined}>{message}</p> : null}
      <div className="payment-actions">
        <button disabled={isSubmitting} onClick={() => complete("success")} type="button">
          {isSubmitting ? "Processing..." : "Mock successful payment"}
        </button>
        <button
          className="secondary"
          disabled={isSubmitting}
          onClick={() => complete("failure")}
          type="button"
        >
          Mock failed payment
        </button>
        <a className="button secondary" href="/">
          Back to seats
        </a>
      </div>
    </div>
  );
}
