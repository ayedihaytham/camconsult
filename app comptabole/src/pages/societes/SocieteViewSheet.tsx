import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
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
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border text-sm font-bold text-foreground">
                {ThemeIcon ? <ThemeIcon className="h-5 w-5 text-muted-foreground" aria-hidden /> : societe.raisonSociale[0]}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">
                  {societe.raisonSociale}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{societe.theme}</span>
                  <StatutDot statut={societe.statut} />
                </div>
              </div>
            </div>

            <dl className="divide-y divide-border rounded-sm border border-border">
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
