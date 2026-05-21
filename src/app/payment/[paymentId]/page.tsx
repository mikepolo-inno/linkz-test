import { notFound, redirect } from "next/navigation";

import { PaymentForm } from "@/components/PaymentForm";
import { getSession } from "@/lib/auth";
import { PAYMENT_AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/lib/payments";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PaymentPageProps = {
  params: {
    paymentId: string;
  };
};

export default async function PaymentPage({ params }: PaymentPageProps) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/payment/${params.paymentId}`);
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: {
      seat: true,
    },
  });

  if (!payment || payment.userId !== session.user.id) {
    notFound();
  }

  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: PAYMENT_CURRENCY,
  }).format(PAYMENT_AMOUNT_CENTS / 100);

  return (
    <main className="page narrow">
      <a className="back-link" href="/">Back to seats</a>
      <section className="panel">
        <p className="eyebrow">Mock checkout</p>
        <h1>Complete payment</h1>
        <p className="muted">
          Seat <strong>{payment.seat.label}</strong> will only be reserved after
          a successful payment completion.
        </p>
        <p>
          Amount: <strong>{amount}</strong>
        </p>
        <p>
          Payment status: <strong>{payment.status}</strong>
        </p>
        <PaymentForm paymentId={payment.id} />
      </section>
    </main>
  );
}
