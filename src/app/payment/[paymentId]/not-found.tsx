import Link from "next/link";

import { Card } from "@/components/ui/card";

export default function PaymentNotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Payment unavailable
        </p>
        <h2 className="mt-2 text-xl font-bold">We could not find that payment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The payment may have expired, been completed already, or belongs to a different
          account.
        </p>
        <Link
          href="/"
          className="focus-ring mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Back to seats
        </Link>
      </Card>
    </main>
  );
}
