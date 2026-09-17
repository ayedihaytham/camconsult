import {
  Briefcase,
  Building2,
  HeartHandshake,
  Landmark,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { SocieteTheme } from "@/types";

/** Wayfinding visuel par thème de société — chart-1..5 = catégorie, jamais
 * un statut (voir DESIGN-SYSTEM.md §1bis/§5). Source unique partagée par
 * tous les écrans qui affichent une carte ou une cellule "identité" société
 * (Sociétés, Gestion de stock…), pour rester cohérent partout. */
export const THEME_OPTIONS: SocieteTheme[] = [
  "PME",
  "Grande entreprise",
  "Association",
  "Profession libérale",
  "Auto-entrepreneur",
];

export const THEME_ACCENT: Record<SocieteTheme, string> = {
  PME: "bg-chart-1/10 text-chart-1",
  "Grande entreprise": "bg-chart-2/10 text-chart-2",
  Association: "bg-warning/12 text-warning",
  "Profession libérale": "bg-chart-4/10 text-chart-4",
  "Auto-entrepreneur": "bg-chart-5/12 text-chart-5",
};

// Même palette que THEME_ACCENT, en teinte pleine (barre de couleur pleine
// hauteur dans une table "maximaliste" plutôt qu'un badge séparé).
export const THEME_BAR: Record<SocieteTheme, string> = {
  PME: "bg-chart-1",
  "Grande entreprise": "bg-chart-2",
  Association: "bg-warning",
  "Profession libérale": "bg-chart-4",
  "Auto-entrepreneur": "bg-chart-5",
};

// Même palette, en classes de bordure `before:`/`after:` complètes (pas de
// construction dynamique de nom de classe — Tailwind ne scanne que du texte
// littéral) : utilisé par l'organigramme de Structuration pour colorer les
// traits de connexion de toute une branche selon le thème de sa société.
export const THEME_LINE: Record<SocieteTheme, string> = {
  PME: "before:border-chart-1 after:border-chart-1",
  "Grande entreprise": "before:border-chart-2 after:border-chart-2",
  Association: "before:border-warning after:border-warning",
  "Profession libérale": "before:border-chart-4 after:border-chart-4",
  "Auto-entrepreneur": "before:border-chart-5 after:border-chart-5",
};

/** Pictogramme par thème — un repère instantané en plus du nom (jamais la
 * seule information : voir DESIGN-SYSTEM.md §5). */
export const THEME_ICON: Record<SocieteTheme, LucideIcon> = {
  PME: Building2,
  "Grande entreprise": Landmark,
  Association: HeartHandshake,
  "Profession libérale": Briefcase,
  "Auto-entrepreneur": UserRound,
};
