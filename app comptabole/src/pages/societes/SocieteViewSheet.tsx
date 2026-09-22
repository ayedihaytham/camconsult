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

            <LedgerSheet>
              <div className="grid grid-cols-2">
                <InfoTile
                  icon={Hash}
                  label="RNE"
                  value={societe.rne}
                  className="border-b border-r border-border"
                />
                <InfoTile
                  icon={Receipt}
                  label="N° TVA"
                  value={societe.tva}
                  className="border-b border-border"
                />
                <InfoTile
                  icon={Phone}
                  label="Téléphone"
                  value={societe.telephone || "—"}
                  href={societe.telephone ? `tel:${societe.telephone}` : undefined}
                  className="border-b border-r border-border"
                />
                <InfoTile
                  icon={Calendar}
                  label="Créée le"
                  value={formatDate(societe.creeLe)}
                  className="border-b border-border"
                />
                <InfoTile
                  icon={Mail}
                  label="Email"
                  value={societe.email || "—"}
                  href={societe.email ? `mailto:${societe.email}` : undefined}
                  className="col-span-2 border-b border-border"
                />
                <InfoTile
                  icon={MapPin}
                  label="Adresse"
                  value={societe.adresse || "—"}
                  className="col-span-2"
                />
              </div>
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

function InfoTile({
  icon: Icon,
  label,
  value,
  href,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-3", className)}>
      <dt className="flex items-center gap-1.5 text-[0.67rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-foreground">
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
