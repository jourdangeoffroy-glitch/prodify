import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRODIFY",
  description: "Centralisation et analyse des feedbacks utilisateurs — prototype",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        <header className="border-b border-neutral-200">
          <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
            <span className="font-bold text-ol-blue text-lg">PRODIFY</span>
            <Link href="/feedbacks" className="text-sm hover:text-ol-blue">
              Feedbacks
            </Link>
            <Link href="/resumes" className="text-sm hover:text-ol-blue">
              Résumés
            </Link>
            <Link href="/reglages" className="text-sm hover:text-ol-blue ml-auto">
              Réglages
            </Link>
          </nav>
        </header>
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
