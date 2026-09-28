import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Plus, Trash2, Undo2, Upload } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import type { RowAction } from "@/components/common/RowActions";
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

  function actionsForBien(bien: ImmoBien): RowAction[] {
    return [
      {
        icon: PencilLine,
        label: "Modifier",
        onClick: () => {
          setEditing(bien);
          setFormOpen(true);
        },
      },
      ...(bien.dateCession
        ? [{ icon: Undo2, label: "Annuler la cession", onClick: () => setToReactivate(bien) }]
        : []),
      { icon: Trash2, label: "Supprimer", onClick: () => setToDelete(bien), destructive: true },
    ];
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {chrono.length > 0 ? (
          <div className="max-w-full overflow-x-auto [&_button]:min-h-11 lg:[&_button]:min-h-0">
            <LedgerSegmented
              value={exercice}
              onChange={setExercice}
              options={chrono.map((e) => ({ value: e.exercice, label: e.exercice }))}
            />
          </div>
        ) : (
          <div />
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" className="order-2 min-h-11 flex-1 lg:order-1 lg:min-h-8 lg:flex-none" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importer
          </Button>
          <Button
            variant="ledger"
            size="sm"
            className={cn("order-1 min-h-11 flex-1 lg:order-2 lg:min-h-8 lg:flex-none", biens.length === 0 && "hidden lg:inline-flex")}
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
        <LedgerSheet className="min-w-0">
          <EmptyState
            icon={Calculator}
            title={loadingBiens ? "Chargement…" : "Aucun bien enregistré"}
            description="Enregistrez chaque immobilisation une fois — l'amortissement de chaque exercice se calcule ensuite automatiquement."
            action={
              <Button variant="ledger" size="sm" className="min-h-11 lg:min-h-8" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Nouveau bien
              </Button>
            }
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className="min-w-0">
          <div className="divide-y divide-border lg:hidden print:hidden" aria-label={`Registre immobilisations — exercice ${exercice}`}>
            {categoriesUtilisees.map((cat) => (
              <section key={cat.id} aria-label={cat.nom}>
                <h3 className="bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wide text-foreground">{cat.nom} ({cat.taux}%)</h3>
                <div className="divide-y divide-border">
                  {(parCategorie.get(cat.id) ?? []).map((c) => (
                    <article key={c.bien.id} className="min-w-0 px-3 py-3">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="break-words text-sm font-semibold text-foreground">{c.bien.libelle}</h4>
                          <p className="mt-0.5 text-xs text-muted-foreground">Acquis le {c.bien.dateAcquisition}{c.bien.dateCession ? ` · Cédé le ${c.bien.dateCession}` : ""}</p>
                        </div>
                        <div className="flex min-h-11 min-w-11 shrink-0 items-center justify-center [&_button]:h-11 [&_button]:w-11">
                          <LedgerRowMenu actions={actionsForBien(c.bien)} />
                        </div>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div><dt className="text-xs text-muted-foreground">Coût d'acquisition</dt><dd className="whitespace-nowrap tabular-nums text-foreground">{fmt(c.bien.coutAcquisition)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">VNC</dt><dd className="whitespace-nowrap font-semibold tabular-nums text-foreground">{fmt(c.vcn)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Amort. clôture</dt><dd className="whitespace-nowrap tabular-nums text-foreground">{fmt(c.amortCloture)}</dd></div>
                      </dl>
                      <details className="mt-2 border-t border-border/70 text-sm">
                        <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Détail des mouvements</summary>
                        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 pb-2 text-xs">
                          {([
                            ["Brut ouverture", c.brutOuverture], ["Acquisitions", c.acquisitions],
                            ["Cessions brutes", c.cessionsBrut], ["Brut clôture", c.brutCloture],
                            ["Amort. ouverture", c.amortOuverture], ["Dotations", c.dotations],
                            ["Cessions amort.", c.cessionsAmort], ["Amort. clôture", c.amortCloture],
                          ] as const).map(([label, amount]) => (
                            <div key={label} className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                              <dt className="min-w-0 text-muted-foreground">{label}</dt>
                              <dd className="whitespace-nowrap text-right tabular-nums text-foreground">{fmt(amount)}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            <div className="px-3 py-3 text-sm font-bold text-foreground">
              <div className="flex justify-between gap-3"><span>TOTAL VNC</span><span className="whitespace-nowrap tabular-nums">{fmt(grandTotal.vcn)}</span></div>
            </div>
          </div>
          <div className="hidden overflow-x-auto lg:block print:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th rowSpan={2} className="px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground align-bottom">
                    Bien
                  </th>
                  <th colSpan={4} className="border-b border-border px-2 py-1 text-center text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Valeurs brutes
                  </th>
                  <th colSpan={4} className="border-b border-border border-l border-border px-2 py-1 text-center text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Amortissements
                  </th>
                  <th rowSpan={2} className="border-l border-border px-2 py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground align-bottom">
                    VNC
                  </th>
                  <th rowSpan={2} className="w-[1%] px-[18px] py-2.5" />
                </tr>
                <tr>
                  <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Ouverture
                  </th>
                  <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Acquis.
                  </th>
                  <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Cessions
                  </th>
                  <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Clôture
                  </th>
                  <th className="border-l border-border px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Ouverture
                  </th>
                  <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Dotations
                  </th>
                  <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Cessions
                  </th>
                  <th className="px-2 py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Clôture
                  </th>
                </tr>
              </thead>
              <tbody>
                {categoriesUtilisees.map((cat) => {
                  const items = parCategorie.get(cat.id) ?? [];
                  const sub = items.reduce(
                    (a, c) => ({
                      brutOuverture: a.brutOuverture + c.brutOuverture,
                      acquisitions: a.acquisitions + c.acquisitions,
                      cessionsBrut: a.cessionsBrut + c.cessionsBrut,
                      brutCloture: a.brutCloture + c.brutCloture,
                      amortOuverture: a.amortOuverture + c.amortOuverture,
                      dotations: a.dotations + c.dotations,
                      cessionsAmort: a.cessionsAmort + c.cessionsAmort,
                      amortCloture: a.amortCloture + c.amortCloture,
                      vcn: a.vcn + c.vcn,
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
                    <Fragment key={cat.id}>
                      <tr>
                        <td colSpan={11} className="bg-muted px-[18px] py-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-foreground">
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
                          <td className="border-l border-border px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(c.amortOuverture)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(c.dotations)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(c.cessionsAmort)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmt(c.amortCloture)}</td>
                          <td className="border-l border-border px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">{fmt(c.vcn)}</td>
                          <td className="px-[18px] py-1.5">
                            <LedgerRowMenu actions={actionsForBien(c.bien)} />
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b-[1.5px] border-rule-strong font-semibold">
                        <td className="px-[18px] py-1.5 text-foreground">Sous-total</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.brutOuverture)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.acquisitions)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.cessionsBrut)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.brutCloture)}</td>
                        <td className="border-l border-border px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.amortOuverture)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.dotations)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.cessionsAmort)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.amortCloture)}</td>
                        <td className="border-l border-border px-2 py-1.5 text-right tabular-nums text-foreground">{fmt(sub.vcn)}</td>
                        <td />
                      </tr>
                    </Fragment>
                  );
                })}
                <tr className="border-t-2 border-foreground font-bold text-foreground">
                  <td className="px-[18px] py-2">TOTAL</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.brutOuverture)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.acquisitions)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.cessionsBrut)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.brutCloture)}</td>
                  <td className="border-l border-border px-2 py-2 text-right tabular-nums">{fmt(grandTotal.amortOuverture)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.dotations)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.cessionsAmort)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(grandTotal.amortCloture)}</td>
                  <td className="border-l border-border px-2 py-2 text-right tabular-nums">{fmt(grandTotal.vcn)}</td>
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
