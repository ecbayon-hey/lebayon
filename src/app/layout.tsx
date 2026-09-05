import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "LeBayon — Klarna Network Expert", description: "A focused AI companion for Klarna Network Solution & Delivery.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
