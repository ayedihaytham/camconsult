import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookText, Plus } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { CollecteGrid, type CollecteGridHandle } from "@/pages/collectes/CollecteGrid";
import { SectionCircuit } from "@/pages/collectes/SectionCircuit";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteById } from "@/store/data";
import { api } from "@/lib/api";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CollecteLigne, SectionStatut } from "@/types";

interface SoucheCollecte {
  collecteId: string;
  periode: string;
  devise: string;
  statut: SectionStatut;
  motifRenvoi: string;
  lignes: CollecteLigne[];
}

const OUVERTS: SectionStatut[] = ["brouillon", "a_corriger"];
const AIDE =
  "Indiquez d'abord les numéros de votre souche : une ligne est créée par chèque. Complétez ensuite, pour chaque chèque émis, la date, le bénéficiaire, le motif et le montant.";

/** Souche de chèques du responsable ou délégué de société : le même tableau que dans la collecte, rempli directement depuis son
 * menu. Une souche par période (collecte) ; le cabinet la consulte et complète « État des chèques émis ». */
export function SoucheClientPage() {
  const { societeIds } = usePermissions();
  const societeId = societeIds?.[0] ?? "";
  const societe = useSocieteById(societeId);
  const def = TAB_BY_KEY.souche_cheques;
  const gridRef = useRef<CollecteGridHandle>(null);
  const [souches, setSouches] = useState<SoucheCollecte[] | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!societeId) return;
    try {
      const liste = await api.get<SoucheCollecte[]>(`/collectes/souche?societeId=${societeId}`);
      setSouches(liste);
      setChoisie((c) => (c && liste.some((s) => s.collecteId === c) ? c : (liste.find((s) => OUVERTS.includes(s.statut)) ?? liste[0])?.collecteId ?? null));
    } catch {
      setSouches([]);
    }
  }, [societeId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const [ouverture, setOuverture] = useState(false);
  const moisCourant = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const moisCourantMaj = moisCourant.charAt(0).toUpperCase() + moisCourant.slice(1);

  /** Ouvre la souche du mois sans attendre la prochaine collecte du cabinet, puis la sélectionne. */
  async function ouvrirSouche() {
    setOuverture(true);
    try {
      const r = await api.post<{ collecteId: string; periode: string; creee: boolean }>("/collectes/souche", { societeId });
      await charger();
      setChoisie(r.collecteId);
      toast.success(r.creee ? `Souche de ${r.periode} ouverte` : `La souche de ${r.periode} existe déjà`);
    } catch {
      toast.error("La souche n'a pas pu être ouverte.");
    } finally {
      setOuverture(false);
    }
  }

  const boutonOuvrir = (
    <Button type="button" variant="ledger" className="gap-2" disabled={ouverture || souches === null} onClick={() => void ouvrirSouche()}>
      <Plus className="size-4" aria-hidden="true" />
      {ouverture ? "Ouverture…" : `Ouvrir la souche de ${moisCourantMaj}`}
    </Button>
  );

  const souche = souches?.find((s) => s.collecteId === choisie) ?? null;
  const editable = souche ? OUVERTS.includes(souche.statut) : false;

  function majLocale(id: string, patch: Partial<SoucheCollecte>) {
    setSouches((l) => (l ?? []).map((s) => (s.collecteId === id ? { ...s, ...patch } : s)));
  }

  async function preparerTransfert(): Promise<string> {
    const grille = gridRef.current;
    if (grille?.isDirty()) await grille.save();
    const courante = souches?.find((s) => s.collecteId === choisie);
    const morceaux: string[] = [];
    if (!courante || courante.lignes.length === 0) morceaux.push("aucune ligne saisie");
    if (grille && !grille.isComplete()) morceaux.push(grille.incompleteMessage());
    return morceaux.join(" · ");
  }

  return (
    <div>
      <SignatureLedgerBanner
        icon={BookText}
        eyebrow="Votre espace"
        title="Souche de chèques"
        description={`${societe?.raisonSociale ?? "Société"} · les chèques que vous avez émis`}
        action={souches && !souches.some((s) => s.periode.toLowerCase() === moisCourantMaj.toLowerCase()) ? { label: `Ouvrir la souche de ${moisCourantMaj}`, onClick: () => void ouvrirSouche() } : undefined}
        metrics={[
          { label: "Périodes", value: souches?.length ?? 0, icon: BookText, loading: souches === null },
          { label: "Chèques de la période", value: souche?.lignes.length ?? 0, loading: souches === null },
        ]}
      />

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        {souches === null ? (
          <EmptyState title="Chargement…" description="" />
        ) : souches.length === 0 || !souche || !def ? (
          <EmptyState icon={BookText} title="Aucune souche à remplir" description="Ouvrez la souche du mois pour saisir vos chèques, ou attendez que le cabinet l'ouvre avec la prochaine collecte de pièces." action={boutonOuvrir} />
        ) : (
          <>
            {souches.length > 1 && (
              <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5" role="group" aria-label="Période de la souche">
                {souches.map((s) => (
                  <button
                    key={s.collecteId}
                    type="button"
                    aria-pressed={s.collecteId === choisie}
                    onClick={() => setChoisie(s.collecteId)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-[13px] font-semibold",
                      s.collecteId === choisie ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-accent",
                    )}
                  >
                    {s.periode || "Sans période"}
                  </button>
                ))}
              </div>
            )}
            <p className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">{AIDE}</p>
            <div className="p-2 sm:p-3">
              <CollecteGrid
                key={souche.collecteId}
                brouillonCle={`souche:${souche.collecteId}`}
                ref={gridRef}
                def={def}
                lignes={souche.lignes}
                readOnly={!editable}
                sansSuppression
                devise={souche.devise}
                onSave={async (rows) => {
                  const { lignes } = await api.put<{ lignes: CollecteLigne[] }>(`/collectes/${souche.collecteId}/lignes/souche_cheques`, { lignes: rows });
                  majLocale(souche.collecteId, { lignes });
                }}
                workflowActions={
                  <SectionCircuit
                    compact
                    label={def.label}
                    statut={souche.statut}
                    motifRenvoi={souche.motifRenvoi}
                    isClient
                    canArchive={false}
                    preparerTransfert={preparerTransfert}
                    onTransmettre={async (incomplet) => {
                      await api.post(`/collectes/${souche.collecteId}/sections/souche_cheques/transmettre`, { incomplet });
                      majLocale(souche.collecteId, { statut: "transmis" });
                      toast.success("Souche transmise au cabinet");
                    }}
                    onValider={async () => {}}
                    onRenvoyer={async () => {}}
                    onArchiver={async () => {}}
                    onDesarchiver={async () => {}}
                  />
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
