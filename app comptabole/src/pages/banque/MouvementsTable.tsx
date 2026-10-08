import { Link2, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatDate } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/banque";
import { fmtMontant } from "@/lib/stockRecap";
import type { MouvementBancaire, TypeMouvementBancaire } from "@/types";

interface Props {
  societeId: string;
  mouvements: MouvementBancaire[];
  soldes: Map<string, number>;
  /** Vue société : débit et crédit de la banque sont inversés (une entrée en banque est un débit pour la société). */
  vueSociete: boolean;
  lectureSeule: boolean;
  onEdit: (m: MouvementBancaire) => void;
  onDelete: (m: MouvementBancaire) => void;
  onRapprocher: (m: MouvementBancaire) => void;
}

const th = "whitespace-nowrap px-2 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground";
const thNum = `${th} text-right`;
const td = "px-2 py-2 align-middle";
const tdNum = `${td} whitespace-nowrap text-right tabular-nums`;

const TONS: Record<TypeMouvementBancaire, string> = {
  encaissement_client: "bg-success/15 text-success",
  paiement_fournisseur: "bg-warning/20 text-warning",
  frais: "bg-secondary text-muted-foreground",
  credit: "bg-accent/20 text-primary",
  change: "bg-accent/20 text-primary",
  autre: "bg-secondary text-muted-foreground",
};

const montant = (n: number) => (n ? fmtMontant(n) : "—");

/** Mouvements d'un compte : les opérations d'un même N° pièce (opération, TVA, commission, intérêts) sont
 * regroupées, et un paiement fournisseur se rapproche de son règlement. */
export function MouvementsTable({ societeId, mouvements, soldes, vueSociete, lectureSeule, onEdit, onDelete, onRapprocher }: Props) {
  return (
    <div className="overflow-x-auto" data-tour="banque-mouvements">
      <table className="w-full min-w-[64rem] border-collapse text-xs">
        <thead>
          <tr className="border-y border-accent/25 bg-accent/[0.07]">
            <th className={th}>Date op.</th>
            <th className={th}>Valeur</th>
            <th className={th}>Description</th>
            <th className={th}>Réf.</th>
            <th className={th}>N° pièce</th>
            <th className={th}>Type</th>
            <th className={thNum}>{vueSociete ? "Débit société" : "Débit"}</th>
            <th className={thNum}>{vueSociete ? "Crédit société" : "Crédit"}</th>
            <th className={thNum}>Solde</th>
            <th className={th}>Rapprochement</th>
            <th className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {mouvements.map((m, i) => {
            const precedent = mouvements[i - 1];
            const suite = Boolean(m.numPiece) && precedent?.numPiece === m.numPiece;
            const suivant = mouvements[i + 1];
            const finGroupe = !m.numPiece || suivant?.numPiece !== m.numPiece;
            const aRapprocher = m.type === "paiement_fournisseur" && m.debit > 0;
            return (
              <tr
                key={m.id}
                className={cn(
                  "transition-colors hover:bg-accent/[0.05]",
                  finGroupe ? "border-b border-accent/20" : "border-b border-dashed border-accent/10",
                )}
              >
                <td className={cn(td, "whitespace-nowrap")}>{formatDate(m.dateOp)}</td>
                <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{m.dateValeur ? formatDate(m.dateValeur) : "—"}</td>
                <td className={cn(td, "min-w-[16rem]")}>
                  <span className="block font-medium text-foreground">{m.libelle || "—"}</span>
                  {m.details && <span className="block text-[0.7rem] text-muted-foreground">{m.details}</span>}
                  {m.cours && (
                    <span className="block text-[0.7rem] font-medium text-primary">
                      Cours {m.cours.toLocaleString("fr-FR", { maximumFractionDigits: 5 })}
                    </span>
                  )}
                </td>
                <td className={cn(td, "whitespace-nowrap")}>{m.reference || "—"}</td>
                <td className={cn(td, "whitespace-nowrap font-mono text-[0.7rem]", suite && "text-muted-foreground")}>
                  {m.numPiece ? (suite ? "″" : m.numPiece) : "—"}
                </td>
                <td className={td}>
                  <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", TONS[m.type])}>{TYPE_LABELS[m.type]}</span>
                </td>
                <td className={tdNum}>{montant(vueSociete ? m.credit : m.debit)}</td>
                <td className={tdNum}>{montant(vueSociete ? m.debit : m.credit)}</td>
                <td className={cn(tdNum, "font-semibold", (soldes.get(m.id) ?? 0) < 0 && "text-destructive")}>{fmtMontant(soldes.get(m.id) ?? 0)}</td>
                <td className={cn(td, "whitespace-nowrap")}>
                  {m.reglementId ? (
                    <Link
                      to={`/fournisseurs/${societeId}`}
                      className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] font-semibold text-success hover:underline"
                    >
                      <Link2 className="size-3" aria-hidden="true" />
                      Rapproché
                    </Link>
                  ) : aRapprocher && !lectureSeule ? (
                    <button
                      type="button"
                      onClick={() => onRapprocher(m)}
                      className="rounded-md border border-accent/40 px-2 py-0.5 text-[0.7rem] font-medium text-primary hover:bg-accent/10"
                    >
                      Créer le règlement
                    </button>
                  ) : aRapprocher ? (
                    <span className="text-[0.7rem] text-warning">Non rapproché</span>
                  ) : (
                    ""
                  )}
                </td>
                <td className={td}>
                  {!lectureSeule && (
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        aria-label="Modifier ce mouvement"
                        onClick={() => onEdit(m)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Supprimer ce mouvement"
                        onClick={() => onDelete(m)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
