"use client";

import { SignInButton, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type AuthMenuProps = {
  email?: string | null;
};

export function AuthMenu({ email }: AuthMenuProps) {
  if (!email) {
    return (
      <SignInButton mode="redirect" forceRedirectUrl="/">
        <Link
          href="/login"
          className="focus-ring inline-flex h-10 items-center rounded-full bg-muted px-4 text-sm font-semibold transition-colors hover:bg-muted/70"
        >
          Sign in
        </Link>
      </SignInButton>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline" title={email}>
        {email}
      </span>
      <SignOutButton redirectUrl="/">
        <Button variant="secondary" size="sm">
          Sign out
        </Button>
      </SignOutButton>
    </div>
  );
}
