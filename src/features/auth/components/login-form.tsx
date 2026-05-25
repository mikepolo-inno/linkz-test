"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/card";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <Card className="flex justify-center">
      <SignIn
        routing="path"
        path="/login"
        fallbackRedirectUrl={callbackUrl}
        forceRedirectUrl={callbackUrl}
      />
    </Card>
  );
}
