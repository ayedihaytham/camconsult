import { Fragment, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronRight, FolderInput, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { ecartDevise, ecartsDeviseTotaux, fmtMontant, fmtQuantiteUnite, recapStock, totauxCote, uniteCommune } from "@/lib/stockRecap";
import { montantCote } from "@/lib/coursStock";
import type { StockLigne, StockMouvement } from "@/types";

type Categorie = "achat" | "vente" | "douane";

interface Props {
  mouvements: StockMouvement[];
  /** Mouvement qui vient d'être enregistré : mis en évidence. */
  nouveauId: string | null;
  /** `${id}-${categorie}` du document en cours de classement. */
  classing: string | null;
  onEdit: (m: StockMouvement) => void;
  onDelete: (m: StockMouvement) => void;
  onPreview: (title: string, dataUrl: string | null) => void;
  onClasser: (m: StockMouvement, categorie: Categorie) => void;
  /** Mouvements dont le n° de facture de vente ou d'achat est déjà utilisé par un autre. */
  doublons?: { vente: ReadonlySet<string>; achat: ReadonlySet<string> };
  /** Monnaie des cours et des montants affichés : dinars (cours de la facture) ou dollars (cours par rapport au dollar). */
  base?: "TND" | "USD";
}

const TITRES: Record<Categorie, string> = {
  achat: "Facture d'achat",
  vente: "Document de vente",
  douane: "Document douanier",
};

/** Largeurs en pourcentage : le tableau occupe exactement la largeur de la page, sans défilement horizontal. */
const LARGEURS = [2.5, 9, 8, 4.5, 6, 7, 8, 9.5, 5.5, 8.5, 4, 5, 8.5, 4, 10];
const NB_COLONNES = LARGEURS.length;

const th = "px-2 py-2.5 text-left text-xs font-semibold leading-tight text-muted-foreground [overflow-wrap:anywhere]";
const thNum = `${th} text-right`;
const td = "px-2 py-2.5 align-middle [overflow-wrap:anywhere]";
const tdNum = `${td} whitespace-nowrap text-right tabular-nums`;
const filet = "border-l-2 border-border";
const etiquette = "text-xs font-medium text-muted-foreground";

const TEINTE = { vente: "bg-primary/[0.06]", achat: "bg-accent/10", douane: "bg-success/10" } as const;

const jour = (d: string | null) => (d ? formatDate(d) : "—");
const coursTexte = (c: number) => (c ? c.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : "—");

function docUrl(m: StockMouvement, c: Categorie) {
  return c === "achat" ? m.achatDocDataUrl : c === "vente" ? m.venteDocDataUrl : m.douaneDocDataUrl;
}

/** Bouton de pièce jointe d'une facture : ouvre l'aperçu, grisé quand il n'y a pas de pièce. */
function Piece({ m, categorie, onPreview }: { m: StockMouvement; categorie: Categorie; onPreview: Props["onPreview"] }) {
  const url = docUrl(m, categorie);
  if (!url) return <span className="inline-grid size-7 place-items-center text-muted-foreground/40" title="Aucune pièce jointe"><Paperclip className="size-3.5" aria-hidden="true" /></span>;
  return (
    <button
      type="button"
      title={`Voir : ${TITRES[categorie]}`}
      aria-label={`Voir : ${TITRES[categorie]}`}
      onClick={(e) => { e.stopPropagation(); onPreview(TITRES[categorie], url); }}
      className="inline-grid size-7 place-items-center rounded-md border border-border text-primary hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Paperclip className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/** Une ligne d'un côté (vente ou achat) d'un mouvement : côté, date, n° de facture, tiers, quantité, montant en devise, devise, cours, montant TND, pièce. */
function CoteCellules({ m, cote, onPreview, doublon, base }: { m: StockMouvement; cote: "vente" | "achat"; onPreview: Props["onPreview"]; doublon: boolean; base: "TND" | "USD" }) {
  const v = cote === "vente";
  const lignes = v ? m.venteLignes : m.achatLignes;
  const numero = v ? m.venteNumFacture : m.achatNumFacture;
  const t = totauxCote(lignes);
  const vide = lignes.length === 0;
  const fond = TEINTE[cote];
  const montant = montantCote(lignes, v ? m.venteCoursUsd : m.achatCoursUsd, base);
  return (
    <>
      <td className={cn(td, fond, v ? "shadow-[inset_4px_0_0_hsl(var(--primary))]" : "shadow-[inset_4px_0_0_hsl(var(--accent))]")}>
        <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", v ? "bg-primary/15 text-primary" : "bg-accent/30 text-accent-foreground")}>{v ? "Vente" : "Achat"}</span>
      </td>
      <td className={cn(td, fond, "whitespace-nowrap tabular-nums")}>{jour(v ? m.venteDate : m.achatDate)}</td>
      <td className={cn(td, fond, "whitespace-nowrap tabular-nums text-[0.78rem] text-foreground/80")} title={doublon ? `${numero} : ce numéro de facture est déjà utilisé par un autre mouvement` : numero}>
        {doublon ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-destructive/15 px-1 font-semibold text-destructive">
            <AlertTriangle className="size-3 shrink-0" aria-label="Numéro de facture en doublon" />
            {numero}
          </span>
        ) : (numero || "—")}
      </td>
      <td className={cn(td, fond, "font-medium text-foreground")}>{(v ? m.client : m.fournisseur) || "—"}</td>
      <td className={cn(tdNum, fond)}>{vide ? "—" : fmtQuantiteUnite(t.quantite, uniteCommune(lignes))}</td>
      <td className={cn(tdNum, fond)}>{t.montantDevise ? fmtMontant(t.montantDevise) : "—"}</td>
      <td className={cn(td, fond, "text-muted-foreground")}>{t.montantDevise ? (v ? m.venteDevise : m.achatDevise) : "—"}</td>
      <td className={cn(tdNum, fond)}>{coursTexte(base === "USD" ? (v ? m.venteCoursUsd : m.achatCoursUsd) ?? 0 : v ? m.venteCours : m.achatCours)}</td>
      <td className={cn(tdNum, fond, "font-semibold text-primary")}>{montant ? fmtMontant(montant) : "—"}</td>
      <td className={cn(td, fond, "text-center")}><Piece m={m} categorie={cote} onPreview={onPreview} /></td>
    </>
  );
}

/** Récapitulatif des opérations de stock : chaque mouvement occupe deux lignes aux colonnes alignées, une pour la vente et une pour
 * l'achat, avec la douane à droite ; le détail (produits, déclaration, pièces, actions) s'ouvre sous le mouvement. Le tableau
 * occupe la largeur de la page, sans défilement horizontal ; sur petit écran, chaque mouvement devient une carte. */
export function StockRecapTable({ mouvements, nouveauId, classing, onEdit, onDelete, onPreview, onClasser, doublons, base = "TND" }: Props) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const total = recapStock(mouvements);
  const ecarts = ecartsDeviseTotaux(mouvements);
  const marge = mouvements.reduce((s, m) => s + montantCote(m.venteLignes, m.venteCoursUsd, base) - montantCote(m.achatLignes, m.achatCoursUsd, base), 0);

  const basculer = (id: string) =>
    setOuverts((s) => {
      const suite = new Set(s);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });

  return (
    <div data-tour="stock-register">
      <div className="hidden xl:block">
        <table className="w-full table-fixed border-collapse text-[0.8125rem]">
          <colgroup>
            {LARGEURS.map((l, i) => <col key={i} style={{ width: `${l}%` }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className={th}>N°</th>
              <th scope="col" className={th}>Mouvement</th>
              <th scope="col" className={th}>N° mouvement</th>
              <th scope="col" className={thNum}>Écart</th>
              <th scope="col" className={th}>Côté</th>
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={th}>N° facture</th>
              <th scope="col" className={th}>Client / Fournisseur</th>
              <th scope="col" className={thNum}>Qté</th>
              <th scope="col" className={thNum}>En devise</th>
              <th scope="col" className={th}>Devise</th>
              <th scope="col" className={thNum}>{base === "USD" ? "Cours USD" : "Cours"}</th>
              <th scope="col" className={thNum}>{base === "USD" ? "MT USD" : "MT TND"}</th>
              <th scope="col" className={cn(th, "text-center")}>Pièce</th>
              <th scope="col" className={cn(th, TEINTE.douane, filet)}>Douane</th>
            </tr>
          </thead>
          <tbody>
            {mouvements.map((m, index) => {
              const ouvert = ouverts.has(m.id);
              const surbrillance = nouveauId === m.id;
              return (
                <Fragment key={m.id}>
                  <tr
                    id={`mouvement-${m.id}`}
                    data-mouvement={m.id}
                    data-nouveau={surbrillance || undefined}
                    onClick={() => basculer(m.id)}
                    className={cn("cursor-pointer border-t-2 border-border", surbrillance && "outline outline-2 -outline-offset-2 outline-accent")}
                  >
                    <td rowSpan={2} className={cn(td, "text-muted-foreground tabular-nums")}>{index + 1}</td>
                    <td rowSpan={2} className={td}>
                      <div className="flex items-start gap-1">
                        <button
                          type="button"
                          aria-expanded={ouvert}
                          aria-label={ouvert ? "Masquer le détail" : "Afficher le détail"}
                          onClick={(e) => { e.stopPropagation(); basculer(m.id); }}
                          className="mt-px grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ouvert && "rotate-90")} />
                        </button>
                        <p className="min-w-0 font-medium text-primary">{m.natureMarchandise || "Mouvement sans nature"}</p>
                      </div>
                    </td>
                    <td rowSpan={2} className={cn(td, "whitespace-nowrap tabular-nums font-medium text-primary")} title="Numéro de la facture de vente">{m.venteNumFacture || "—"}</td>
                    <td rowSpan={2} className={tdNum}>
                      <span className={cn("inline-grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs font-semibold", m.ecart !== 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                        {fmtQuantiteUnite(m.ecart, m.ecartUnite)}
                      </span>
                    </td>
                    <CoteCellules m={m} cote="vente" onPreview={onPreview} doublon={Boolean(doublons?.vente.has(m.id))} base={base} />
                    <td rowSpan={2} className={cn(td, TEINTE.douane, filet, "text-xs leading-snug")}>
                      {m.douaneNumDeclaration ? <p className="text-[0.8125rem] font-semibold tabular-nums text-primary">{m.douaneNumDeclaration}</p> : <p className="text-muted-foreground">—</p>}
                      {(m.douaneDate || m.douaneTypeDeclaration) && <p className="text-muted-foreground">{m.douaneDate ? formatDate(m.douaneDate) : ""}{m.douaneTypeDeclaration ? ` · type ${m.douaneTypeDeclaration}` : ""}</p>}
                      {m.douaneTauxChange ? <p className="text-muted-foreground">Taux {m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 })}</p> : null}
                      {m.douaneValeurTnd ? <p className="text-muted-foreground">Valeur {fmtMontant(m.douaneValeurTnd)}</p> : null}
                      {m.douanePtfn ? <p className="text-muted-foreground">PTFN {fmtMontant(m.douanePtfn)}</p> : null}
                      <div className="mt-1"><Piece m={m} categorie="douane" onPreview={onPreview} /></div>
                    </td>
                  </tr>
                  <tr data-mouvement={m.id} onClick={() => basculer(m.id)} className={cn("cursor-pointer", surbrillance && "outline outline-2 -outline-offset-2 outline-accent")}>
                    <CoteCellules m={m} cote="achat" onPreview={onPreview} doublon={Boolean(doublons?.achat.has(m.id))} base={base} />
                  </tr>
                  {ouvert && (
                    <tr className="border-t border-border bg-secondary/30">
                      <td colSpan={NB_COLONNES} className="p-0">
                        <div className="px-5 py-4 pl-10">
                          <DetailMouvement m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} onEdit={onEdit} onDelete={onDelete} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary bg-muted/40 font-semibold text-primary">
              <td className={td} colSpan={3}>
                <span title={`${total.mouvements} mouvement${total.mouvements > 1 ? "s" : ""}`}>Total ({total.mouvements})</span>
              </td>
              <td className={cn(tdNum, total.ecart !== 0 && "text-destructive")}>{fmtQuantiteUnite(total.ecart, total.unite)}</td>
              <td className={cn(td, "text-right font-semibold")} colSpan={5}>
                Vente : {fmtQuantiteUnite(total.vente.quantite, total.unite)} · Achat : {fmtQuantiteUnite(total.achat.quantite, total.unite)}
                {ecarts.length > 0 && <> · Vente − achat : {ecarts.map((e) => (
                  <span key={e.devise} className={cn("mr-1 tabular-nums", e.valeur !== 0 && "text-destructive")}>{fmtMontant(e.valeur)} {e.devise}</span>
                ))}</>}
              </td>
              <td className={cn(tdNum, marge >= 0 ? "text-success" : "text-destructive")} colSpan={4}>Marge {base} {marge >= 0 ? "+" : ""}{fmtMontant(marge)}</td>
              <td className={td} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="divide-y divide-border xl:hidden" aria-label="Mouvements de stock">
        {mouvements.map((m, index) => {
          const ouvert = ouverts.has(m.id);
          const v = totauxCote(m.venteLignes);
          const a = totauxCote(m.achatLignes);
          return (
            <li key={m.id} id={`mouvement-carte-${m.id}`} className={cn("px-4 py-3", nouveauId === m.id && "bg-accent/15")}>
              <button type="button" aria-expanded={ouvert} onClick={() => basculer(m.id)} className="flex w-full items-start gap-2 text-left">
                <ChevronRight className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", ouvert && "rotate-90")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-primary">{index + 1}. {m.natureMarchandise || "Mouvement sans nature"}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Vente · {m.client || "—"} · {v.montantTnd ? fmtMontant(v.montantTnd) : "—"} TND</span>
                  <span className="block text-xs text-muted-foreground">Achat · {m.fournisseur || "—"} · {a.montantTnd ? fmtMontant(a.montantTnd) : "—"} TND</span>
                </span>
                <span className={cn("shrink-0 text-xs font-bold tabular-nums", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>Écart {fmtQuantiteUnite(m.ecart, m.ecartUnite)}</span>
              </button>
              {ouvert && <div className="mt-3"><DetailMouvement m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} onEdit={onEdit} onDelete={onDelete} /></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Fait({ label, children, large = false }: { label: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={cn("min-w-0", large && "sm:col-span-2")}>
      <dt className={etiquette}>{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children || "—"}</dd>
    </div>
  );
}

function LignesProduits({ lignes, devise }: { lignes: StockLigne[]; devise: string }) {
  const total = totauxCote(lignes);
  const unite = uniteCommune(lignes);
  if (lignes.length === 0) return <p className="text-sm text-muted-foreground">Aucun produit.</p>;
  return (
    <table className="w-full table-fixed text-xs">
      <colgroup>
        {[34, 12, 14, 20, 20].map((l, i) => <col key={i} style={{ width: `${l}%` }} />)}
      </colgroup>
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 pr-2 text-left font-semibold">Produit</th>
          <th className="px-1 py-1 text-right font-semibold">Qté</th>
          <th className="px-1 py-1 text-right font-semibold">P.U.</th>
          <th className="px-1 py-1 text-right font-semibold" title={`Montant en ${devise}`}>Montant</th>
          <th className="py-1 pl-1 text-right font-semibold">TND</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={l.id ?? i} className="border-t border-border align-top">
            <td className="py-1.5 pr-2 text-foreground [overflow-wrap:anywhere]">{l.designation || "(sans désignation)"}</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{fmtQuantiteUnite(l.quantite, l.unite ?? "")}</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{l.prixUnitaire ? fmtMontant(l.prixUnitaire) : "—"}</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{l.montantDevise ? fmtMontant(l.montantDevise) : "—"}</td>
            <td className="whitespace-nowrap py-1.5 pl-1 text-right font-semibold tabular-nums">{l.montantTnd ? fmtMontant(l.montantTnd) : "—"}</td>
          </tr>
        ))}
      </tbody>
      {lignes.length > 1 && (
        <tfoot>
          <tr className="border-t-2 border-border font-semibold text-primary">
            <td className="py-1.5 pr-2">Total</td>
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{fmtQuantiteUnite(total.quantite, unite)}</td>
            <td />
            <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">{fmtMontant(total.montantDevise)}</td>
            <td className="whitespace-nowrap py-1.5 pl-1 text-right tabular-nums">{total.montantTnd ? fmtMontant(total.montantTnd) : "—"}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** Pièce jointe d'une carte de détail : l'aperçu, et le classement dans Structuration. */
function PieceCarte({ m, categorie, classing, onPreview, onClasser }: { m: StockMouvement; categorie: Categorie; classing: string | null; onPreview: Props["onPreview"]; onClasser: Props["onClasser"] }) {
  const url = docUrl(m, categorie);
  if (!url) return <span className="text-xs text-muted-foreground">Aucune pièce jointe</span>;
  return (
    <span className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-border bg-secondary/40 text-xs">
      <button type="button" onClick={() => onPreview(TITRES[categorie], url)} className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-primary hover:bg-accent/10">
        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
        {TITRES[categorie]}
      </button>
      <button
        type="button"
        disabled={classing === `${m.id}-${categorie}`}
        onClick={() => onClasser(m, categorie)}
        title="Classer dans Structuration"
        aria-label={`Classer dans Structuration : ${TITRES[categorie]}`}
        className="border-l border-border px-2.5 py-1.5 text-muted-foreground hover:bg-accent/10 hover:text-primary disabled:opacity-50"
      >
        <FolderInput className={cn("h-3.5 w-3.5", classing === `${m.id}-${categorie}` && "animate-pulse")} />
      </button>
    </span>
  );
}

function Carte({ titre, resume, piece, children, className }: { titre: string; resume?: string; piece?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card p-4", className)}>
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-primary">{titre}</h3>
          {resume && <p className="text-xs text-muted-foreground">{resume}</p>}
        </div>
        {piece}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CarteFacture({ m, cote, classing, onPreview, onClasser }: { m: StockMouvement; cote: "vente" | "achat"; classing: string | null; onPreview: Props["onPreview"]; onClasser: Props["onClasser"] }) {
  const v = cote === "vente";
  const tiers = v ? m.client : m.fournisseur;
  const date = v ? m.venteDate : m.achatDate;
  const numero = v ? m.venteNumFacture : m.achatNumFacture;
  const devise = v ? m.venteDevise : m.achatDevise;
  const cours = v ? m.venteCours : m.achatCours;
  const lignes = v ? m.venteLignes : m.achatLignes;
  const vide = !tiers && !date && !numero && lignes.length === 0;
  const resume = vide ? undefined : [date ? formatDate(date) : "", numero ? `facture ${numero}` : "", tiers, cours ? `${devise} · cours ${cours.toLocaleString("fr-FR", { maximumFractionDigits: 5 })}` : devise].filter(Boolean).join(" · ");
  return (
    <Carte titre={v ? "Vente" : "Achat"} resume={resume} piece={<PieceCarte m={m} categorie={cote} classing={classing} onPreview={onPreview} onClasser={onClasser} />}>
      {vide ? <p className="text-sm text-muted-foreground">Rien de renseigné.</p> : <LignesProduits lignes={lignes} devise={devise} />}
    </Carte>
  );
}

function CarteDouane({ m, classing, onPreview, onClasser }: { m: StockMouvement; classing: string | null; onPreview: Props["onPreview"]; onClasser: Props["onClasser"] }) {
  const rien = !m.douaneNumDeclaration && !m.douaneDate && !m.douaneValeurTnd && !m.douanePtfn && !m.douaneExportateur && !m.douaneImportateur;
  const resume = [m.douaneNumDeclaration ? `Déclaration ${m.douaneNumDeclaration}` : "", m.douaneDate ? formatDate(m.douaneDate) : ""].filter(Boolean).join(" · ");
  return (
    <Carte titre="Douane" resume={resume || undefined} className="lg:col-span-2" piece={<PieceCarte m={m} categorie="douane" classing={classing} onPreview={onPreview} onClasser={onClasser} />}>
      {rien ? (
        <p className="text-sm text-muted-foreground">Aucune déclaration douanière.</p>
      ) : (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          <Fait label="Type de déclaration">{m.douaneTypeDeclaration}</Fait>
          <Fait label="Taux de change">{m.douaneTauxChange ? m.douaneTauxChange.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : ""}</Fait>
          <Fait label="Valeur en douane (TND)">{m.douaneValeurTnd ? fmtMontant(m.douaneValeurTnd) : ""}</Fait>
          <Fait label="PTFN">{m.douanePtfn ? fmtMontant(m.douanePtfn) : ""}</Fait>
          <Fait label="Exportateur">{m.douaneExportateur}</Fait>
          <Fait label="Importateur">{m.douaneImportateur}</Fait>
        </dl>
      )}
    </Carte>
  );
}

export function DetailMouvement({ m, classing, onPreview, onClasser, onEdit, onDelete }: {
  m: StockMouvement;
  classing: string | null;
  onPreview: Props["onPreview"];
  onClasser: Props["onClasser"];
  onEdit: Props["onEdit"];
  onDelete: Props["onDelete"];
}) {
  // Un détail par produit n'a de sens que si une facture en liste plusieurs : avec un seul
  // produit de chaque côté, des désignations rédigées différemment donneraient un écart
  // « +370 / −370 » trompeur alors que le total est nul.
  const detailParProduit = m.achatLignes.length > 1 || m.venteLignes.length > 1;
  const ecart = ecartDevise(m);
  const marge = totauxCote(m.venteLignes).montantTnd - totauxCote(m.achatLignes).montantTnd;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CarteFacture m={m} cote="vente" classing={classing} onPreview={onPreview} onClasser={onClasser} />
      <CarteFacture m={m} cote="achat" classing={classing} onPreview={onPreview} onClasser={onClasser} />
      <CarteDouane m={m} classing={classing} onPreview={onPreview} onClasser={onClasser} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm lg:col-span-2">
        <span>
          <span className={etiquette}>Écart achat − vente </span>
          <span className={cn("font-bold tabular-nums", m.ecart !== 0 ? "text-destructive" : "text-foreground")}>{fmtQuantiteUnite(m.ecart, m.ecartUnite)}</span>
        </span>
        {ecart && (
          <span>
            <span className={etiquette}>Vente − achat (en devise) </span>
            <span className={cn("font-bold tabular-nums", ecart.valeur !== 0 ? "text-destructive" : "text-foreground")}>{fmtMontant(ecart.valeur)} {ecart.devise}</span>
          </span>
        )}
        {(m.venteLignes.length > 0 || m.achatLignes.length > 0) && (
          <span>
            <span className={etiquette}>Marge TND </span>
            <span className={cn("font-bold tabular-nums", marge >= 0 ? "text-success" : "text-destructive")}>{fmtMontant(marge)}</span>
          </span>
        )}
        {detailParProduit &&
          m.ecartParDesignation.map((e) => (
            <span key={e.designation} className="text-xs text-muted-foreground">
              {e.designation}{" "}
              <span className={cn("font-semibold", e.ecart !== 0 ? "text-destructive" : "text-foreground")}>{fmtQuantiteUnite(e.ecart, m.ecartUnite)}</span>
            </span>
          ))}
        {m.note && <span className="text-xs text-muted-foreground">Note : {m.note}</span>}
        <span className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => onEdit(m)}>Modifier</Button>
          <Button type="button" variant="outline" size="sm" className="min-h-9 text-destructive hover:text-destructive" onClick={() => onDelete(m)}>Supprimer</Button>
        </span>
      </div>
    </div>
  );
}
