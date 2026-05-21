import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Seat Reservation Platform",
  description: "A small public seat reservation platform with mock payments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
