import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DetailRow } from "@/components/ledger/DetailSheetRow";
import { StatutDot } from "@/components/ledger/StatusDot";
import { THEME_ICON } from "@/lib/societeTheme";
import { formatDate } from "@/lib/utils";
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
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Fiche société</SheetTitle>
        </SheetHeader>
        {societe && (
          <SheetBody className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-lg font-bold text-primary">
                {ThemeIcon ? <ThemeIcon className="h-7 w-7" aria-hidden /> : societe.raisonSociale[0]}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-serif text-3xl font-medium leading-tight text-primary">
                  {societe.raisonSociale}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-base">
                  <span className="text-muted-foreground">{societe.theme}</span>
                  <StatutDot statut={societe.statut} />
                </div>
              </div>
            </div>

            <dl className="divide-y divide-accent/25 overflow-hidden rounded-xl border border-accent/30 bg-card">
              <DetailRow label="Code" value={societe.code} />
              <DetailRow label="RNE" value={societe.rne || "—"} />
              <DetailRow label="N° TVA" value={societe.tva || "—"} />
              <DetailRow
                label="Téléphone"
                value={societe.telephone || "—"}
                href={societe.telephone ? `tel:${societe.telephone}` : undefined}
              />
              <DetailRow
                label="Email"
                value={societe.email || "—"}
                href={societe.email ? `mailto:${societe.email}` : undefined}
              />
              <DetailRow label="Adresse" value={societe.adresse || "—"} />
              <DetailRow label="Créée le" value={formatDate(societe.creeLe)} />
            </dl>

            {isAdmin && (
              <div className="rounded-2xl border border-accent/30 bg-card p-5">
                <SocieteEmployesSection societeId={societe.id} />
              </div>
            )}
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}
