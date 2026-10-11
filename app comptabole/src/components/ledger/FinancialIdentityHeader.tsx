import type { ReactNode } from "react";
import { LedgerCompactHeader } from "./LedgerCompactHeader";

interface FinancialIdentityHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  monogram?: string;
  details?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
  variant?: "default" | "dossier";
  /** Étiquette courte affichée dans le badge navy de la variante « dossier »
   * (ex. « Dossier financier », « Dossier devise », « Dossier client »).
   * Par défaut le texte de `eyebrow`. */
  badge?: string;
  className?: string;
  tourTarget?: string;
}

/** Compact navy identity surface shared by financial-style register/dossier
 * pages — États financiers, Suivi client devise, État client. */
export function FinancialIdentityHeader({
  eyebrow,
  title,
  description,
  details = [],
  actions,
  badge,
  className,
  tourTarget,
}: FinancialIdentityHeaderProps) {
  return (
    <LedgerCompactHeader
      titleAs="h2"
      tourTarget={tourTarget}
      className={className}
      eyebrow={badge ?? eyebrow}
      title={title}
      description={description}
      actions={actions}
      metrics={details.map(({ label, value }) => ({ label, value: value || "—", kind: "detail" }))}
    />
  );
}
