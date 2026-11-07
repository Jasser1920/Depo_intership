import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internship Hunter",
  description: "Personal internship search, cover letters and Gmail sending",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-white">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">🎯 Internship Hunter</Link>
            <Link href="/" className="text-muted hover:text-ink">Tracker</Link>
            <Link href="/jobs" className="text-muted hover:text-ink">Opportunities</Link>
            <Link href="/companies" className="text-muted hover:text-ink">Companies</Link>
            <Link href="/new" className="text-muted hover:text-ink">New application</Link>
            <Link href="/analytics" className="text-muted hover:text-ink">Analytics</Link>
            <Link href="/settings" className="ml-auto text-muted hover:text-ink">Settings</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
