import type { Metadata, Viewport } from "next";

import { Providers } from "@/app/providers";
import { ThemeScript } from "@/components/theme-script";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Linkz Seats — reserve in seconds",
  description:
    "Pick a seat, pay through a mock checkout, and reserve it the moment the payment succeeds.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-5 py-6 sm:px-8 sm:py-10">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
