import type { Metadata } from "next";
import { Cormorant_Garamond, Fraunces, Manrope, Pinyon_Script } from "next/font/google";
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

const script = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

const garamond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SprachRaum — German AI Voice Tutor",
  description: "Ultra-low latency German AI voice tutor with adaptive memory and lip-synced avatars.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable} ${script.variable} ${garamond.variable}`}>
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
