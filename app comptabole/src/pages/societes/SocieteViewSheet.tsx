import {
  Calendar,
  Hash,
  Mail,
  MapPin,
  Phone,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { StatutDot } from "@/components/ledger/StatusDot";
import { THEME_ACCENT, THEME_ICON } from "@/lib/societeTheme";
import { cn, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import type { Societe } from "@/types";
import { SocieteEmployesSection } from "./SocieteEmployesSection";

export function SocieteViewSheet({
  open,
  onOpenChange,
  societe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societe: Societe | null;
}) {
  const { isAdmin } = usePermissions();
  const ThemeIcon = societe ? THEME_ICON[societe.theme] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Fiche société</SheetTitle>
        </SheetHeader>
        {societe && (
          <SheetBody className="space-y-5">
            <div className="flex items-start gap-3">
              {ThemeIcon && (
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    THEME_ACCENT[societe.theme],
                  )}
                  aria-hidden
                >
                  <ThemeIcon className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="truncate text-lg font-semibold leading-tight text-foreground">
                  {societe.raisonSociale}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span>{societe.theme}</span>
                  <span aria-hidden>·</span>
                  <span className="font-mono text-xs tabular-nums">
                    {societe.code}
                  </span>
                </div>
              </div>
              <StatutDot
                statut={societe.statut}
                pill
                pulse={societe.statut === "actif"}
              />
            </div>

            <LedgerSheet className="divide-y divide-border">
              <InfoRow icon={Hash} label="RNE" value={societe.rne} />
              <InfoRow icon={Receipt} label="N° TVA" value={societe.tva} />
              <InfoRow
                icon={Phone}
                label="Téléphone"
                value={societe.telephone || "—"}
                href={societe.telephone ? `tel:${societe.telephone}` : undefined}
              />
              <InfoRow
                icon={Mail}
                label="Email"
                value={societe.email || "—"}
                href={societe.email ? `mailto:${societe.email}` : undefined}
              />
              <InfoRow
                icon={MapPin}
                label="Adresse"
                value={societe.adresse || "—"}
              />
              <InfoRow
                icon={Calendar}
                label="Créée le"
                value={formatDate(societe.creeLe)}
              />
            </LedgerSheet>

            {isAdmin && (
              <LedgerSheet className="p-4">
                <SocieteEmployesSection societeId={societe.id} />
              </LedgerSheet>
            )}
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <dt className="w-24 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {href ? (
          <a className="underline-offset-4 hover:underline" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
