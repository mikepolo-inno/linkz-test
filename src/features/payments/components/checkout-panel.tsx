"use client";

import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { completePaymentAction } from "@/features/payments/actions";
import { cn } from "@/lib/cn";

type CheckoutPanelProps = {
  paymentId: string;
  seatLabel: string;
  price: string;
  initialStatus: string;
};

type Feedback =
  | { tone: "success"; title: string; description: string }
  | { tone: "error"; title: string; description: string }
  | null;

export function CheckoutPanel({
  paymentId,
  seatLabel,
  price,
  initialStatus,
}: CheckoutPanelProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  function complete(outcome: "success" | "failure") {
    setFeedback(null);

    startTransition(async () => {
      const result = await completePaymentAction(paymentId, { outcome });

      if (!result.ok) {
        const description = result.message;
        setFeedback({
          tone: "error",
          title: "Payment could not be processed",
          description,
        });
        toast.error("Payment could not be processed", { description });
        if (result.code === "seat_conflict") {
          setStatus("FAILED");
        }
        router.refresh();
        return;
      }

      if (result.value.kind === "failed") {
        setStatus("FAILED");
        setFeedback({
          tone: "error",
          title: "Payment failed",
          description: result.value.reason,
        });
        toast.error("Payment failed", { description: result.value.reason });
        router.refresh();
        return;
      }

      const isFresh = result.value.kind === "reserved";
      setStatus("SUCCEEDED");
      const description = isFresh
        ? `Seat ${result.value.seatLabel} is now reserved for you.`
        : `Seat ${result.value.seatLabel} was already reserved for this payment.`;

      setFeedback({
        tone: "success",
        title: isFresh ? "Payment successful" : "Seat already reserved",
        description,
      });
      toast.success(isFresh ? "Payment successful" : "Seat already reserved", {
        description,
      });
      router.refresh();
    });
  }

  const isFinalised = status === "SUCCEEDED" || status === "FAILED";

  return (
    <div className="grid gap-6">
      <dl className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
        <Row label="Seat" value={<span className="font-semibold">{seatLabel}</span>} />
        <Row label="Amount" value={<span className="font-semibold">{price}</span>} />
        <Row
          label="Status"
          value={
            <Badge tone={statusToTone(status)} className="uppercase tracking-wide">
              {status}
            </Badge>
          }
        />
      </dl>

      {feedback ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4 text-sm animate-fade-in",
            feedback.tone === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger",
          )}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="grid gap-1">
            <p className="font-semibold">{feedback.title}</p>
            <p className="text-current/80">{feedback.description}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          onClick={() => complete("success")}
          disabled={isFinalised}
          loading={isPending}
        >
          <ShieldCheck className="h-4 w-4" />
          Mock successful payment
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => complete("failure")}
          disabled={isFinalised || isPending}
        >
          Mock failed payment
        </Button>
        <Button size="lg" variant="ghost" onClick={() => router.push("/")}>
          Back to seats
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        This is a mock checkout. A real integration would redirect to a hosted
        provider, listen for signed webhooks, and confirm the reservation
        server-side after the provider settles the charge.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function statusToTone(status: string) {
  if (status === "SUCCEEDED") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  return "info" as const;
}
