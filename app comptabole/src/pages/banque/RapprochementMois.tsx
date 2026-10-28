import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { aUnEcart, TVA_COMMISSION, type RapprochementMois as Periode } from "@/lib/banqueMois";
import { fmtMontant } from "@/lib/stockRecap";
import { lireNombre } from "@/lib/filtresRecapSociete";
import type { OperationEnCoursBancaire } from "@/types";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const libelleMois = (m: string) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function Chiffre({ libelle, valeur, fort = false, alerte = false }: { libelle: string; valeur: string; fort?: boolean; alerte?: boolean }) {
  return (
    <div>
      <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
      <dd className={cn("m-0 mt-0.5 tabular-nums", fort ? "text-base font-bold text-primary" : "text-sm font-medium text-foreground", alerte && "text-destructive")}>{valeur}</dd>
    </div>
  );
}

interface Props {
  periode: Periode;
  devise: string;
  lectureSeule: boolean;
  onSoldeReel: (soldeReel: number | null) => Promise<void>;
  onAjouterEnCours: (data: { designation: string; debit: number; credit: number }) => Promise<void>;
  onRetirerEnCours: (o: OperationEnCoursBancaire) => Promise<void>;
}

/**
 * Pied de rapprochement d'un mois, comme celui de la feuille du cabinet : solde de départ, totaux, solde calculé, solde réel de la banque
 * (celui du relevé, à saisir), écart à expliquer, opérations en cours (écrites chez la société, pas encore passées en banque) et solde théorique.
 */
export function RapprochementMois({ periode, devise, lectureSeule, onSoldeReel, onAjouterEnCours, onRetirerEnCours }: Props) {
  const [reel, setReel] = useState(periode.soldeReel === null ? "" : String(periode.soldeReel).replace(".", ","));
  const [designation, setDesignation] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  useEffect(() => setReel(periode.soldeReel === null ? "" : String(periode.soldeReel).replace(".", ",")), [periode.mois, periode.soldeReel]);
  const ecart = aUnEcart(periode);
  const nombre = (t: string) => (t.trim() === "" ? 0 : lireNombre(t));
  const aAjouter = designation.trim() !== "" && (nombre(debit) > 0 || nombre(credit) > 0) && !(nombre(debit) > 0 && nombre(credit) > 0) && !Number.isNaN(nombre(debit)) && !Number.isNaN(nombre(credit));
  const monnaie = (n: number) => `${fmtMontant(n)} ${devise}`;

  async function validerReel() {
    const v = reel.trim() === "" ? null : lireNombre(reel);
    if (v !== null && Number.isNaN(v)) return;
    if (v === periode.soldeReel) return;
    await onSoldeReel(v);
  }

  return (
    <section aria-label={`Rapprochement de ${libelleMois(periode.mois)}`} className="border-t-2 border-accent/40 bg-accent/[0.07] px-5 py-4" data-tour="banque-rapprochement">
      <h3 className="mb-3 text-sm font-bold text-primary">Rapprochement de {libelleMois(periode.mois)}</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <Chiffre libelle="Solde de départ" valeur={monnaie(periode.ouverture)} />
        <Chiffre libelle="Total débit" valeur={fmtMontant(periode.totalDebit)} />
        <Chiffre libelle="Total crédit" valeur={fmtMontant(periode.totalCredit)} />
        <Chiffre libelle="Solde calculé" valeur={monnaie(periode.calcule)} fort />
        <div>
          <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <label htmlFor="solde-reel-mois">Solde réel (relevé)</label>
          </dt>
          <dd className="m-0 mt-0.5">
            <Input
              id="solde-reel-mois"
              inputMode="decimal"
              value={reel}
              disabled={lectureSeule}
              placeholder="À saisir"
              onChange={(e) => setReel(e.target.value)}
              onBlur={() => void validerReel()}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="h-8 w-36 text-right text-sm tabular-nums"
            />
          </dd>
        </div>
        <Chiffre libelle="Écart" valeur={periode.ecart === null ? "—" : fmtMontant(periode.ecart)} fort alerte={ecart} />
      </dl>
      {ecart && periode.ecartHorsTva !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Écart à expliquer : si c'est une commission soumise à la TVA de {Math.round((TVA_COMMISSION - 1) * 100)} %, son montant hors taxe serait de{" "}
          <b className="tabular-nums text-foreground">{fmtMontant(periode.ecartHorsTva)}</b>.
        </p>
      )}

      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Opérations en cours</h4>
          <span className="text-xs text-muted-foreground">Écrites chez la société, pas encore passées en banque (point de vue société : débit = entrée attendue, crédit = sortie à venir)</span>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Désignation</th>
              <th className="px-3 py-1.5 text-right font-medium">Débit</th>
              <th className="px-3 py-1.5 text-right font-medium">Crédit</th>
              <th className="w-10 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {periode.enCours.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">Aucune opération en cours ce mois-ci.</td>
              </tr>
            )}
            {periode.enCours.map((o) => (
              <tr key={o.id} className="border-t border-border/70">
                <td className="px-3 py-1.5">{o.designation}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{o.debit ? fmtMontant(o.debit) : "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{o.credit ? fmtMontant(o.credit) : "—"}</td>
                <td className="px-2 py-1 text-right">
                  {!lectureSeule && (
                    <button type="button" aria-label={`Retirer l'opération « ${o.designation} »`} onClick={() => void onRetirerEnCours(o)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!lectureSeule && (
              <tr className="border-t border-border/70 bg-muted/30">
                <td className="px-3 py-1.5">
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Désignation (ex. chèque n° …)" aria-label="Désignation de l'opération en cours" className="h-8 text-xs" />
                </td>
                <td className="px-3 py-1.5"><Input inputMode="decimal" value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="Débit" aria-label="Débit de l'opération en cours" className="h-8 text-right text-xs tabular-nums" /></td>
                <td className="px-3 py-1.5"><Input inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="Crédit" aria-label="Crédit de l'opération en cours" className="h-8 text-right text-xs tabular-nums" /></td>
                <td className="px-2 py-1 text-right">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Ajouter l'opération en cours"
                    disabled={!aAjouter}
                    onClick={async () => {
                      await onAjouterEnCours({ designation: designation.trim(), debit: nombre(debit), credit: nombre(credit) });
                      setDesignation("");
                      setDebit("");
                      setCredit("");
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td className="px-3 py-1.5">Total</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtMontant(periode.enCoursDebit)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtMontant(periode.enCoursCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Solde théorique : {periode.soldeReel === null ? "solde calculé" : "solde réel"} + débits − crédits des opérations en cours</span>
        <b className="text-base tabular-nums text-primary">{monnaie(periode.theorique)}</b>
      </p>
    </section>
  );
}
