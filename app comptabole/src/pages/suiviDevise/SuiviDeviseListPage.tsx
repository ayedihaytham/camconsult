import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Boxes, CircleDollarSign, Search, Trash2 } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { useSocieteById } from "@/store/data";
import { useSuiviDevise } from "@/store/suiviDevise";
import type { SuiviDeviseResume } from "@/store/suiviDevise";
import type { SuiviDeviseStockClient } from "@/types";
import { aSoldeDu, effectifs, fichesAffichees, ficheChoisie, soldeDuParDevise, type FiltreFiches } from "@/lib/suiviDeviseListe";
import { SuiviDeviseVolet } from "./SuiviDeviseVolet";

const DEVISES = ["EUR", "USD", "TND"];

export function SuiviDeviseListPage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const list = useSuiviDevise((s) => s.list);
  const loading = useSuiviDevise((s) => s.loadingList);
  const fetchList = useSuiviDevise((s) => s.fetchList);
  const clearList = useSuiviDevise((s) => s.clearList);
  const create = useSuiviDevise((s) => s.create);
  const remove = useSuiviDevise((s) => s.remove);
  const fetchStockClients = useSuiviDevise((s) => s.fetchStockClients);
  const fetchStockVentes = useSuiviDevise((s) => s.fetchStockVentes);
  const reprendreDuStock = useSuiviDevise((s) => s.reprendreDuStock);

  const [createOpen, setCreateOpen] = useState(false);
  const [client, setClient] = useState("");
  const [exercice, setExercice] = useState(String(new Date().getFullYear()));
  const [devise, setDevise] = useState("EUR");
  const [soldeOuverture, setSoldeOuverture] = useState("0");
  const [toDelete, setToDelete] = useState<SuiviDeviseResume | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreFiches>("toutes");
  // Présentation : « liste et volet » (par défaut) ou tableau ; gardée dans ce navigateur.
  const [vue, setVue] = useState<"volet" | "tableau">(() => {
    try { return window.localStorage.getItem("devise:vue") === "volet" ? "volet" : "tableau"; } catch { return "tableau"; }
  });
  const changerVue = (v: "volet" | "tableau") => {
    setVue(v);
    try { window.localStorage.setItem("devise:vue", v); } catch { /* stockage bloqué : le choix n'est pas gardé */ }
  };
  const [selection, setSelection] = useState<string | null>(null);
  // Clients de la gestion de stock sans fiche, proposés comme fiches à créer.
  const [clientsStock, setClientsStock] = useState<SuiviDeviseStockClient[]>([]);
  const [creation, setCreation] = useState<string | null>(null);

  useEffect(() => {
    fetchList(societeId);
    return () => clearList();
  }, [societeId, fetchList, clearList]);

  useEffect(() => {
    let actuel = true;
    fetchStockClients(societeId)
      .then((c) => actuel && setClientsStock(c))
      .catch(() => actuel && setClientsStock([]));
    return () => {
      actuel = false;
    };
  }, [societeId, list.length, fetchStockClients]);

  const cleStock = (c: SuiviDeviseStockClient) => `${c.client}|${c.devise}|${c.exercice}`;

  /** Crée la fiche d'un client du stock et reprend d'un coup toutes ses ventes. */
  async function creerDepuisStock(c: SuiviDeviseStockClient) {
    setCreation(cleStock(c));
    try {
      const f = await create({ societeId, client: c.client, exercice: c.exercice, devise: c.devise });
      const ventes = await fetchStockVentes(f.id);
      if (ventes.length > 0) await reprendreDuStock(f.id, ventes.map((v) => v.mouvementId));
      toast.success(`Fiche créée — ${ventes.length} facture${ventes.length > 1 ? "s" : ""} reprise${ventes.length > 1 ? "s" : ""} du stock`);
      navigate(`/suivi-devise/${societeId}/${f.id}`);
    } catch {
      // fail() du store affiche déjà le toast d'erreur
    } finally {
      setCreation(null);
    }
  }

  async function submitCreate() {
    if (!client.trim()) return;
    try {
      const f = await create({
        societeId,
        client: client.trim(),
        exercice: exercice.trim(),
        devise,
        soldeOuverture: Number(soldeOuverture) || 0,
      });
      toast.success("Fiche créée");
      setCreateOpen(false);
      setClient("");
      setSoldeOuverture("0");
      navigate(`/suivi-devise/${societeId}/${f.id}`);
    } catch {
      // fail() du store affiche déjà le toast d'erreur (ex. fiche en doublon)
    }
  }

  const nombres = useMemo(() => effectifs(list), [list]);
  const visibles = useMemo(() => fichesAffichees(list, filtre, recherche), [list, filtre, recherche]);
  const selectionId = ficheChoisie(visibles, selection);
  const dus = useMemo(() => soldeDuParDevise(list), [list]);

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        icon={CircleDollarSign}
        className="mb-0 sm:mb-2"
        eyebrow="Comptabilité · Financial Ledger"
        title={societe?.raisonSociale ?? "Société"}
        description="Une fiche par client, exercice et devise — un même client en EUR et en USD sur la même année, c'est deux fiches."
        metrics={[]}
        action={{ label: "Nouvelle fiche", onClick: () => setCreateOpen(true) }}
      />

      {clientsStock.length > 0 && (
        <section
          data-tour="devise-stock-clients"
          aria-label="Clients de la gestion de stock sans fiche"
          className="mt-3 overflow-hidden rounded-xl border border-primary/10 bg-card"
        >
          <header className="flex items-center gap-2 border-b border-primary/10 px-4 py-2.5">
            <Boxes className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">Clients de la gestion de stock</h2>
            <span className="text-[11px] text-muted-foreground">sans fiche — leurs ventes sont reprises automatiquement</span>
          </header>
          <ul className="divide-y divide-accent/20">
            {clientsStock.map((c) => (
              <li key={cleStock(c)} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{c.client}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.exercice} · {c.nbFactures} facture{c.nbFactures > 1 ? "s" : ""} de vente
                  </span>
                </span>
                <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                  {fmt(c.montantTotal)} {c.devise}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={creation !== null}
                  aria-label={`Créer la fiche de ${c.client} (${c.exercice}, ${c.devise})`}
                  onClick={() => void creerDepuisStock(c)}
                >
                  {creation === cleStock(c) ? "Création…" : "Créer la fiche"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 px-3 py-2">
          <label className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-[10px] border border-border bg-muted/40 px-3 focus-within:ring-2 focus-within:ring-ring">
            <span className="sr-only">Rechercher une fiche</span>
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              data-tour="devise-search"
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un client, un exercice ou une devise…"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          {!loading && (
            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {visibles.length} fiche{visibles.length === 1 ? "" : "s"} visible{visibles.length === 1 ? "" : "s"}
            </span>
          )}
          <div role="group" aria-label="Présentation des fiches" className="hidden rounded-[10px] bg-muted p-[3px] lg:inline-flex">
            {([["volet", "Liste et volet"], ["tableau", "Tableau"]] as const).map(([valeur, libelle]) => (
              <button
                key={valeur}
                type="button"
                aria-pressed={vue === valeur}
                onClick={() => changerVue(valeur)}
                className={cn("h-8 rounded-[7px] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", vue === valeur && "bg-card font-semibold text-primary shadow-sm")}
              >
                {libelle}
              </button>
            ))}
          </div>
        </div>
        <div data-tour="devise-summary" className="flex flex-wrap items-stretch gap-x-0.5 border-b border-border/80 bg-muted/20 px-3">
          <div role="group" aria-label="Filtrer les fiches" className="flex flex-wrap items-stretch">
            {([["toutes", "Fiches", nombres.toutes, "text-primary"], ["du", "Avec solde dû", nombres.du, "text-warning"], ["soldees", "Soldées", nombres.soldees, "text-success"], ["stock", "À reprendre du stock", nombres.stock, "text-primary"]] as const).map(([valeur, nom, n, ton]) => (
              <button
                key={valeur}
                type="button"
                aria-pressed={filtre === valeur}
                onClick={() => setFiltre(valeur)}
                className={cn("relative flex items-baseline gap-2 px-4 py-3 text-[0.8125rem] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", filtre === valeur ? "font-semibold text-foreground after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:rounded after:bg-[#C9A96A]" : "text-muted-foreground")}
              >
                <b className={cn("text-sm font-bold leading-none tabular-nums tracking-tight", n === 0 ? "text-muted-foreground/50" : ton)}>{loading ? "–" : n}</b>
                {nom}
              </button>
            ))}
          </div>
          {dus.length > 0 && (
            <dl className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
              {dus.map((d) => (
                <div key={d.devise} className="flex flex-col border-l border-border/80 pl-4 leading-tight">
                  <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Solde dû {dus.length > 1 ? d.devise : "total"}</dt>
                  <dd className="m-0 text-sm font-bold tabular-nums text-warning">{fmt(d.montant)} {d.devise}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {visibles.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-5">
            <div className="flex items-start gap-3 text-sm">
              <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">{loading ? "Chargement…" : list.length === 0 ? "Aucune fiche" : "Aucun résultat"}</p>
                <p className="text-muted-foreground">
                  {list.length > 0
                    ? "Aucune fiche ne correspond à ce filtre."
                    : "Créez une fiche pour suivre les ventes export d'un client."}
                </p>
              </div>
            </div>
          </div>
        ) : vue === "volet" ? (
          <div data-tour="devise-register">
            <SuiviDeviseVolet
              fiches={visibles}
              selectionId={selectionId}
              onSelection={(id) => {
                // Sur petit écran, la fiche n'a pas de place : un clic ouvre directement la fiche.
                if (typeof window.matchMedia === "function" && !window.matchMedia("(min-width: 1024px)").matches) navigate(`/suivi-devise/${societeId}/${id}`);
                else setSelection(id);
              }}
              onOuvrir={(id) => navigate(`/suivi-devise/${societeId}/${id}`)}
              onSupprimer={setToDelete}
            />
          </div>
        ) : (
          <div data-tour="devise-register" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead className="text-right">Total ventes</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/suivi-devise/${societeId}/${f.id}`)}
                  >
                    <TableCell>
                      <span className="ledger-soft-name block font-semibold text-foreground">{f.client}</span>
                      {f.exercice && <span className="block text-xs text-muted-foreground">{f.exercice}</span>}
                      {(f.stockAReprendre ?? 0) > 0 && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <Boxes className="size-3" aria-hidden="true" />
                          {f.stockAReprendre} vente{(f.stockAReprendre ?? 0) > 1 ? "s" : ""} du stock à reprendre
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.devise}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {fmt(f.totalVentes)} {f.devise}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right font-semibold tabular-nums",
                        aSoldeDu(f) && "text-warning",
                      )}
                    >
                      {fmt(f.solde)} {f.devise}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete(f);
                        }}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Supprimer"
                        aria-label={`Supprimer la fiche ${f.client}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle fiche</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="suivi-client">Client</Label>
              <Input
                id="suivi-client"
                autoFocus
                value={client}
                onChange={(e) => {
                  setClient(e.target.value);
                  // Un client du stock : l'exercice et la devise de ses ventes sont proposés.
                  const connu = clientsStock.find((c) => c.client === e.target.value);
                  if (connu) {
                    setExercice(connu.exercice);
                    setDevise(connu.devise);
                  }
                }}
                placeholder="Ex. GROUP BYOUT EZZ COMPANY"
                list="suivi-clients-stock"
              />
              <datalist id="suivi-clients-stock">
                {[...new Set(clientsStock.map((c) => c.client))].map((nom) => (
                  <option key={nom} value={nom} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="suivi-exercice">Exercice</Label>
                <Input
                  id="suivi-exercice"
                  value={exercice}
                  onChange={(e) => setExercice(e.target.value)}
                  placeholder="Ex. 2025"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCreate();
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select value={devise} onValueChange={setDevise}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVISES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suivi-solde-ouverture">Solde d'ouverture (facultatif)</Label>
              <Input
                id="suivi-solde-ouverture"
                type="number"
                step="any"
                value={soldeOuverture}
                onChange={(e) => setSoldeOuverture(e.target.value)}
                placeholder="0"
                className="text-right tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Report de l'exercice précédent (ex. « Avoir 31/12/2022 »), inclus tel quel dans le solde.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button variant="ledger" disabled={!client.trim()} onClick={submitCreate}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette fiche ?"
        description={
          <>
            La fiche <span className="font-medium text-foreground">{toDelete?.client}</span> sera
            définitivement supprimée, avec ses lots, factures et mouvements.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) remove(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
