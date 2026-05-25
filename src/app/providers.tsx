"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

type ProvidersProps = {
  children: ReactNode;
};

const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  "pk_test_YnVpbGQtcGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA";

export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
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
    </ClerkProvider>
  );
}
