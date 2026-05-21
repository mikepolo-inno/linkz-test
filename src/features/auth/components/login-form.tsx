"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setError("Invalid email or password.");
        toast.error("Sign in failed", {
          description: "Double-check your credentials and try again.",
        });
        return;
      }

      toast.success("Welcome back");
      router.push(result.url ?? callbackUrl);
      router.refresh();
    });
  }

  return (
    <Card>
      <form className="grid gap-5" onSubmit={submit} noValidate>
        <label className="grid gap-2 text-sm font-semibold">
          Email
          <Input
            autoComplete="email"
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Password
          <Input
            autoComplete="current-password"
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={isPending} size="lg">
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Demo credentials are prefilled for local review.
        </p>
      </form>
    </Card>
  );
}
