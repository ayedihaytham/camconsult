import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import { LedgerKpiRow } from "@/components/ledger/LedgerKpiRow";
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
  const navigate = useNavigate();
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
  const [editSoldeOuverture, setEditSoldeOuverture] = useState("0");

  useEffect(() => {
    fetchOne(suiviId);
    return () => clearCurrent();
  }, [suiviId, fetchOne, clearCurrent]);

  if (!current) {
    return (
      <div>
        <BackBar societeId={societeId} navigate={navigate} />
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
      <BackBar societeId={societeId} navigate={navigate} />

      <LedgerPageHeader
        title={`${current.client}${current.exercice ? ` — ${current.exercice}` : ""}`}
        description={`${societeName} · Devise ${current.devise}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditSoldeOuverture(String(current.soldeOuverture));
                setEditOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              <FileText className="h-4 w-4" />
              Enregistrer PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Export…" : "Excel"}
            </Button>
          </div>
        }
      />

      <LedgerSheet className="mt-4">
        <LedgerKpiRow
          label="Total ventes (hors lots)"
          value={`${fmt(current.totalVentes)} ${current.devise}`}
          hint={
            current.totalVentesLots !== 0
              ? `+ ${fmt(current.totalVentesLots)} ${current.devise} en factures de lots (écart déjà compté, pas le montant)`
              : undefined
          }
        />
        <LedgerKpiRow
          label="Charges + avoirs"
          value={`${fmt(current.totalCharges + current.totalAvoir + current.totalEcartsLots)} ${current.devise}`}
        />
        <LedgerKpiRow label="Règlements" value={`${fmt(current.totalReglements)} ${current.devise}`} />
        {current.soldeOuverture !== 0 && (
          <LedgerKpiRow
            label="Solde d'ouverture"
            value={`${fmt(current.soldeOuverture)} ${current.devise}`}
          />
        )}
        <LedgerKpiRow
          hero
          danger={current.solde > 0.01}
          label="Solde"
          value={`${fmt(current.solde)} ${current.devise}`}
        />
      </LedgerSheet>

      <div className="mt-4">
        <LedgerSegmented value={vue} onChange={setVue} options={VUE_OPTIONS} />
      </div>

      {vue === "ventes" && (
        <LedgerSheet className="mt-4 flex-1">
          <div className="flex justify-end border-b border-border px-[18px] py-2.5">
            <Button
              variant="ledger-text"
              size="sm"
              onClick={() => {
                setEditingFacture(null);
                setFactureOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          </div>
          <LedgerTable
            columns={factureColumns}
            data={current.factures}
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
        </LedgerSheet>
      )}

      {vue === "lots" && (
        <LedgerSheet className="mt-4 flex-1">
          <div className="flex justify-end border-b border-border px-[18px] py-2.5">
            <Button
              variant="ledger-text"
              size="sm"
              onClick={() => {
                setEditingLot(null);
                setLotOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouveau lot
            </Button>
          </div>
          <LedgerTable
            columns={lotColumns}
            data={current.lots}
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
        </LedgerSheet>
      )}

      {vue === "mouvements" && (
        <LedgerSheet className="mt-4 flex-1">
          <div className="flex justify-end border-b border-border px-[18px] py-2.5">
            <Button
              variant="ledger-text"
              size="sm"
              onClick={() => {
                setEditingMouvement(null);
                setMouvementOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouveau mouvement
            </Button>
          </div>
          <LedgerTable
            columns={mouvementColumns}
            data={current.mouvements}
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
        </LedgerSheet>
      )}

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

function BackBar({ societeId, navigate }: { societeId: string; navigate: (path: string) => void }) {
  return (
    <button
      onClick={() => navigate(`/suivi-devise/${societeId}`)}
      className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Toutes les fiches
    </button>
  );
}
