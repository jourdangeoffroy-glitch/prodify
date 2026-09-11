import Link from "next/link";

const cards = [
  {
    href: "/reglages",
    title: "Réglages",
    desc: "Configurer la clé API Gemini nécessaire à la fonctionnalité 2.",
  },
  {
    href: "/feedbacks",
    title: "Feedbacks",
    desc: "Importer un CSV de feedbacks (fonctionnalité 1) et consulter les tags automatiques (fonctionnalité 3).",
  },
  {
    href: "/resumes",
    title: "Résumés",
    desc: "Générer un résumé par LLM (Gemini) sur une période donnée (fonctionnalité 2).",
  },
];

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">PRODIFY</h1>
      <p className="text-neutral-600 mb-6">
        Prototype MVP — centralisation et analyse des feedbacks utilisateurs.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block border border-neutral-200 rounded-lg p-4 hover:border-ol-blue transition-colors"
          >
            <h2 className="font-semibold text-ol-blue mb-1">{c.title}</h2>
            <p className="text-sm text-neutral-600">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
