import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Resort 360",
  description: "AI-powered resort operations, guest experience & revenue intelligence",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-page text-ink font-sans">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <MobileNav />
            <main className="flex-1 min-w-0 px-4 py-6 md:px-10 md:py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
