import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerToolbar,
} from "@/components/ledger/OperationalLedgerLayout";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { useSocietes } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import { isOverdueCollection } from "@/lib/dashboard/dashboardData";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import {
  filterCollectes,
  getCollecteLensCounts,
  type CollecteDeadlineFilter,
  type CollecteLens,
} from "@/lib/collecte/collectionList";
import type { Collecte, CollecteStatut } from "@/types";
import { CollecteFormDrawer } from "./CollecteFormDrawer";
import { CollectesClientPage, CollecteCard } from "./CollectesClientPage";

const PAGE_CARTES = 10;

export function CollectesListPage() {
  const navigate = useNavigate();
  const { isAdmin, isCollaborateur: canCreate, poste } = usePermissions();
  const isCabinet = isAdmin || canCreate;
  const isSocieteEmploye = poste === "societe_employe";
  const societes = useSocietes();
  const societeActive = useSocieteActive();
  const toutes = useCollectes((s) => s.list);
  // Société active : tout le registre (compteurs, filtres, bannière) porte sur son dossier.
  const list = useMemo(
    () => (societeActive ? toutes.filter((c) => c.societeId === societeActive.id) : toutes),
    [toutes, societeActive],
  );
  const loading = useCollectes((s) => s.loadingList);
  const fetchList = useCollectes((s) => s.fetchList);
  const create = useCollectes((s) => s.create);
  const remove = useCollectes((s) => s.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Collecte | null>(null);
  const [vue, setVue] = useState<CollecteLens>(isCabinet ? "a_examiner" : "actives");
  const [query, setQuery] = useState("");
  const [societeId, setSocieteId] = useState("all");
  const [periode, setPeriode] = useState("all");
  const [statut, setStatut] = useState<CollecteStatut | "all">("all");
  const [echeance, setEcheance] = useState<CollecteDeadlineFilter>("all");

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Le choix de la barre du haut remplace le filtre de société propre à la page.
  useEffect(() => {
    setSocieteId("all");
  }, [societeActive?.id]);

  const societesById = useMemo(() => new Map(societes.map((societe) => [societe.id, societe.raisonSociale])), [societes]);
  const socNom = useCallback((id: string) => societesById.get(id) ?? "Société", [societesById]);
  const periodeLabel = (value: string) => value.trim() || "Période non renseignée";
  const counts = useMemo(() => getCollecteLensCounts(list), [list]);
  const collectionSummary = useMemo(() => {
    const now = new Date();
    return {
      enCours: list.filter((c) => c.statut === "brouillon" || c.statut === "transmis" || c.statut === "a_corriger").length,
      aExaminer: list.filter((c) => c.statut !== "archive" && (c.tableauxTransmis ?? Number(c.statut === "transmis")) > 0).length,
      enRetard: list.filter((c) => isOverdueCollection(c, now)).length,
      aCorriger: list.filter((c) => c.statut === "a_corriger").length,
    };
  }, [list]);

  const shown = useMemo(() => list.filter((collecte) =>
    vue === "toutes" ? true : vue === "archivees" ? collecte.statut === "archive" : collecte.statut !== "archive",
  ), [list, vue]);
  const visibleSocietes = useMemo(() => [...new Set(shown.map((c) => c.societeId))]
    .map((id) => ({ id, name: socNom(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr")), [shown, socNom]);
  const periodes = useMemo(() => [...new Set(shown.map((c) => c.periode.trim()).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a, "fr")), [shown]);
  const filtered = useMemo(() => filterCollectes(list, {
    lens: vue,
    query,
    societeId: societeId === "all" ? "" : societeId,
    periode: periode === "all" ? "" : periode,
    statut,
    echeance,
  }, socNom, new Date()), [list, vue, query, societeId, periode, statut, echeance, socNom]);
  const activeFilterCount = Number(societeId !== "all") + Number(periode !== "all") + Number(statut !== "all") + Number(echeance !== "all");
  const resetFilters = () => {
    setSocieteId("all");
    setPeriode("all");
    setStatut("all");
    setEcheance("all");
  };
  const resetKey = [vue, query, societeId, periode, statut, echeance].join("|");

  const [limite, setLimite] = useState(PAGE_CARTES);
  useEffect(() => setLimite(PAGE_CARTES), [resetKey]);
  const visibles = filtered.slice(0, limite);

  const filters = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {!societeActive && (
        <FilterSelect label="Société" value={societeId} onValueChange={setSocieteId}>
          <SelectItem value="all">Toutes les sociétés</SelectItem>
          {visibleSocietes.map((societe) => <SelectItem key={societe.id} value={societe.id}>{societe.name}</SelectItem>)}
        </FilterSelect>
      )}
      <FilterSelect label="Période" value={periode} onValueChange={setPeriode}>
        <SelectItem value="all">Toutes les périodes</SelectItem>
        {periodes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
      </FilterSelect>
      <FilterSelect label="Statut" value={statut} onValueChange={(value) => setStatut(value as CollecteStatut | "all")}>
        <SelectItem value="all">Tous les statuts</SelectItem>
        {(["brouillon", "transmis", "valide", "a_corriger"] as const).map((value) => <SelectItem key={value} value={value}>{COLLECTE_STATUT_LABELS[value]}</SelectItem>)}
      </FilterSelect>
      <FilterSelect label="Échéance" value={echeance} onValueChange={(value) => setEcheance(value as CollecteDeadlineFilter)}>
        <SelectItem value="all">Toutes les échéances</SelectItem>
        <SelectItem value="late">Date dépassée</SelectItem>
        <SelectItem value="today">Aujourd’hui</SelectItem>
        <SelectItem value="upcoming">À venir</SelectItem>
        <SelectItem value="none">Sans échéance</SelectItem>
      </FilterSelect>
    </div>
  );
  const search = (
    <LedgerSearchFilter
      value={query}
      onValueChange={setQuery}
      onClearSearch={() => setQuery("")}
      placeholder="Rechercher une société ou une période"
      searchLabel="Rechercher une société ou une période"
      filterLabel="Filtrer les collectes"
      activeFilterCount={activeFilterCount}
      onReset={resetFilters}
    >
      {filters}
    </LedgerSearchFilter>
  );
  const lensControl = (
    <LedgerSegmented
      ariaLabel="Vue des collectes"
      value={vue}
      onChange={setVue}
      options={[
        ...(isCabinet ? [{ value: "a_examiner" as const, label: `À examiner (${counts.aExaminer})` }] : []),
        { value: "actives", label: `Actives (${counts.actives})` },
        { value: "archivees", label: `Archivées (${counts.archivees})` },
        { value: "toutes", label: `Toutes (${counts.toutes})` },
      ]}
    />
  );

  if (isSocieteEmploye) {
    const unique = new Set(list.map((c) => c.societeId));
    return <CollectesClientPage list={list} loading={loading} societeNom={societeActive?.raisonSociale ?? (unique.size === 1 ? socNom([...unique][0]) : null)} />;
  }

  return (
    <div className={`flex min-w-0 flex-1 flex-col ${canCreate ? "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-0" : ""}`}>
      <SignatureLedgerBanner
        icon={ClipboardList}
        className="mb-0 sm:mb-2"
        variant="process"
        eyebrow="Clients & travail · Process Ledger"
        title="Collecte de pièces"
        description={canCreate ? "Classeurs confiés aux clients pour saisie et retour au cabinet." : "Classeurs à remplir et transmettre à votre cabinet."}
        metrics={[
          ...(isCabinet ? [{ label: "À examiner", value: collectionSummary.aExaminer, tone: "warning" as const, loading }] : []),
          { label: "En cours", value: collectionSummary.enCours, loading },
          { label: "En retard", value: collectionSummary.enRetard, tone: "destructive", loading },
          { label: "À corriger", value: collectionSummary.aCorriger, tone: "warning", loading },
        ]}
        action={canCreate ? { label: "Nouvelle collecte", onClick: () => setCreateOpen(true) } : undefined}
      />

      <LedgerWorkSurface className="collectes-work-surface ledger-soft-rows">
        <div data-tour="collecte-lenses" className="collectes-lenses">{lensControl}</div>
        <OperationalLedgerToolbar
          label="Outils des collectes"
          search={search}
        />
        <OperationalContentHeader>
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">Registre des collectes</h2>
            <p className="hidden truncate text-[11px] text-muted-foreground md:block">Suivi des transmissions et corrections</p>
          </div>
          {!loading && <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">{filtered.length} dossier{filtered.length === 1 ? "" : "s"} visible{filtered.length === 1 ? "" : "s"}</span>}
        </OperationalContentHeader>

        {!loading && filtered.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-5">
            <p className="text-sm text-muted-foreground">
              {query || activeFilterCount > 0
                ? "Aucune collecte ne correspond à ces critères."
                : list.length === 0
                  ? "Aucune collecte."
                  : vue === "a_examiner"
                    ? "Aucun tableau transmis à examiner."
                    : vue === "archivees"
                      ? "Aucune collecte archivée."
                      : "Aucune collecte active."}
            </p>
            {(query || activeFilterCount > 0) && <Button type="button" variant="link" className="h-auto px-0 pt-1" onClick={() => { setQuery(""); resetFilters(); }}>Effacer la recherche et les filtres</Button>}
          </div>
        ) : (
          <div className="px-3 py-3 sm:px-4 sm:py-4">
            {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
              <ul className="grid gap-3" aria-label="Collectes">
                {visibles.map((collecte, index) => (
                  <CollecteCard
                    key={collecte.id}
                    collecte={collecte}
                    cabinet
                    mise={index === 0 && vue === "a_examiner"}
                    societeNom={socNom(collecte.societeId)}
                    onDelete={isAdmin ? setToDelete : undefined}
                  />
                ))}
              </ul>
            )}
            {!loading && filtered.length > limite && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">{visibles.length} sur {filtered.length} collectes</span>
                <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setLimite((n) => n + PAGE_CARTES)}>Afficher plus</Button>
              </div>
            )}
          </div>
        )}
      </LedgerWorkSurface>

      {canCreate && <OperationalFab label="Nouvelle collecte" onClick={() => setCreateOpen(true)} />}
      {canCreate && <CollecteFormDrawer open={createOpen} onOpenChange={setCreateOpen} defaultSocieteId={societeActive?.id} onCreate={async (data) => {
        const collecte = await create(data);
        toast.success("Collecte créée", { description: `${socNom(collecte.societeId)} — ${periodeLabel(collecte.periode)}` });
        navigate(`/collectes/${collecte.id}`);
      }} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette collecte ?"
        description={<>La collecte <span className="font-medium text-foreground">{toDelete ? `${socNom(toDelete.societeId)} — ${periodeLabel(toDelete.periode)}` : ""}</span> et toutes les données saisies seront supprimées.</>}
        confirmLabel="Supprimer"
        onConfirm={() => { if (toDelete) remove(toDelete.id); setToDelete(null); }}
      />
    </div>
  );
}

function FilterSelect({ label, value, onValueChange, children }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = `collectes-filter-${label.toLocaleLowerCase("fr").replace(/\s+/g, "-")}`;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
