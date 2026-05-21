import Link from "next/link";

import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          404
        </p>
        <h2 className="mt-2 text-xl font-bold">Page not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you are looking for does not exist.
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
