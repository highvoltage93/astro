import type { Metadata } from "next";
import { ZoriaShell } from "@/components/zoria-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZORIA ASTROPROCESSOR",
  description: "Web astrology workspace for natal charts, interpretations, and forecasting."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="dark">
      <body><ZoriaShell>{children}</ZoriaShell></body>
    </html>
  );
}
