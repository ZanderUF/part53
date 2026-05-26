import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "10 CFR Requirements Tracker",
  description:
    "Decompose, navigate, and track requirements from 10 CFR Parts 53 & 57 (NRC advanced reactor and microreactor frameworks).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-6">
            <Link href="/" className="font-semibold text-ink">
              10 CFR Tracker
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/requirements" className="hover:text-accent">
                Requirements
              </Link>
              <Link href="/graph" className="hover:text-accent">
                Cross-ref graph
              </Link>
              <Link href="/glossary" className="hover:text-accent">
                Glossary
              </Link>
              <Link href="/notes" className="hover:text-accent">
                Notes
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-slate-500">
            Source: Federal Register (federalregister.gov). This tool is not affiliated with the U.S. NRC.
          </div>
        </footer>
      </body>
    </html>
  );
}
