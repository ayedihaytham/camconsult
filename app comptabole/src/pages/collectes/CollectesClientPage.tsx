import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { collectionLabel, collectionProgress } from "@/lib/dashboard/dashboardData";
import type { Collecte, CollecteStatut } from "@/types";
import { cn, formatDate, formatRelative } from "@/lib/utils";

const STATUT: Record<CollecteStatut, { label: string; tone: string; action: string; rank: number }> = {
  a_corriger: { label: "À corriger", tone: "bg-warning/15 text-warning", action: "Reprendre", rank: 0 },
  brouillon: { label: "À compléter", tone: "bg-warning/15 text-warning", action: "Remplir", rank: 1 },
  transmis: { label: "En attente du cabinet", tone: "bg-info/15 text-info", action: "Ouvrir", rank: 2 },
  valide: { label: "Validée", tone: "bg-success/15 text-success", action: "Ouvrir", rank: 3 },
  archive: { label: "Archivée", tone: "bg-muted text-muted-foreground", action: "Ouvrir", rank: 4 },
};

/** Page Collecte de pièces du responsable de société : une carte par collecte, la société dite une seule fois dans le bandeau. */
export function CollectesClientPage({ list, loading, societeNom }: { list: Collecte[]; loading: boolean; societeNom: string | null }) {
  const [archivesOuvertes, setArchivesOuvertes] = useState(false);
  const actives = useMemo(
    () => list.filter((c) => c.statut !== "archive").sort((a, b) => STATUT[a.statut].rank - STATUT[b.statut].rank || b.majLe.localeCompare(a.majLe)),
    [list],
  );
  const archivees = useMemo(() => list.filter((c) => c.statut === "archive").sort((a, b) => b.majLe.localeCompare(a.majLe)), [list]);
  const aCompleter = actives.filter((c) => c.statut === "brouillon" || c.statut === "a_corriger").length;
  const enAttente = actives.filter((c) => c.statut === "transmis").length;
  const validees = actives.filter((c) => c.statut === "valide").length;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <SignatureLedgerBanner
        icon={ClipboardList}
        className="mb-0"
        variant="process"
        eyebrow="Clients & travail"
        title="Collecte de pièces"
        description={`${societeNom ? `${societeNom} · ` : ""}Remplissez les tableaux demandés puis transmettez-les au cabinet.`}
        metrics={[
          { label: "À compléter", value: aCompleter, tone: aCompleter > 0 ? "warning" : "default", loading },
          { label: "En attente du cabinet", value: enAttente, loading },
          { label: "Validées", value: validees, tone: validees > 0 ? "success" : "default", loading },
        ]}
      />
      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 w-full" />)}</div>
      ) : actives.length === 0 && archivees.length === 0 ? (
        <p className="rounded-md border border-border bg-card px-4 py-5 text-sm text-muted-foreground">Aucune collecte pour le moment. Le cabinet vous préviendra dès qu'il vous en envoie une.</p>
      ) : (
        <>
          {actives.length === 0 && <p className="rounded-md border border-border bg-card px-4 py-5 text-sm text-muted-foreground">Aucune collecte en cours.</p>}
          <ul className="grid gap-3" aria-label="Collectes en cours">
            {actives.map((collecte, index) => <CollecteCard key={collecte.id} collecte={collecte} mise={index === 0 && (collecte.statut === "a_corriger" || collecte.statut === "brouillon")} />)}
          </ul>
          {archivees.length > 0 && (
            <div>
              <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full" aria-expanded={archivesOuvertes} onClick={() => setArchivesOuvertes((v) => !v)}>
                {archivesOuvertes ? "Masquer" : "Voir"} les collectes archivées ({archivees.length})
              </Button>
              {archivesOuvertes && <ul className="mt-3 grid gap-3" aria-label="Collectes archivées">{archivees.map((collecte) => <CollecteCard key={collecte.id} collecte={collecte} mise={false} />)}</ul>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CollecteCard({ collecte, mise, societeNom, cabinet = false, onDelete }: {
  collecte: Collecte;
  mise: boolean;
  /** Nom de la société, affiché au cabinet (un responsable de société n'en a qu'une, déjà dite dans le bandeau). */
  societeNom?: string;
  cabinet?: boolean;
  onDelete?: (collecte: Collecte) => void;
}) {
  const navigate = useNavigate();
  const statut = STATUT[collecte.statut];
  const nom = collectionLabel(collecte);
  const progress = collectionProgress(collecte);
  const demandes = collecte.tableauxDemandes ?? 0;
  const faits = Math.round(((progress ?? 0) / 100) * demandes);
  const nbTableaux = cabinet ? collecte.onglets.length : 0;
  const aExaminer = collecte.tableauxTransmis ?? 0;
  const avance = nbTableaux > 0 ? Math.min(100, Math.round((((collecte.tableauxTransmis ?? 0) + (collecte.tableauxValides ?? 0)) / nbTableaux) * 100)) : 0;
  const etiquette = cabinet && collecte.statut === "brouillon" ? "Chez le client" : cabinet && collecte.statut === "transmis" ? "Transmis" : statut.label;
  const action = cabinet && (collecte.statut === "transmis" || collecte.statut === "a_corriger") ? "Examiner" : cabinet && collecte.statut === "brouillon" ? "Ouvrir" : cabinet ? "Consulter" : statut.action;
  const primaire = cabinet ? aExaminer > 0 : collecte.statut === "a_corriger" || collecte.statut === "brouillon";
  const ouvrir = () => navigate(`/collectes/${collecte.id}`);
  return (
    <li className={cn("grid min-w-0 items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_auto]", mise ? "border-accent bg-gradient-to-br from-accent/15 to-card" : "border-border")}>
      <div className="min-w-0">
        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", statut.tone)}>{etiquette}</span>
        {cabinet && societeNom && <p className="mt-2 truncate text-sm font-semibold text-foreground">{societeNom}</p>}
        <h3 className={cn("truncate font-serif text-xl font-semibold leading-tight", cabinet && societeNom ? "mt-0.5" : "mt-2")}>{nom}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{collecte.echeance ? `Échéance ${formatDate(collecte.echeance)} · ` : ""}mise à jour {formatRelative(collecte.majLe)}</p>
      </div>
      <div className="min-w-0" role="img" aria-label={cabinet ? `${nbTableaux} tableaux, ${aExaminer} à examiner` : demandes > 0 ? `${faits} tableaux transmis sur ${demandes}` : "Aucun tableau demandé"}>
        {cabinet ? (
          <>
            <p className="mb-1.5 text-xs text-muted-foreground"><strong className="font-semibold tabular-nums text-foreground">{nbTableaux}</strong> tableau{nbTableaux > 1 ? "x" : ""}{aExaminer > 0 && <> · <span className="font-semibold text-warning">{aExaminer} à examiner</span></>}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${avance}%` }} /></div>
          </>
        ) : demandes > 0 ? (
          <>
            <p className="mb-1.5 text-xs text-muted-foreground"><strong className="font-semibold tabular-nums text-foreground">{faits}</strong> / {demandes} tableau{demandes > 1 ? "x" : ""} transmis</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress ?? 0}%` }} /></div>
          </>
        ) : <p className="text-xs text-muted-foreground">Aucun tableau demandé pour le moment</p>}
      </div>
      <div className="flex items-center gap-2 md:justify-self-end">
        <Button variant={primaire ? "default" : "outline"} className="min-h-11 gap-2" onClick={ouvrir} aria-label={`${action} la collecte ${societeNom ? `${societeNom} — ` : ""}${nom}`}>
          {action}<ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="size-11" aria-label={`Actions pour ${societeNom ? `${societeNom}, ` : ""}${nom}`}><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={ouvrir}><ArrowRight /> Ouvrir la collecte</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(collecte)}><Trash2 /> Supprimer…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
