import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatutDot } from "@/components/ledger/StatusDot";
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Fiche société</SheetTitle>
        </SheetHeader>
        {societe && (
          <SheetBody className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {societe.raisonSociale}
              </h3>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{societe.theme}</span>
                <StatutDot statut={societe.statut} />
              </div>
            </div>

            <dl className="divide-y divide-border rounded-sm border border-border">
              <Row label="Code interne" value={societe.code} />
              <Row label="RNE" value={societe.rne} />
              <Row label="N° TVA" value={societe.tva} />
              <Row label="Téléphone" value={societe.telephone || "—"} />
              <Row label="Email" value={societe.email || "—"} />
              <Row label="Adresse" value={societe.adresse || "—"} />
              <Row label="Créée le" value={formatDate(societe.creeLe)} />
            </dl>

            {isAdmin && <SocieteEmployesSection societeId={societe.id} />}
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
