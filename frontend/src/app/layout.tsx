import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { SavedWordsProvider } from "@/components/vocab/SavedWordsProvider";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SprachRaum — German AI Voice Tutor",
  description: "Ultra-low latency German AI voice tutor with adaptive memory and lip-synced avatars.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body
        style={
          {
            ["--font-display" as string]: "var(--font-fraunces)",
            ["--font-body" as string]: "var(--font-manrope)",
          } as React.CSSProperties
        }
      >
        <SavedWordsProvider>{children}</SavedWordsProvider>
      </body>
    </html>
  );
}
