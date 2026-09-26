import "./globals.css";
import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-ui" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Tally", template: "%s · Tally" },
  description: "Meeting notes that show their work: who owes what, and the moment they said it."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The landing splash sets a class on <html> before hydration.
  return <html lang="en" suppressHydrationWarning><body className={`${inter.variable} ${serif.variable} ${mono.variable}`}>{children}</body></html>;
}
