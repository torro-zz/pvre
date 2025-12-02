import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Fraunces } from "next/font/google";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { CrispChat } from "@/components/layout/crisp-chat";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PVRE - Pre-Validation Research Engine",
  description: "Validate your startup ideas with data-driven community insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased`}
      >
        {children}
        <CookieBanner />
        <CrispChat />
      </body>
    </html>
  );
}
