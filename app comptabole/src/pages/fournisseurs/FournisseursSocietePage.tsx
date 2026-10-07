import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Download, Plus, Truck } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteById } from "@/store/data";
import { useFournisseurs, type ReglementInput } from "@/store/fournisseurs";
import { lignesEtat, recapFournisseurs, soldesFactures } from "@/lib/fournisseurs";
import { exporterEtatFournisseur } from "@/lib/fournisseursExport";
import { fmtMontant } from "@/lib/stockRecap";
import { cn } from "@/lib/utils";
import type { FactureFournisseur, ReglementFournisseur } from "@/types";
import { FournisseurEtatTable } from "./FournisseurEtatTable";
import { ReglementFormSheet } from "./ReglementFormSheet";
import { SuiviFactureDialog } from "./SuiviFactureDialog";

const th = "px-3 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";
const thNum = `${th} text-right`;
const td = "px-3 py-2.5 align-middle";
const tdNum = `${td} text-right tabular-nums`;

/** Montants d'une colonne, un par devise (« 12 000,000 EUR »), « — » quand il n'y en a pas. */
function parDevise(valeurs: { devise: string; v: number }[], tonDette = false) {
  const utiles = valeurs.filter((x) => x.v !== 0);
  if (utiles.length === 0) return "—";
  return utiles.map((x) => (
    <span key={x.devise} className={cn("block", tonDette && "font-semibold text-destructive")}>
      {fmtMontant(x.v)} {x.devise}
    </span>
  ));
}

export function FournisseursSocietePage() {
  const { societeId = "" } = useParams();
  const societe = useSocieteById(societeId);
  const { lectureSeule } = usePermissions();

  const factures = useFournisseurs((s) => s.factures);
  const reglements = useFournisseurs((s) => s.reglements);
  const loading = useFournisseurs((s) => s.loading);
  const fetchEtat = useFournisseurs((s) => s.fetchEtat);
  const clear = useFournisseurs((s) => s.clear);
  const createReglement = useFournisseurs((s) => s.createReglement);
  const updateReglement = useFournisseurs((s) => s.updateReglement);
  const removeReglement = useFournisseurs((s) => s.removeReglement);
  const saveSuivi = useFournisseurs((s) => s.saveSuivi);

  const [choisi, setChoisi] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReglementFournisseur | null>(null);
  const [toDelete, setToDelete] = useState<ReglementFournisseur | null>(null);
  const [suivi, setSuivi] = useState<FactureFournisseur | null>(null);

  useEffect(() => {
    void fetchEtat(societeId).catch(() => undefined);
    return () => clear();
  }, [societeId, fetchEtat, clear]);

  const recap = useMemo(() => recapFournisseurs(factures, reglements), [factures, reglements]);
  const soldes = useMemo(() => soldesFactures(factures, reglements), [factures, reglements]);
  // Un seul fournisseur : son état s'ouvre directement.
  const actif = recap.find((r) => r.cle === choisi) ?? (recap.length === 1 ? recap[0] : null);
  const lignes = useMemo(() => (actif ? lignesEtat(actif.cle, factures, reglements) : []), [actif, factures, reglements]);
  const facturesActif = useMemo(() => factures.filter((f) => f.fournisseurCle === actif?.cle), [factures, actif]);

  const nbImpayees = factures.filter((f) => soldes.get(f.id)?.statut !== "reglee").length;
  const devises = [...new Set(factures.map((f) => f.devise))];
  const soldeTotal = (d: string) =>
    Math.round(factures.filter((f) => f.devise === d).reduce((s, f) => s + (soldes.get(f.id)?.solde ?? 0), 0) * 1000) / 1000;

  async function handleSubmit(data: ReglementInput) {
    if (editing) {
      await updateReglement(editing.id, data);
      toast.success("Règlement modifié");
    } else {
      await createReglement(data);
      toast.success("Règlement enregistré");
    }
    setEditing(null);
  }

  return (
    <div>
      <div data-tour="fournisseurs-summary">
        <SignatureLedgerBanner
          icon={Truck}
          eyebrow="Clients & travail · Fournisseurs"
          title="Suivi fournisseur"
          description={`${societe?.raisonSociale ?? "Société"} · ${societe?.code ?? ""}`}
          metrics={[
            { label: recap.length > 1 ? "Fournisseurs" : "Fournisseur", value: recap.length, loading },
            { label: nbImpayees > 1 ? "Factures à régler" : "Facture à régler", value: nbImpayees, tone: nbImpayees > 0 ? "warning" : "default" },
            ...devises.slice(0, 2).map((d) => ({
              label: `Solde dû (${d})`,
              value: fmtMontant(soldeTotal(d)),
              tone: soldeTotal(d) > 0 ? ("destructive" as const) : ("default" as const),
            })),
          ]}
          actions={
            actif && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="signature-ledger__action" onClick={() => void exporterEtatFournisseur(actif.nom, lignes)}>
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
                {!lectureSeule && (
                  <Button
                    variant="ledger"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Nouveau règlement
                  </Button>
                )}
              </div>
            )
          }
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card" data-tour="fournisseurs-recap">
        {recap.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <span className="grid size-[70px] place-items-center rounded-full bg-accent/15 text-primary">
              <Truck className="size-7" aria-hidden="true" />
            </span>
            <p className="font-serif text-2xl font-medium text-primary">{loading ? "Chargement…" : "Aucun fournisseur"}</p>
            <p className="max-w-md text-base text-muted-foreground">
              Les fournisseurs viennent des factures d'achat de la gestion de stock : enregistrez un mouvement de stock avec un fournisseur pour le suivre ici.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-accent/25 bg-accent/[0.07]">
                <th className={th}>Fournisseur</th>
                <th className={thNum}>Factures</th>
                <th className={thNum}>Facturé</th>
                <th className={thNum}>Réglé</th>
                <th className={thNum}>RS retenue</th>
                <th className={thNum}>Solde dû</th>
              </tr>
            </thead>
            <tbody>
              {recap.map((r) => (
                <tr
                  key={r.cle}
                  onClick={() => setChoisi(r.cle)}
                  className={cn(
                    "cursor-pointer border-b border-accent/20 transition-colors hover:bg-accent/[0.06]",
                    actif?.cle === r.cle && "bg-accent/[0.1]",
                  )}
                >
                  <td className={td}>
                    <button
                      type="button"
                      aria-pressed={actif?.cle === r.cle}
                      className="text-left font-semibold text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChoisi(r.cle);
                      }}
                    >
                      {r.nom}
                    </button>
                  </td>
                  <td className={tdNum}>
                    {r.nbFactures}
                    {r.nbImpayees > 0 && <span className="block text-xs text-warning">{r.nbImpayees} à régler</span>}
                  </td>
                  <td className={tdNum}>{parDevise(r.totaux.map((t) => ({ devise: t.devise, v: t.facture })))}</td>
                  <td className={tdNum}>{parDevise(r.totaux.map((t) => ({ devise: t.devise, v: t.regle })))}</td>
                  <td className={tdNum}>{parDevise(r.totaux.map((t) => ({ devise: t.devise, v: t.rs })))}</td>
                  <td className={tdNum}>{parDevise(r.totaux.map((t) => ({ devise: t.devise, v: t.solde })), true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actif && (
        <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-accent/25 px-5 py-4">
            <h2 className="font-serif text-xl font-medium text-primary">{actif.nom}</h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              {actif.nbFactures} facture{actif.nbFactures > 1 ? "s" : ""}
            </span>
          </div>
          <FournisseurEtatTable
            lignes={lignes}
            factures={factures}
            lectureSeule={lectureSeule}
            onEditReglement={(r) => {
              setEditing(r);
              setFormOpen(true);
            }}
            onDeleteReglement={setToDelete}
            onSuivi={setSuivi}
          />
        </div>
      )}

      {actif && (
        <ReglementFormSheet
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditing(null);
          }}
          societeId={societeId}
          fournisseurCle={actif.cle}
          fournisseurNom={actif.nom}
          factures={facturesActif}
          reglements={reglements}
          reglement={editing}
          onSubmit={handleSubmit}
        />
      )}

      <SuiviFactureDialog
        facture={suivi}
        onOpenChange={(o) => !o && setSuivi(null)}
        onSubmit={async (id, data) => {
          await saveSuivi(id, data);
          toast.success("Suivi enregistré");
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce règlement ?"
        description="Les factures qu'il couvrait redeviennent à régler."
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          await removeReglement(toDelete.id);
          toast.success("Règlement supprimé");
          setToDelete(null);
        }}
      />
    </div>
  );
}
