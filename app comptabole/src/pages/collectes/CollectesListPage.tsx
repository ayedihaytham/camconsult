import { virementDepuisLigne } from "@/lib/collecte/grandLivre";
import { virementDejaPresent } from "@/lib/swiftDoublons";
import { useEtatSwift } from "@/store/etatSwift";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeaderBar } from "@/components/ledger/PageHeaderBar";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
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
import { cn } from "@/lib/utils";
import { isOverdueCollection } from "@/lib/dashboard/dashboardData";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import {
  filterCollectes,
  getCollecteLensCounts,
  type CollecteDeadlineFilter,
  type CollecteLens,
} from "@/lib/collecte/collectionList";
import type { Collecte, CollecteStatut } from "@/types";
import { lignesEnregistrables } from "@/lib/collecte/grandLivre";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { CollecteFormDrawer } from "./CollecteFormDrawer";
import { CollectesClientPage } from "./CollectesClientPage";
import { CollectesRegistre } from "./CollectesRegistre";
import { CollectesPipeline } from "./CollectesPipeline";

export function CollectesListPage() {
  const navigate = useNavigate();
  const { isAdmin, isCollaborateur: canCreate, canManageCollaborateurs, poste } = usePermissions();
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
  const saveLignes = useCollectes((s) => s.saveLignes);
  const remove = useCollectes((s) => s.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Collecte | null>(null);
  const [vue, setVue] = useState<CollecteLens>(isCabinet ? "a_examiner" : "actives");
  const vueChoisie = useRef(false);
  const [affichage, setAffichage] = useState<"tableau" | "pipeline">("tableau");
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
  // Rien à examiner et aucun choix de vue : on ouvre les collectes actives plutôt qu'une liste vide.
  useEffect(() => {
    if (!loading && !vueChoisie.current && vue === "a_examiner" && counts.aExaminer === 0) setVue("toutes");
  }, [loading, vue, counts.aExaminer]);
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
  const onglets: { value: CollecteLens; label: string; count: number; chaud?: boolean }[] = [
    ...(isCabinet ? [{ value: "a_examiner" as const, label: "À examiner", count: counts.aExaminer, chaud: true }] : []),
    { value: "chez_client", label: "Chez le client", count: counts.chezClient },
    { value: "a_corriger", label: "À corriger", count: counts.aCorriger },
    { value: "validees", label: "Validées", count: counts.validees },
    { value: "archivees", label: "Archivées", count: counts.archivees },
    { value: "toutes", label: "Toutes", count: counts.toutes },
  ];

  if (isSocieteEmploye) {
    const unique = new Set(list.map((c) => c.societeId));
    return <CollectesClientPage list={list} loading={loading} societeNom={societeActive?.raisonSociale ?? (unique.size === 1 ? socNom([...unique][0]) : null)} />;
  }

  return (
    <div className={`flex min-w-0 flex-1 flex-col ${canCreate ? "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-0" : ""}`}>
      <PageHeaderBar
        title="Collecte de pièces"
        description="Suivi des pièces à collecter auprès de vos clients, tableau par tableau"
        actionsSurPetitEcran={false}
        action={canCreate ? { label: "Nouvelle collecte", onClick: () => setCreateOpen(true) } : undefined}
        metrics={[
          ...(isCabinet ? [{ label: "À examiner", value: collectionSummary.aExaminer, loading }] : []),
          { label: "Chez le client", value: counts.chezClient, loading },
          { label: "En retard", value: collectionSummary.enRetard, loading },
          { label: "À corriger", value: collectionSummary.aCorriger, loading },
        ]}
      />

      <section aria-label="Registre des collectes" className="overflow-hidden rounded-lg border border-border bg-card">
        <div data-tour="collecte-lenses" role="tablist" aria-label="Vue des collectes" className="flex gap-1 overflow-x-auto border-b border-border px-2">
          {onglets.map((onglet) => (
            <button
              key={onglet.value}
              type="button"
              role="tab"
              aria-selected={vue === onglet.value}
              onClick={() => { vueChoisie.current = true; setVue(onglet.value); }}
              className={cn(
                "-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-[3px] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                vue === onglet.value ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {onglet.label}
              <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] tabular-nums", onglet.chaud && onglet.count > 0 ? "bg-warning/15 text-warning" : vue === onglet.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{onglet.count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1 sm:max-w-md">{search}</div>
          <div role="group" aria-label="Affichage des collectes" className="ml-auto flex rounded-md border border-border p-0.5">
            {([["tableau", "Tableau"], ["pipeline", "Pipeline"]] as const).map(([valeur, label]) => (
              <button key={valeur} type="button" aria-pressed={affichage === valeur} onClick={() => setAffichage(valeur)} className={cn("min-h-8 rounded px-3 text-xs font-semibold", affichage === valeur ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-sm text-muted-foreground">
              {query || activeFilterCount > 0
                ? "Aucune collecte ne correspond à ces critères."
                : list.length === 0
                  ? "Aucune collecte."
                  : vue === "a_examiner"
                    ? "Aucun tableau transmis à examiner."
                    : "Aucune collecte dans cette vue."}
            </p>
            {(query || activeFilterCount > 0) && <Button type="button" variant="link" className="h-auto px-0 pt-1" onClick={() => { setQuery(""); resetFilters(); }}>Effacer la recherche et les filtres</Button>}
          </div>
        ) : loading ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">Chargement…</p>
        ) : affichage === "pipeline" ? (
          <CollectesPipeline collectes={filtered} socNom={socNom} />
        ) : (
          <CollectesRegistre key={resetKey} collectes={filtered} socNom={socNom} onDelete={isAdmin || canManageCollaborateurs ? setToDelete : undefined} />
        )}
      </section>

      {canCreate && <OperationalFab label="Nouvelle collecte" onClick={() => setCreateOpen(true)} />}
      {canCreate && <CollecteFormDrawer open={createOpen} onOpenChange={setCreateOpen} defaultSocieteId={societeActive?.id} onCreate={async (data, prerempli) => {
        const collecte = await create(data);
        // Grand-livre importé à la création : chaque tableau détecté est rempli et enregistré avant d'ouvrir la collecte.
        const echecs: string[] = [];
        for (const [onglet, lignes] of Object.entries(prerempli ?? {})) {
          try {
            if (TAB_BY_KEY[onglet]?.module) {
              // Virements SWIFT : créés dans le module (brouillons à vérifier par le cabinet avant envoi à la société), sauf ceux qui y sont déjà.
              await useEtatSwift.getState().fetch(collecte.societeId);
              for (const l of lignes) {
                // Le module garde les virements déjà créés (et ceux qu'on vient d'ajouter) : on les relit à chaque écriture.
                if (virementDejaPresent(l, useEtatSwift.getState().virements)) continue;
                await useEtatSwift.getState().create(collecte.societeId, virementDepuisLigne(l));
              }
              continue;
            }
            await saveLignes(collecte.id, onglet, lignesEnregistrables(onglet, [], lignes));
          } catch {
            echecs.push(TAB_BY_KEY[onglet]?.label ?? onglet);
          }
        }
        if (echecs.length > 0) toast.error(`Collecte créée, mais ces tableaux n'ont pas pu être pré-remplis : ${echecs.join(", ")}. Importez le grand-livre depuis Outils.`);
        // La nouvelle collecte est chez le client : elle se retrouve dans les collectes actives, pas dans « À examiner ».
        vueChoisie.current = true;
        setVue("chez_client");
        setQuery("");
        resetFilters();
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
