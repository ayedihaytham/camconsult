import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, Download, FileText, Package, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerToolbar,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import type { DataTableColumn } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { useSocieteById } from "@/store/data";
import { useSuiviDevise } from "@/store/suiviDevise";
import { downloadTablesPdf } from "@/lib/pdfTables";
import { exportSuiviDeviseStyled } from "@/lib/suiviDevise/exportStyled";
import type {
  SuiviDeviseFacture,
  SuiviDeviseLot,
  SuiviDeviseLotType,
  SuiviDeviseMouvement,
  SuiviDeviseMouvementType,
} from "@/types";
import { SuiviDeviseFactureFormSheet } from "./SuiviDeviseFactureFormSheet";
import { SuiviDeviseImportDialog } from "./SuiviDeviseImportDialog";
import { SuiviDeviseLotFormSheet } from "./SuiviDeviseLotFormSheet";
import { SuiviDeviseMouvementFormSheet } from "./SuiviDeviseMouvementFormSheet";

type Vue = "ventes" | "lots" | "mouvements";

const VUE_OPTIONS: { value: Vue; label: string }[] = [
  { value: "ventes", label: "Ventes" },
  { value: "lots", label: "Lots LC" },
  { value: "mouvements", label: "Mouvements" },
];

const TYPE_LABELS: Record<SuiviDeviseMouvementType, string> = {
  charge_transport: "Charge transport",
  avoir: "Avoir",
  reglement: "Règlement",
};

const LOT_TYPE_LABELS: Record<SuiviDeviseLotType, string> = {
  aucun: "Aucun (EX WORK)",
  charges_trans_av: "Charges trans+av",
  avoir: "Avoir",
};

export function SuiviDeviseEditorPage() {
  const { societeId = "", suiviId = "" } = useParams();
  const societe = useSocieteById(societeId);

  const current = useSuiviDevise((s) => s.current);
  const loading = useSuiviDevise((s) => s.loadingCurrent);
  const fetchOne = useSuiviDevise((s) => s.fetchOne);
  const clearCurrent = useSuiviDevise((s) => s.clearCurrent);
  const update = useSuiviDevise((s) => s.update);
  const addLot = useSuiviDevise((s) => s.addLot);
  const updateLot = useSuiviDevise((s) => s.updateLot);
  const removeLot = useSuiviDevise((s) => s.removeLot);
  const addFacture = useSuiviDevise((s) => s.addFacture);
  const updateFacture = useSuiviDevise((s) => s.updateFacture);
  const removeFacture = useSuiviDevise((s) => s.removeFacture);
  const addMouvement = useSuiviDevise((s) => s.addMouvement);
  const updateMouvement = useSuiviDevise((s) => s.updateMouvement);
  const removeMouvement = useSuiviDevise((s) => s.removeMouvement);

  const [vue, setVue] = useState<Vue>("ventes");
  const [factureOpen, setFactureOpen] = useState(false);
  const [editingFacture, setEditingFacture] = useState<SuiviDeviseFacture | null>(null);
  const [factureToDelete, setFactureToDelete] = useState<SuiviDeviseFacture | null>(null);
  const [lotOpen, setLotOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<SuiviDeviseLot | null>(null);
  const [lotToDelete, setLotToDelete] = useState<SuiviDeviseLot | null>(null);
  const [mouvementOpen, setMouvementOpen] = useState(false);
  const [editingMouvement, setEditingMouvement] = useState<SuiviDeviseMouvement | null>(null);
  const [mouvementToDelete, setMouvementToDelete] = useState<SuiviDeviseMouvement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editSoldeOuverture, setEditSoldeOuverture] = useState("0");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    fetchOne(suiviId);
    return () => clearCurrent();
  }, [suiviId, fetchOne, clearCurrent]);

  if (!current) {
    return (
      <div>
        <LedgerSheet className="mt-4">
          <EmptyState title={loading ? "Chargement…" : "Fiche introuvable"} description="" />
        </LedgerSheet>
      </div>
    );
  }

  const societeName = societe?.raisonSociale ?? "Société";
  const lotById = new Map(current.lots.map((l) => [l.id, l]));

  const factureColumns: DataTableColumn<SuiviDeviseFacture>[] = [
    { id: "date", header: "Date", cell: (f) => f.dateFacture ?? "—", sortable: true, sortAccessor: (f) => f.dateFacture ?? "" },
    { id: "nFacture", header: "N° facture", cell: (f) => f.nFacture || "—" },
    { id: "produit", header: "Désignation", cell: (f) => f.designationProduit || "—" },
    { id: "fournisseur", header: "Fournisseur", cell: (f) => f.fournisseur || "—" },
    { id: "lot", header: "Lot", cell: (f) => (f.lotId ? lotById.get(f.lotId)?.libelle || "—" : "—") },
    { id: "qte", header: "Qté (T)", align: "right", cell: (f) => fmt(f.qteTonnes) },
    { id: "pu", header: "PU", align: "right", cell: (f) => fmt(f.pu) },
    { id: "montant", header: "Montant", align: "right", cell: (f) => <span className="font-semibold">{fmt(f.montantTotal)}</span> },
    {
      id: "avoir",
      header: "Avoir",
      align: "right",
      cell: (f) => (f.avoirMontant ? <span className="text-warning">{fmt(f.avoirMontant)}</span> : "—"),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (f) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFactureToDelete(f);
          }}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  const lotColumns: DataTableColumn<SuiviDeviseLot>[] = [
    { id: "libelle", header: "Lot", cell: (l) => l.libelle || "Lot sans nom" },
    { id: "incoterm", header: "Incoterm", cell: (l) => l.incoterm || "—" },
    { id: "regime", header: "Régime", cell: (l) => LOT_TYPE_LABELS[l.type] },
    { id: "qte", header: "Quantité (T)", align: "right", cell: (l) => fmt(l.quantiteTonnes) },
    { id: "prixRendu", header: "Prix rendu", align: "right", cell: (l) => fmt(l.prixRendu) },
    { id: "rabais", header: "Rabais", align: "right", cell: (l) => fmt(l.rabais) },
    { id: "ecart", header: "Écart (charges/avoir)", align: "right", cell: (l) => <span className="font-semibold">{fmt(l.ecart)}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (l) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLotToDelete(l);
          }}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  const mouvementColumns: DataTableColumn<SuiviDeviseMouvement>[] = [
    { id: "type", header: "Type", cell: (m) => TYPE_LABELS[m.type] },
    { id: "date", header: "Date", cell: (m) => m.date ?? "—", sortable: true, sortAccessor: (m) => m.date ?? "" },
    { id: "libelle", header: "Libellé", cell: (m) => m.libelle || "—" },
    { id: "lot", header: "Lot", cell: (m) => (m.lotId ? lotById.get(m.lotId)?.libelle || "—" : "—") },
    { id: "montant", header: "Montant", align: "right", cell: (m) => <span className="font-semibold">{fmt(m.montant)}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (m) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMouvementToDelete(m);
          }}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  const q = recherche.trim().toLowerCase();
  const facturesVisibles = !q
    ? current.factures
    : current.factures.filter((f) => [f.nFacture, f.designationProduit, f.fournisseur].some((v) => (v || "").toLowerCase().includes(q)));
  const lotsVisibles = !q
    ? current.lots
    : current.lots.filter((l) => [l.libelle, l.incoterm].some((v) => (v || "").toLowerCase().includes(q)));
  const mouvementsVisibles = !q
    ? current.mouvements
    : current.mouvements.filter((m) => [m.libelle, TYPE_LABELS[m.type]].some((v) => (v || "").toLowerCase().includes(q)));

  const registryLabel = vue === "ventes" ? "Registre des ventes" : vue === "lots" ? "Registre des lots" : "Registre des mouvements";
  const registryDescription = vue === "ventes" ? "Factures et avoirs" : vue === "lots" ? "Lots LC et écarts" : "Charges, avoirs et règlements";
  const visibleCount = vue === "ventes" ? facturesVisibles.length : vue === "lots" ? lotsVisibles.length : mouvementsVisibles.length;
  const bannerActionLabel = vue === "ventes" ? "Nouvelle facture" : vue === "lots" ? "Nouveau lot" : "Nouveau mouvement";
  function bannerAction() {
    if (vue === "ventes") {
      setEditingFacture(null);
      setFactureOpen(true);
    } else if (vue === "lots") {
      setEditingLot(null);
      setLotOpen(true);
    } else {
      setEditingMouvement(null);
      setMouvementOpen(true);
    }
  }

  async function handleExportPdf() {
    try {
      await downloadTablesPdf({
        title: `${current!.client.toUpperCase()} — ${societeName}`,
        subtitle: [current!.exercice, `Devise : ${current!.devise}`].filter(Boolean).join(" · "),
        sheets: [
          {
            name: "Ventes",
            headerRow: true,
            rows: [
              ["Date", "N° facture", "Désignation", "Fournisseur", "Qté (T)", "PU", "Montant"],
              ...current!.factures.map((f) => [
                f.dateFacture ?? "", f.nFacture, f.designationProduit, f.fournisseur, f.qteTonnes, f.pu, f.montantTotal,
              ]),
              ["TOTAL VENTES", "", "", "", "", "", current!.totalVentes],
            ],
          },
          {
            name: "Mouvements",
            headerRow: true,
            rows: [
              ["Type", "Date", "Libellé", "Montant"],
              ...current!.mouvements.map((m) => [TYPE_LABELS[m.type], m.date ?? "", m.libelle, m.montant]),
              ["SOLDE", "", "", current!.solde],
            ],
          },
        ],
        fileName: `Suivi_devise_${current!.client}_${current!.exercice}`,
      });
    } catch {
      toast.error("PDF impossible");
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      await exportSuiviDeviseStyled(current!, societeName);
      toast.success("Fiche exportée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        icon={Package}
        className="mb-0 sm:mb-2"
        eyebrow="Comptabilité · Financial Ledger"
        title={`${current.client}${current.exercice ? ` — ${current.exercice}` : ""}`}
        description={`${societeName} · Devise ${current.devise}`}
        metrics={[
          { label: "Factures", value: current.factures.length },
          { label: "Lots LC", value: current.lots.length },
          { label: "Mouvements", value: current.mouvements.length },
        ]}
        action={{ label: bannerActionLabel, onClick: bannerAction }}
      />

      <dl className="mt-3 grid grid-cols-1 divide-y divide-border border-y border-border bg-muted/35 sm:grid-cols-2 lg:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">
            Total ventes (hors lots)
            {current.totalVentesLots !== 0 && (
              <span className="block text-[0.65rem]">
                + {fmt(current.totalVentesLots)} {current.devise} en factures de lots
              </span>
            )}
          </dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {fmt(current.totalVentes)} {current.devise}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Charges + avoirs</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {fmt(current.totalCharges + current.totalAvoir + current.totalEcartsLots)} {current.devise}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Règlements</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {fmt(current.totalReglements)} {current.devise}
          </dd>
        </div>
        {current.soldeOuverture !== 0 && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Solde d'ouverture</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {fmt(current.soldeOuverture)} {current.devise}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">
            Solde
            <span className="block text-[0.65rem]">
              {current.solde > 0.01
                ? "Reste dû par le client"
                : current.solde < -0.01
                  ? "Trop perçu / crédit en faveur du client"
                  : "Soldé"}
            </span>
          </dt>
          <dd className={cn("font-mono text-sm font-semibold tabular-nums", current.solde > 0.01 ? "text-warning" : "text-foreground")}>
            {fmt(current.solde)} {current.devise}
          </dd>
        </div>
      </dl>

      <LedgerWorkSurface className="mt-3">
        <div data-tour="devise-tabs" className="px-3">
          <LedgerSegmented value={vue} onChange={setVue} options={VUE_OPTIONS} />
        </div>
        <div data-tour="devise-actions"><OperationalLedgerToolbar
          label="Recherche du suivi client devise"
          search={
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher (n° facture, désignation, libellé…)…"
              className="h-9"
            />
          }
          tools={
            <>
              {vue === "ventes" && (
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Importer
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Outils
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditSoldeOuverture(String(current.soldeOuverture));
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Modifier le solde d'ouverture
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleExportPdf()}>
                    <FileText className="h-4 w-4" /> Enregistrer PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleExportExcel()} disabled={exporting}>
                    <Download className="h-4 w-4" /> {exporting ? "Export…" : "Excel"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        /></div>
        <OperationalMobileUtility label="Recherche du suivi client devise">
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (n° facture, désignation, libellé…)…"
            className="h-9"
          />
        </OperationalMobileUtility>
        <OperationalContentHeader>
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">{registryLabel}</h2>
            <p className="hidden truncate text-[11px] text-muted-foreground md:block">{registryDescription}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            {visibleCount} ligne{visibleCount === 1 ? "" : "s"} visible{visibleCount === 1 ? "" : "s"}
          </span>
        </OperationalContentHeader>

        <div data-tour="devise-editor">{vue === "ventes" && (
          <LedgerTable
            columns={factureColumns}
            data={facturesVisibles}
            getRowId={(f) => f.id}
            onRowClick={(f) => {
              setEditingFacture(f);
              setFactureOpen(true);
            }}
            pageSize={20}
            emptyState={
              <EmptyState
                title="Aucune facture"
                description="Ajoutez les lignes de vente de ce client."
                action={
                  <Button variant="ledger" size="sm" onClick={() => setFactureOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Nouvelle facture
                  </Button>
                }
              />
            }
          />
        )}

        {vue === "lots" && (
          <LedgerTable
            columns={lotColumns}
            data={lotsVisibles}
            getRowId={(l) => l.id}
            onRowClick={(l) => {
              setEditingLot(l);
              setLotOpen(true);
            }}
            pageSize={20}
            emptyState={
              <EmptyState
                icon={Package}
                title="Aucun lot"
                description="Les lots LC regroupent les factures par lettre de crédit — facultatif."
                action={
                  <Button variant="ledger" size="sm" onClick={() => setLotOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Nouveau lot
                  </Button>
                }
              />
            }
          />
        )}

        {vue === "mouvements" && (
          <LedgerTable
            columns={mouvementColumns}
            data={mouvementsVisibles}
            getRowId={(m) => m.id}
            onRowClick={(m) => {
              setEditingMouvement(m);
              setMouvementOpen(true);
            }}
            pageSize={20}
            emptyState={
              <EmptyState
                title="Aucun mouvement"
                description="Charges de transport, avoirs et règlements — s'ajoutent tous au solde."
                action={
                  <Button variant="ledger" size="sm" onClick={() => setMouvementOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Nouveau mouvement
                  </Button>
                }
              />
            }
          />
        )}</div>
      </LedgerWorkSurface>

      <SuiviDeviseFactureFormSheet
        open={factureOpen}
        onOpenChange={(o) => {
          setFactureOpen(o);
          if (!o) setEditingFacture(null);
        }}
        facture={editingFacture}
        lots={current.lots}
        onSubmit={(v) => {
          if (editingFacture) updateFacture(editingFacture.id, v);
          else addFacture(suiviId, v);
        }}
      />
      <SuiviDeviseImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        suiviId={suiviId}
        lots={current.lots}
      />
      <SuiviDeviseLotFormSheet
        open={lotOpen}
        onOpenChange={(o) => {
          setLotOpen(o);
          if (!o) setEditingLot(null);
        }}
        lot={editingLot}
        onSubmit={(v) => {
          if (editingLot) updateLot(editingLot.id, v);
          else addLot(suiviId, v);
        }}
      />
      <SuiviDeviseMouvementFormSheet
        open={mouvementOpen}
        onOpenChange={(o) => {
          setMouvementOpen(o);
          if (!o) setEditingMouvement(null);
        }}
        mouvement={editingMouvement}
        lots={current.lots}
        onSubmit={(v) => {
          if (editingMouvement) updateMouvement(editingMouvement.id, v);
          else addMouvement(suiviId, v);
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier la fiche</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="suivi-edit-solde-ouverture">Solde d'ouverture</Label>
            <Input
              id="suivi-edit-solde-ouverture"
              type="number"
              step="any"
              value={editSoldeOuverture}
              onChange={(e) => setEditSoldeOuverture(e.target.value)}
              className="text-right tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Report de l'exercice précédent, inclus tel quel dans le solde.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="ledger"
              onClick={async () => {
                await update(suiviId, { soldeOuverture: Number(editSoldeOuverture) || 0 });
                setEditOpen(false);
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(factureToDelete)}
        onOpenChange={(o) => !o && setFactureToDelete(null)}
        title="Supprimer cette facture ?"
        description="Cette ligne de vente sera définitivement supprimée."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (factureToDelete) removeFacture(factureToDelete.id);
          setFactureToDelete(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(lotToDelete)}
        onOpenChange={(o) => !o && setLotToDelete(null)}
        title="Supprimer ce lot ?"
        description="Les factures et mouvements rattachés ne sont pas supprimés — ils repassent sans lot."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (lotToDelete) removeLot(lotToDelete.id);
          setLotToDelete(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(mouvementToDelete)}
        onOpenChange={(o) => !o && setMouvementToDelete(null)}
        title="Supprimer ce mouvement ?"
        description="Ce mouvement sera définitivement supprimé."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (mouvementToDelete) removeMouvement(mouvementToDelete.id);
          setMouvementToDelete(null);
        }}
      />
    </div>
  );
}
