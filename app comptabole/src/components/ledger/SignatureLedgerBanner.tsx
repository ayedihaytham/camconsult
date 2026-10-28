import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeaderBar } from "./PageHeaderBar";

export interface SignatureLedgerMetric {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "destructive";
  loading?: boolean;
  /** Icône affichée avant le chiffre. */
  icon?: LucideIcon;
  /** Compteur-filtre cliquable. */
  onSelect?: () => void;
  active?: boolean;
}

interface SignatureLedgerBannerProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  metrics: SignatureLedgerMetric[];
  contextLabel?: string;
  action?: { label: string; onClick: () => void };
  /** Plusieurs actions libres (ex. Excel + Nouveau mouvement) à la place de `action`. */
  actions?: ReactNode;
  variant?: "registry" | "process" | "compact";
  titleId?: string;
  className?: string;
}

/**
 * En-tête commun des pages de module. Le titre est celui de la barre du haut ; la description et les boutons d'action s'y placent aussi ;
 * les chiffres forment une rangée discrète en haut de la page (voir PageHeaderBar). La page fournit ses chiffres et ses droits.
 */
export function SignatureLedgerBanner({ title, description, metrics, contextLabel, action, actions, variant = "registry", titleId, className }: SignatureLedgerBannerProps) {
  return (
    <PageHeaderBar
      className={className}
      titleId={titleId}
      title={title}
      description={[contextLabel, description].filter(Boolean).join(" · ")}
      metrics={variant === "compact" ? [] : metrics}
      actions={actions}
      action={actions ? undefined : action}
    />
  );
}
