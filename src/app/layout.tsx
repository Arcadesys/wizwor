import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const arcadeFont = Press_Start_2P({
  variable: "--font-arcade",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Wyrmwood Terminal",
  description: "A NES-inspired wizard terminal that recommends ancient games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${arcadeFont.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
