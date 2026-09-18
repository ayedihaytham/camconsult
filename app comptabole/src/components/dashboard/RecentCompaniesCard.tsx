import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { Societe } from "@/types";

interface RecentCompaniesCardProps {
  societes: Societe[];
  onOpenSocietes: () => void;
}

const STATUS_VARIANT = {
  actif: "success",
  inactif: "muted",
  en_attente: "warning",
} as const;

const STATUS_LABEL = {
  actif: "Actif",
  inactif: "Inactif",
  en_attente: "En attente",
} as const;

export function RecentCompaniesCard({ societes, onOpenSocietes }: RecentCompaniesCardProps) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <CardTitle>Dernières sociétés ajoutées</CardTitle>
          <CardDescription className="mt-1">Les ajouts les plus récents du cabinet</CardDescription>
        </div>
        <Button variant="link" size="sm" onClick={onOpenSocietes} className="h-auto self-start px-0 sm:shrink-0">
          Voir toutes les sociétés
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 p-4 pt-0">
        {societes.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            Aucune société enregistrée.
          </div>
        ) : (
          <>
          <div className="md:hidden">
            <ul className="divide-y divide-border">
              {societes.map((societe) => (
                <li key={societe.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{societe.raisonSociale}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{societe.code}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[societe.statut]} className="shrink-0">{STATUS_LABEL[societe.statut]}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Ajoutée le {formatDate(societe.creeLe)}</p>
                </li>
              ))}
            </ul>
          </div>
          <Table className="hidden md:block">
            <TableHeader>
              <TableRow>
                <TableHead>Société</TableHead>
                <TableHead className="hidden sm:table-cell">Référence</TableHead>
                <TableHead className="hidden md:table-cell">Ajoutée le</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {societes.map((societe) => (
                <TableRow key={societe.id} className="hover:bg-transparent">
                  <TableCell className="max-w-0">
                    <span className="block truncate font-medium text-foreground">{societe.raisonSociale}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                      {societe.code} · {formatDate(societe.creeLe)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {societe.code}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDate(societe.creeLe)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={STATUS_VARIANT[societe.statut]}>{STATUS_LABEL[societe.statut]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
