import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/HeaderFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CYC Survey Platform",
  description: "Share your voice. Empower Canadian youth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ zoom: 0.85 }}>
      <body className={`${inter.className} min-h-[100dvh] w-screen flex flex-col overflow-x-hidden`}>
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col relative pb-10">
          {children}
        </main>
        {/* We can hide footer on survey page if it takes too much space, or make it very compact. Let's make it compact. */}
      </body>
    </html>
  );
}
