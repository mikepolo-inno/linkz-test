import Link from "next/link";

import { AuthMenu } from "@/features/auth/components/auth-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type SiteHeaderProps = {
  email?: string | null;
};

export function SiteHeader({ email }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 py-2">
      <Link
        href="/"
        className="focus-ring inline-flex items-center gap-2 rounded-full text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          ◎
        </span>
        Linkz Seats
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <AuthMenu email={email} />
      </div>
    </header>
  );
}
