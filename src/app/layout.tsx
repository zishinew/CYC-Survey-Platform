import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header, Footer } from "@/components/layout/HeaderFooter";

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
    <html lang="en">
      <body className={`${inter.className} h-[100dvh] w-screen overflow-hidden flex flex-col`}>
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col overflow-hidden relative">
          {children}
        </main>
        {/* We can hide footer on survey page if it takes too much space, or make it very compact. Let's make it compact. */}
      </body>
    </html>
  );
}
