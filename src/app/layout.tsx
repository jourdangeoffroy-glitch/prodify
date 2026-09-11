import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRODIFY — Feedback Analytics",
  description: "Centralisation et analyse des feedbacks utilisateurs — prototype",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-10 py-8 max-w-6xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
