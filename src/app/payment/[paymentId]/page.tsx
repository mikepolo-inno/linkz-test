import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/features/auth/session";
import { CheckoutPanel } from "@/features/payments/components/checkout-panel";
import { PAYMENT_AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/features/payments/config";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout — Linkz Seats",
};

type PaymentPageProps = {
  params: { paymentId: string };
};

export default async function PaymentPage({ params }: PaymentPageProps) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/payment/${params.paymentId}`);
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: { seat: true },
  });

  if (!payment || payment.userId !== session.user.id) {
    notFound();
  }

  const price = formatMoney({
    amountCents: PAYMENT_AMOUNT_CENTS,
    currency: PAYMENT_CURRENCY,
  });

  return (
    <>
      <SiteHeader email={session.user.email} />

      <main className="mx-auto grid w-full max-w-xl gap-6">
        <Link
          href="/"
          className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to seats
        </Link>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Mock checkout
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Complete payment</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seat <strong>{payment.seat.label}</strong> will only be reserved after a
            successful payment completion.
          </p>

          <div className="mt-6">
            <CheckoutPanel
              paymentId={payment.id}
              seatLabel={payment.seat.label}
              price={price}
              initialStatus={payment.status}
            />
          </div>
        </Card>
      </main>
    </>
  );
}
