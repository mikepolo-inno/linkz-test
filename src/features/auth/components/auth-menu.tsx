"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type AuthMenuProps = {
  email?: string | null;
};

export function AuthMenu({ email }: AuthMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!email) {
    return (
      <Link
        href="/login"
        className="focus-ring inline-flex h-10 items-center rounded-full bg-muted px-4 text-sm font-semibold transition-colors hover:bg-muted/70"
      >
        Sign in
      </Link>
    );
  }

  function handleSignOut() {
    startTransition(async () => {
      await signOut({ redirect: false });
      toast.success("Signed out");
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline" title={email}>
        {email}
      </span>
      <Button variant="secondary" size="sm" onClick={handleSignOut} loading={isPending}>
        Sign out
      </Button>
    </div>
  );
}
