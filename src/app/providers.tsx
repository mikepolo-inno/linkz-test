"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast:
              "rounded-2xl border border-border bg-panel text-foreground shadow-panel",
            description: "text-muted-foreground",
          },
        }}
      />
    </SessionProvider>
  );
}
