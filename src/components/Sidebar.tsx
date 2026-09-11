"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, MessageSquare, Settings, Sparkles, Upload } from "lucide-react";

const NAV = [
  { href: "/feedbacks", label: "Feedbacks", icon: MessageSquare },
  { href: "/importer", label: "Importer", icon: Upload },
  { href: "/resumes", label: "Résumés IA", icon: Sparkles },
  { href: "/reglages", label: "Réglages", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="h-10 w-10 rounded-xl bg-ol-blue flex items-center justify-center">
          <FileText className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div>
          <p className="font-bold leading-tight">PRODIFY</p>
          <p className="text-xs text-neutral-500 leading-tight">Feedback Analytics</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-ol-blue text-white font-medium"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <p className="px-5 py-4 text-xs text-neutral-400">TechFlow — Internal Tool</p>
    </aside>
  );
}
