import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSession } from "@/features/auth/session";

export const metadata = {
  title: "Sign in — Linkz Seats",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) redirect("/");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-md gap-6">
        <Link
          href="/"
          className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to seats
        </Link>
        <div className="grid gap-2">
          <h1 className="text-3xl font-black tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to select a seat and proceed to the mock payment flow.
          </p>
        </div>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/40" />}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
