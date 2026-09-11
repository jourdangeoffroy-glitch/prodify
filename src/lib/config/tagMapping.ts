// Règles de mapping source -> channel_type (fonctionnalité 3).
// Fichier de config séparé de la logique métier, éditable sans redéploiement de code applicatif
// (redéploiement de config uniquement pour ce MVP — pas d'UI d'édition, hors périmètre).

export const TAG_MAPPING: Record<string, string> = {
  zendesk: "support",
  slack: "support",
  nps: "declaratif",
  g2: "declaratif",
  interview: "qualitatif",
};

export const DEFAULT_CHANNEL_TYPE = "non_classe";

export function resolveChannelType(source: string): string {
  return TAG_MAPPING[source] ?? DEFAULT_CHANNEL_TYPE;
}
