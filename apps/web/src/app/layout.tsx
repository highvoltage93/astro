import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astroprocessor",
  description: "Web astrology workspace for natal charts, interpretations, and forecasting."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}

