import { Fragment } from "react";
import { AlertTriangle, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { anomalieReglement, MODE_LABELS, type LigneEtat } from "@/lib/fournisseurs";
import { fmtMontant, fmtQuantite } from "@/lib/stockRecap";
import type { FactureFournisseur, ReglementFournisseur } from "@/types";

interface Props {
  lignes: LigneEtat[];
  /** Factures de la société : sert à repérer un règlement daté avant sa facture. */
  factures: FactureFournisseur[];
  lectureSeule: boolean;
  onEditReglement: (r: ReglementFournisseur) => void;
  onDeleteReglement: (r: ReglementFournisseur) => void;
  onSuivi: (f: FactureFournisseur) => void;
}

const th = "whitespace-nowrap px-2 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";
const thNum = `${th} text-right`;
const td = "whitespace-nowrap px-2 py-2 align-middle";
const tdNum = `${td} text-right tabular-nums`;
const groupe = "border-l border-accent/30";

const montant = (n: number) => (n ? fmtMontant(n) : "—");

/** État d'un fournisseur : chaque facture d'achat du stock avec son règlement (cellules fusionnées quand un
 * règlement couvre plusieurs factures), puis la vente et la douane liées et le suivi proforma / chargement. */
export function FournisseurEtatTable({ lignes, factures, lectureSeule, onEditReglement, onDeleteReglement, onSuivi }: Props) {
  return (
    <div className="overflow-x-auto" data-tour="fournisseurs-etat">
      <table className="w-full min-w-[78rem] border-collapse text-xs">
        <thead>
          <tr className="border-y border-accent/25 bg-accent/[0.07]">
            <th colSpan={8} className={`${th} text-primary`}>Facture d'achat</th>
            <th colSpan={7} className={`${th} ${groupe} text-primary`}>Règlement</th>
            <th colSpan={2} className={`${th} ${groupe} text-primary`}>Liens</th>
            <th colSpan={2} className={`${th} ${groupe} text-primary`}>Suivi</th>
          </tr>
          <tr className="border-b border-accent/25 bg-accent/[0.04]">
            <th className={th}>N° facture</th>
            <th className={th}>Date</th>
            <th className={thNum}>Qté</th>
            <th className={th}>Désignation</th>
            <th className={thNum}>P.U</th>
            <th className={thNum}>Montant</th>
            <th className={th}>Devise</th>
            <th className={thNum}>Réglé / solde</th>
            <th className={`${th} ${groupe}`}>Date</th>
            <th className={th}>Mode · réf.</th>
            <th className={th}>N° RS</th>
            <th className={thNum}>RS</th>
            <th className={thNum}>Viré</th>
            <th className={th}>Banque</th>
            <th className={th}>
              <span className="sr-only">Actions du règlement</span>
            </th>
            <th className={`${th} ${groupe}`}>Fact. vente</th>
            <th className={th}>N° déclaration</th>
            <th className={`${th} ${groupe}`}>Proforma · chargement</th>
            <th className={th}>
              <span className="sr-only">Suivi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const f = l.facture;
            const r = l.reglement;
            const fin = i === lignes.length - 1 || lignes[i + 1].debutGroupe;
            const anomalie = r && l.debutGroupe ? anomalieReglement(r, factures) : null;
            const s = f.suivi;
            return (
              <tr key={`${f.id}-${r?.id ?? "solde"}`} className={cn("transition-colors hover:bg-accent/[0.05]", fin && "border-b border-accent/20")}>
                <td className={`${td} font-mono text-[0.7rem]`}>{f.numFacture || "—"}</td>
                <td className={td}>{f.date ? formatDate(f.date) : "—"}</td>
                <td className={tdNum}>{f.quantite ? fmtQuantite(f.quantite) : "—"}</td>
                <td className={cn(td, "max-w-[14rem] truncate")} title={f.designation}>{f.designation || "—"}</td>
                <td className={tdNum}>{montant(f.prixUnitaire)}</td>
                <td className={tdNum}>{montant(f.montant)}</td>
                <td className={cn(td, "text-muted-foreground")}>{f.devise}</td>
                <td className={cn(tdNum, !r && "font-semibold text-destructive")} title={r ? "Montant de cette facture couvert par le règlement" : "Reste à régler"}>
                  {fmtMontant(l.montant)}
                </td>

                {r && l.debutGroupe ? (
                  <>
                    <td rowSpan={l.rang} className={`${td} ${groupe} border-b border-accent/20 align-middle`}>
                      <span className="inline-flex items-center gap-1">
                        {r.date ? formatDate(r.date) : "—"}
                        {anomalie && <AlertTriangle className="size-3.5 text-warning" aria-label={anomalie} />}
                      </span>
                    </td>
                    <td rowSpan={l.rang} className={`${td} border-b border-accent/20`}>
                      {MODE_LABELS[r.mode]}
                      {r.reference && <span className="block font-mono text-[0.7rem] text-muted-foreground">{r.reference}</span>}
                    </td>
                    <td rowSpan={l.rang} className={`${td} border-b border-accent/20 font-mono text-[0.7rem]`}>{r.rsNumero || "—"}</td>
                    <td rowSpan={l.rang} className={`${tdNum} border-b border-accent/20`} title={r.rsTaux ? `${r.rsTaux} %` : undefined}>{montant(r.rsMontant)}</td>
                    <td rowSpan={l.rang} className={`${tdNum} border-b border-accent/20 font-semibold text-primary`}>
                      {fmtMontant(r.vire)}
                      {r.devise !== "TND" && r.cours > 0 && (
                        <span className="block text-[0.65rem] font-normal text-muted-foreground">≈ {fmtMontant(r.vire * r.cours)} TND</span>
                      )}
                    </td>
                    <td rowSpan={l.rang} className={`${td} border-b border-accent/20`}>{r.banque || "—"}</td>
                    <td rowSpan={l.rang} className={`${td} border-b border-accent/20`}>
                      {!lectureSeule && (
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            aria-label="Modifier ce règlement"
                            onClick={() => onEditReglement(r)}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Supprimer ce règlement"
                            onClick={() => onDeleteReglement(r)}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </>
                ) : !r ? (
                  <Fragment>
                    <td colSpan={7} className={`${td} ${groupe} italic text-muted-foreground`}>Non réglé</td>
                  </Fragment>
                ) : null}

                <td className={`${td} ${groupe} font-mono text-[0.7rem]`}>{f.venteNumFacture || "—"}</td>
                <td className={`${td} font-mono text-[0.7rem]`}>{f.douaneNumDeclaration || "—"}</td>
                <td className={`${td} ${groupe}`}>
                  {s.numProforma || s.etatChargement || s.numTitre || s.vuPasse ? (
                    <span className="block max-w-[13rem] truncate" title={[s.numProforma && `Proforma ${s.numProforma}`, s.etatProforma, s.etatChargement, s.numTitre && `Titre ${s.numTitre}`, s.vuPasse && `Vu passé ${s.vuPasse}`].filter(Boolean).join(" · ")}>
                      {[s.numProforma && `Pro ${s.numProforma}`, s.etatChargement, s.vuPasse && `Vu ${s.vuPasse}`].filter(Boolean).join(" · ") || "—"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={td}>
                  {!lectureSeule && (
                    <button
                      type="button"
                      aria-label={`Suivi de la facture ${f.numFacture || "sans numéro"}`}
                      onClick={() => onSuivi(f)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <ClipboardList className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
