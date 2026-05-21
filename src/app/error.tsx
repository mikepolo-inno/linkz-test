"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route-error", error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-md text-center">
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Unexpected error. Please try again."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/";
            }}
          >
            Back to home
          </Button>
        </div>
      </Card>
    </main>
  );
}
