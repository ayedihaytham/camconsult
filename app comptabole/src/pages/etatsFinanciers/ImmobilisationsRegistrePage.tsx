import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Plus, Trash2, Undo2, Upload } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { computeBiensPourExercice, type BienCalcul } from "@/lib/etatsFinanciers/immobilisationsRegistre";
import { useImmobilisations, type BienInput } from "@/store/immobilisations";
import { ImmoBienFormSheet } from "./ImmoBienFormSheet";
import { ImportBiensDialog } from "./ImportBiensDialog";
import type { PostesExercice } from "@/store/balances";
import type { ImmoBien } from "@/types";
import { cn } from "@/lib/utils";

export function ImmobilisationsRegistrePage({
  societeId,
  exercices,
}: {
  societeId: string;
  exercices: PostesExercice[];
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const [exercice, setExercice] = useState(chrono[0]?.exercice ?? "");

  useEffect(() => {
    if (!exercice && chrono[0]) setExercice(chrono[0].exercice);
  }, [chrono, exercice]);

  const categories = useImmobilisations((s) => s.categories);
  const fetchCategories = useImmobilisations((s) => s.fetchCategories);
  const biens = useImmobilisations((s) => s.biens);
  const loadingBiens = useImmobilisations((s) => s.loadingBiens);
  const fetchBiens = useImmobilisations((s) => s.fetchBiens);
  const clearBiens = useImmobilisations((s) => s.clearBiens);
  const addBien = useImmobilisations((s) => s.addBien);
  const updateBien = useImmobilisations((s) => s.updateBien);
  const removeBien = useImmobilisations((s) => s.removeBien);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchBiens(societeId);
    return () => clearBiens();
  }, [societeId, fetchBiens, clearBiens]);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ImmoBien | null>(null);
  const [toDelete, setToDelete] = useState<ImmoBien | null>(null);
  const [toReactivate, setToReactivate] = useState<ImmoBien | null>(null);

  async function handleSubmit(data: BienInput) {
    if (editing) {
      await updateBien(editing.id, data);
      toast.success("Bien modifié");
    } else {
      await addBien(societeId, data);
      toast.success("Bien ajouté");
    }
    setFormOpen(false);
    setEditing(null);
  }

  const calculs = exercice ? computeBiensPourExercice(biens, categories, exercice) : [];
  const parCategorie = new Map<string, BienCalcul[]>();
  for (const c of calculs) {
    const list = parCategorie.get(c.categorie.id) ?? [];
    list.push(c);
    parCategorie.set(c.categorie.id, list);
  }
  const categoriesUtilisees = categories.filter((c) => parCategorie.has(c.id));

  const grandTotal = calculs.reduce(
    (acc, c) => ({
      brutOuverture: acc.brutOuverture + c.brutOuverture,
      acquisitions: acc.acquisitions + c.acquisitions,
      cessionsBrut: acc.cessionsBrut + c.cessionsBrut,
      brutCloture: acc.brutCloture + c.brutCloture,
      amortOuverture: acc.amortOuverture + c.amortOuverture,
      dotations: acc.dotations + c.dotations,
      cessionsAmort: acc.cessionsAmort + c.cessionsAmort,
      amortCloture: acc.amortCloture + c.amortCloture,
      vcn: acc.vcn + c.vcn,
    }),
    {
      brutOuverture: 0,
      acquisitions: 0,
      cessionsBrut: 0,
      brutCloture: 0,
      amortOuverture: 0,
      dotations: 0,
      cessionsAmort: 0,
      amortCloture: 0,
      vcn: 0,
    },
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {chrono.length > 0 ? (
          <LedgerSegmented
            value={exercice}
            onChange={setExercice}
            options={chrono.map((e) => ({ value: e.exercice, label: e.exercice }))}
          />
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importer
          </Button>
          <Button
            variant="ledger"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={categories.length === 0}
          >
            <Plus className="h-4 w-4" />
            Nouveau bien
          </Button>
        </div>
      </div>

      {biens.length === 0 ? (
        <LedgerSheet>
          <EmptyState
            icon={Calculator}
            title={loadingBiens ? "Chargement…" : "Aucun bien enregistré"}
            description="Enregistrez chaque immobilisation une fois — l'amortissement de chaque exercice se calcule ensuite automatiquement."
            action={
              <Button variant="ledger" size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Nouveau bien
              </Button>
            }
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Bien
                  </th>
                  <th className="px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Brut ouv.
                  </th>
                  <th className="px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Acquis.
                  </th>
                  <th className="px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Cessions
                  </th>
                  <th className="px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Brut clôt.
                  </th>
                  <th className="px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Amort. clôt.
                  </th>
                  <th className="px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    VNC
                  </th>
                  <th className="w-[1%] px-[18px] py-2.5" />
                </tr>
              </thead>
              <tbody>
                {categoriesUtilisees.map((cat) => {
                  const items = parCategorie.get(cat.id) ?? [];
                  const sub = items.reduce(
                    (a, c) => ({
                      brutCloture: a.brutCloture + c.brutCloture,
                      amortCloture: a.amortCloture + c.amortCloture,
                      vcn: a.vcn + c.vcn,
                    }),
                    { brutCloture: 0, amortCloture: 0, vcn: 0 },
                  );
                  return (
                    <Fragment key={cat.id}>
                      <tr>
                        <td colSpan={8} className="bg-muted px-[18px] py-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-foreground">
                          {cat.nom} ({cat.taux}%)
                        </td>
                      </tr>
                      {items.map((c, i) => (
                        <tr
                          key={c.bien.id}
                          className={cn(i !== items.length - 1 && "border-b border-border")}
                        >
                          <td className="px-[18px] py-1.5 text-foreground">
                            {c.bien.libelle}
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({c.bien.dateAcquisition})
                            </span>
                            {c.bien.dateCession && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                — cédé le {c.bien.dateCession}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(c.brutOuverture)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(c.acquisitions)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(c.cessionsBrut)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmt(c.brutCloture)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmt(c.amortCloture)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">{fmt(c.vcn)}</td>
                          <td className="px-[18px] py-1.5">
                            <LedgerRowMenu
                              actions={[
                                {
                                  icon: PencilLine,
                                  label: "Modifier",
                                  onClick: () => {
                                    setEditing(c.bien);
                                    setFormOpen(true);
                                  },
                                },
                                ...(c.bien.dateCession
                                  ? [
                                      {
                                        icon: Undo2,
                                        label: "Annuler la cession",
                                        onClick: () => setToReactivate(c.bien),
                                      },
                                    ]
                                  : []),
                                {
                                  icon: Trash2,
                                  label: "Supprimer",
                                  onClick: () => setToDelete(c.bien),
                                  destructive: true,
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b-[1.5px] border-rule-strong font-semibold">
                        <td className="px-[18px] py-1.5 text-foreground">Sous-total</td>
                        <td />
                        <td />
                        <td />
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.brutCloture)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.amortCloture)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.vcn)}</td>
                        <td />
                      </tr>
                    </Fragment>
                  );
                })}
                <tr className="border-t-2 border-foreground font-bold text-foreground">
                  <td className="px-[18px] py-2">TOTAL</td>
                  <td />
                  <td />
                  <td />
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.brutCloture)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.amortCloture)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.vcn)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </LedgerSheet>
      )}

      <ImmoBienFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        categories={categories}
        bien={editing}
        onSubmit={handleSubmit}
      />

      <ImportBiensDialog open={importOpen} onOpenChange={setImportOpen} societeId={societeId} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce bien ?"
        description={
          <>
            <span className="font-medium text-foreground">{toDelete?.libelle}</span> sera
            définitivement retiré du registre — son historique d'amortissement disparaît de
            tous les exercices.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) removeBien(toDelete.id);
          setToDelete(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(toReactivate)}
        onOpenChange={(o) => !o && setToReactivate(null)}
        title="Annuler la cession ?"
        description={
          <>
            <span className="font-medium text-foreground">{toReactivate?.libelle}</span>{" "}
            redevient un bien actif, non cédé.
          </>
        }
        confirmLabel="Confirmer"
        onConfirm={() => {
          if (toReactivate) updateBien(toReactivate.id, { dateCession: null, valeurCession: 0 });
          setToReactivate(null);
        }}
      />
    </div>
  );
}
