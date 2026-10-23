import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, FileText, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { download } from "@/lib/export";
import { fichierConverti, type FormatSortie } from "@/lib/conversionSortie";
import { COMPTE_BANQUE, ecrituresDepuisReleve, texteEcritures } from "@/lib/ecrituresReleve";
import {
  modeDePdf,
  classeurExcel,
  feuillesDePdf,
  lireFichierPdf,
  nombreDeCaracteres,
  type PdfTextItem,
} from "@/lib/pdfToTables";
import { texteDepuisFeuilles } from "@/lib/texteBrut";
import { cn } from "@/lib/utils";
import { TelechargerTout } from "./TelechargerTout";
import { ZoneDepot } from "./ZoneDepot";
import { useIdentiteCabinet } from "./useIdentiteCabinet";
import type { StatsConversion } from "./types";

type Mode = "pdf" | "both" | "xls";

interface PdfItem {
  id: string;
  file: File;
  name: string;
  baseName: string;
  status: "cours" | "ok" | "erreur";
  detail: string;
  /** Texte positionné de chaque page : permet de recalculer le tableau quand une option change. */
  pages: PdfTextItem[][];
  pdfUrl: string | null;
}

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PARAMETRES_APERCU = "#navpanes=0&view=FitH";
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
/** Formats du téléchargement groupé de ce sens : l'Excel d'abord, puis le PDF et le texte brut. */
const FORMATS_PDF_VERS_EXCEL: { valeur: FormatSortie; nom: string }[] = [{ valeur: "xlsx", nom: "Excel" }, { valeur: "pdf", nom: "PDF" }, { valeur: "txt", nom: "Texte brut (.txt)" }];

/** Conversion PDF vers Excel ou texte : lecture du texte du PDF dans le navigateur, reconstruction des lignes et
 * colonnes d'après la position du texte, puis export .xlsx ou .txt. Un PDF scanné (image) n'a pas de texte : il
 * est refusé avec un message clair plutôt que converti en classeur vide. */
export function PdfVersExcel({ onStats }: { onStats: (s: StatsConversion) => void }) {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [mode, setMode] = useState<Mode>("both");
  const [nombres, setNombres] = useState(true);
  const [uneSeuleFeuille, setUneSeuleFeuille] = useState(false);
  const [tableauSeul, setTableauSeul] = useState(true);
  const [compte, setCompte] = useState(COMPTE_BANQUE);
  const [formatGroupe, setFormatGroupe] = useState<FormatSortie>("xlsx");
  const { logo, cabinet } = useIdentiteCabinet();
  const occupe = items.some((i) => i.status === "cours");

  // Les adresses temporaires des PDF d'origine vivent tant que la page est ouverte, puis sont libérées.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    const ok = items.filter((i) => i.status === "ok");
    onStats({ fichiers: items.length, convertis: ok.length, erreurs: items.filter((i) => i.status === "erreur").length, elements: ok.reduce((n, i) => n + i.pages.length, 0), libelleElements: "Pages lues" });
  }, [items, onStats]);

  const options = useMemo(() => ({ nombres, uneSeuleFeuille, tableauSeul }), [nombres, uneSeuleFeuille, tableauSeul]);
  const active = items.find((i) => i.id === activeId && i.status === "ok") ?? null;
  const feuilles = useMemo(() => (active ? feuillesDePdf(active.pages, options) : []), [active, options]);
  const feuille = feuilles[Math.min(activeSheet, Math.max(0, feuilles.length - 1))] ?? null;

  /** Version texte du relevé converti : les écritures (deux lignes par mouvement), recalculée quand le tableau ou le compte change. */
  const ecritures = useMemo(() => (tableauSeul && feuilles[0] ? ecrituresDepuisReleve(feuilles[0].rows, compte.trim() || COMPTE_BANQUE) : null), [tableauSeul, feuilles, compte]);
  const ecrituresTexte = useMemo(() => (ecritures ? texteEcritures(ecritures) : null), [ecritures]);

  async function convertir(fichiers: File[]) {
    const nouveaux: PdfItem[] = fichiers.map((file) => ({
      id: crypto.randomUUID(), file, name: file.name, baseName: file.name.replace(/\.pdf$/i, ""), status: "cours", detail: "Lecture du PDF…", pages: [], pdfUrl: null,
    }));
    setItems((prev) => [...nouveaux, ...prev]);
    let premier: string | null = null;
    let echecs = 0;
    for (const n of nouveaux) {
      let maj: Partial<PdfItem>;
      try {
        const pages = await lireFichierPdf(n.file);
        if (nombreDeCaracteres(pages) === 0) maj = { status: "erreur", detail: "PDF scanné (image) : il ne contient pas de texte à extraire" };
        else {
          const pdfUrl = URL.createObjectURL(n.file);
          urlsRef.current.push(pdfUrl);
          maj = { status: "ok", pages, pdfUrl, detail: `${pluriel(pages.length, "page")} lue${pages.length > 1 ? "s" : ""}` };
        }
      } catch {
        maj = { status: "erreur", detail: "Fichier illisible — PDF protégé ou endommagé" };
      }
      if (maj.status === "ok") premier ??= n.id;
      else echecs++;
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, ...maj } : i)));
    }
    if (premier) {
      setActiveId(premier);
      setActiveSheet(0);
    }
    if (echecs > 0) toast.error(`${pluriel(echecs, "fichier")} non converti${echecs > 1 ? "s" : ""}`);
  }

  function reessayer(item: PdfItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    void convertir([item.file]);
  }

  function retirer(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function telecharger(item: PdfItem) {
    const f = feuillesDePdf(item.pages, options);
    if (f.length === 0) {
      toast.error("Aucun tableau à enregistrer");
      return;
    }
    try {
      download(new Blob([await classeurExcel(f)], { type: MIME_XLSX }), `${item.baseName}.xlsx`);
    } catch {
      toast.error("Excel impossible");
    }
  }

  /** Texte brut du PDF : tout le contenu lu (pas seulement les mouvements bancaires), colonnes séparées par une tabulation. */
  function telechargerTexte(item: PdfItem) {
    const f = feuillesDePdf(item.pages, { ...options, tableauSeul: false });
    if (f.length === 0) {
      toast.error("Aucun texte à enregistrer");
      return;
    }
    download(new Blob([texteDepuisFeuilles(f)], { type: "text/plain;charset=utf-8" }), `${item.baseName}.txt`);
  }

  /** Le même contenu (tableaux, ou document entier) mis en page en PDF aux couleurs du cabinet. */
  async function telechargerPdf(item: PdfItem) {
    const f = feuillesDePdf(item.pages, options);
    if (f.length === 0) {
      toast.error("Aucun tableau à enregistrer");
      return;
    }
    try {
      const { blob, nom } = await fichierConverti("pdf", f, item.baseName, { identite: { logo, cabinet }, unite: tableauSeul ? "tableau" : "feuille" });
      download(blob, nom);
    } catch {
      toast.error("Le PDF n'a pas pu être créé");
    }
  }

  async function telechargerFormat(item: PdfItem, format: FormatSortie) {
    if (format === "xlsx") await telecharger(item);
    else if (format === "pdf") await telechargerPdf(item);
    else telechargerTexte(item);
  }

  async function toutTelecharger() {
    for (const p of items.filter((i) => i.status === "ok")) await telechargerFormat(p, formatGroupe);
  }

  function telechargerEcritures(item: PdfItem) {
    const f = feuillesDePdf(item.pages, { ...options, tableauSeul: true });
    const lignes = f[0] ? ecrituresDepuisReleve(f[0].rows, compte.trim() || COMPTE_BANQUE) : null;
    if (!lignes) {
      toast.error("Aucun mouvement bancaire reconnu : le fichier d'écritures n'a pas pu être créé");
      return;
    }
    download(new Blob([texteEcritures(lignes)], { type: "text/plain;charset=utf-8" }), `${item.baseName}-ecritures.txt`);
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
      <div className="grid min-w-0 gap-4">
        <LedgerSheet>
          <div className="border-b border-border px-[18px] py-3">
            <h2 className="text-[0.86rem] font-bold text-foreground">Fichiers à convertir</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Fonctionne avec les PDF qui contiennent du texte (relevés, balances, états) ; un PDF scanné n'est pas lisible.</p>
          </div>
          <div className="p-[18px]">
            <ZoneDepot accept=".pdf,application/pdf" extensions={["pdf"]} types=".pdf" occupe={occupe} libelleOccupe="Lecture en cours…" onFiles={(f) => void convertir(f)} />
          </div>
        </LedgerSheet>

        <LedgerSheet>
          <div className="border-b border-border px-[18px] py-3">
            <h2 className="flex items-center gap-2 text-[0.86rem] font-bold text-foreground">
              <FileSpreadsheet className="h-4 w-4 text-accent" aria-hidden="true" /> Options de l'Excel
            </h2>
          </div>
          <div className="grid gap-4 p-[18px] text-sm">
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={tableauSeul} onCheckedChange={(c) => setTableauSeul(Boolean(c))} className="mt-0.5" />
              <span>Tableaux seulement<span className="block text-xs text-muted-foreground">Seul le nécessaire est converti : les lignes du tableau (mouvements d'un relevé, balance, état). Titres, adresses, en-têtes et pieds de page sont écartés.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={nombres} onCheckedChange={(c) => setNombres(Boolean(c))} className="mt-0.5" />
              <span>Convertir les montants en nombres<span className="block text-xs text-muted-foreground">Sinon, ils restent du texte tel qu'imprimé.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={uneSeuleFeuille} onCheckedChange={(c) => setUneSeuleFeuille(Boolean(c))} className="mt-0.5" />
              <span>Toutes les pages dans une seule feuille<span className="block text-xs text-muted-foreground">Sinon, une feuille par page du PDF.</span></span>
            </label>
            <label className="flex flex-wrap items-center justify-between gap-2">
              <span>Compte de banque <span className="block text-xs text-muted-foreground">Utilisé par le fichier d'écritures (.txt).</span></span>
              <Input value={compte} onChange={(e) => setCompte(e.target.value)} className="h-8 w-36 text-sm" inputMode="numeric" />
            </label>
          </div>
        </LedgerSheet>
      </div>

      <div className="min-w-0 lg:self-stretch">
      <LedgerSheet data-tour="conversions-results" className="min-w-0 lg:sticky lg:top-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-3">
          <h2 className="text-[0.86rem] font-bold text-foreground">Aperçu</h2>
          <LedgerSegmented<Mode> value={mode} onChange={setMode} ariaLabel="Mode d'aperçu" options={[{ value: "pdf", label: "PDF" }, { value: "both", label: "Côte à côte" }, { value: "xls", label: "Excel" }]} />
        </div>
        {active && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-[18px] py-2.5" role="group" aria-label="Télécharger le fichier affiché">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Télécharger</span>
            <Button type="button" variant="outline" size="sm" aria-label="Télécharger l'Excel affiché" onClick={() => void telecharger(active)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button type="button" variant="outline" size="sm" aria-label="Télécharger le PDF affiché" onClick={() => void telechargerPdf(active)}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button type="button" variant="outline" size="sm" aria-label="Télécharger les écritures affichées" onClick={() => telechargerEcritures(active)}>
              <FileText className="h-3.5 w-3.5" /> Écritures (.txt)
            </Button>
            <Button type="button" variant="outline" size="sm" aria-label="Télécharger le texte brut affiché" onClick={() => telechargerTexte(active)}>
              <FileText className="h-3.5 w-3.5" /> Texte brut (.txt)
            </Button>
          </div>
        )}
        {active && feuille ? (
          <>
            {tableauSeul && modeDePdf(active.pages, options) === "complet" && (
              <p className="mx-[18px] mt-3 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive" role="alert">
                Aucun tableau reconnu dans ce document : il est converti en entier. Décochez « Tableaux seulement » si c'est voulu.
              </p>
            )}
            {feuilles.length > 1 && (
              <div className="px-[18px] pt-3">
                <LedgerSegmented value={String(activeSheet)} onChange={(v) => setActiveSheet(Number(v))} options={feuilles.map((f, i) => ({ value: String(i), label: f.name }))} ariaLabel="Choisir une feuille" />
              </div>
            )}
            <div className={cn("grid gap-3 p-[18px]", mode === "both" && "xl:grid-cols-2")}>
              {mode !== "xls" && (
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu PDF</p>
                  <iframe src={active.pdfUrl ? `${active.pdfUrl}${PARAMETRES_APERCU}` : undefined} title="Aperçu PDF" className="h-[560px] w-full rounded-lg border border-border bg-muted" />
                </div>
              )}
              {mode !== "pdf" && (
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu Excel — {pluriel(feuille.rows.length, "ligne")}</p>
                  <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {feuille.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} className={cn("whitespace-nowrap border border-border px-2 py-1", typeof cell === "number" && "text-right tabular-nums")}>
                                {typeof cell === "number" ? cell.toLocaleString("fr-FR", { maximumFractionDigits: 6 }) : String(cell ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            {ecrituresTexte && (
              <div className="border-t border-border p-[18px]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fichier .txt des écritures — {(ecritures?.length ?? 0) / 2} mouvements, deux lignes chacun
                </p>
                <pre aria-label="Aperçu du fichier texte" className="max-h-[320px] overflow-auto rounded-lg border border-border bg-secondary/30 p-3 font-mono text-[0.7rem] [tab-size:6]">
                  {ecrituresTexte}
                </pre>
              </div>
            )}
          </>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">Ajoutez un fichier, puis cliquez sur sa ligne pour voir l'aperçu.</p>
        )}
      </LedgerSheet>
      </div>

      {items.length > 0 && (
        <LedgerSheet className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-[18px] py-3">
            <h2 className="text-[0.86rem] font-bold text-foreground">File de conversion</h2>
            <div className="flex flex-wrap items-center gap-2">
              <TelechargerTout
                formats={FORMATS_PDF_VERS_EXCEL}
                valeur={formatGroupe}
                onValeur={setFormatGroupe}
                onTelecharger={() => void toutTelecharger()}
                disabled={items.filter((i) => i.status === "ok").length < 2}
                title={items.filter((i) => i.status === "ok").length < 2 ? "Disponible à partir de deux fichiers convertis" : "Télécharge chaque fichier dans le format choisi"}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setItems([]); setActiveId(null); }}>Vider la liste</Button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <div
                  role={item.status === "ok" ? "button" : undefined}
                  tabIndex={item.status === "ok" ? 0 : undefined}
                  onClick={() => { if (item.status === "ok") { setActiveId(item.id); setActiveSheet(0); } }}
                  onKeyDown={(e) => { if (item.status === "ok" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setActiveId(item.id); setActiveSheet(0); } }}
                  className={cn("flex flex-wrap items-center gap-3 border-l-4 px-[18px] py-2.5", item.status === "ok" ? "cursor-pointer border-l-success hover:bg-accent/10" : item.status === "erreur" ? "border-l-destructive" : "border-l-accent", activeId === item.id && "bg-accent/15")}
                >
                  {item.status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : item.status === "erreur" ? <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> : <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className={cn("text-xs", item.status === "erreur" ? "text-destructive" : "text-muted-foreground")}>{item.detail}</p>
                  </div>
                  {item.status === "ok" && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); telechargerEcritures(item); }}>
                        <FileText className="h-3.5 w-3.5" /> Écritures (.txt)
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); telechargerTexte(item); }}>
                        <FileText className="h-3.5 w-3.5" /> Texte brut (.txt)
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); void telechargerPdf(item); }}>
                        <Download className="h-3.5 w-3.5" /> Télécharger le PDF
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); void telecharger(item); }}>
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Télécharger l'Excel
                      </Button>
                    </div>
                  )}
                  {item.status === "erreur" && (
                    <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); reessayer(item); }}>
                      <RotateCcw className="h-3.5 w-3.5" /> Réessayer
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Retirer ${item.name}`} onClick={(e) => { e.stopPropagation(); retirer(item.id); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </LedgerSheet>
      )}
    </div>
  );
}
