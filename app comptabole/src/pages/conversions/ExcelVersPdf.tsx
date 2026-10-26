import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, FileText, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { feuillesDeClasseur } from "@/lib/classeurFeuilles";
import { download } from "@/lib/export";
import { fichierConverti, FORMATS_SORTIE, type FormatSortie } from "@/lib/conversionSortie";
import { lireTamponClasseur, messageImport } from "@/lib/fichierImport";
import { texteDepuisFeuilles } from "@/lib/texteBrut";
import { buildTablesPdf, type PdfSheet } from "@/lib/pdfTables";
import { detecterTableaux } from "@/lib/tableaux";
import { cn } from "@/lib/utils";
import { TelechargerTout } from "./TelechargerTout";
import { ZoneDepot } from "./ZoneDepot";
import type { StatsConversion } from "./types";
import { useIdentiteCabinet } from "./useIdentiteCabinet";

type Mode = "pdf" | "both" | "xls";

interface ConvItem {
  id: string;
  file: File;
  name: string;
  baseName: string;
  status: "cours" | "ok" | "erreur";
  detail: string;
  sheets: PdfSheet[];
  /** Tableaux repérés dans les feuilles (titres, adresses, mentions et lignes isolées écartés). */
  tableaux: PdfSheet[];
  /** Noms des tableaux ou feuilles écartés de la conversion. */
  exclues: string[];
}

/** Le PDF s'ouvre sans volet de miniatures, ajusté à la largeur de la zone d'aperçu. */
const PARAMETRES_APERCU = "#navpanes=0&view=FitH";

/** Lit toutes les feuilles d'un classeur Excel (contrôle commun de lireTamponClasseur, puis lecture qui garde les dates). */
async function readSheets(file: File): Promise<PdfSheet[]> {
  return feuillesDeClasseur(await lireTamponClasseur(file, { formats: ["xlsx", "xls"] }));
}

/** Les tableaux de toutes les feuilles, nommés par leur titre (précédé du nom de la feuille quand il y en a plusieurs) et uniques. */
function construireTableaux(sheets: PdfSheet[]): PdfSheet[] {
  const pris = new Set<string>();
  return sheets.flatMap((sheet) =>
    detecterTableaux(sheet.rows).map((t) => {
      const base = sheets.length > 1 ? `${sheet.name} · ${t.nom}` : t.nom;
      let nom = base;
      for (let i = 2; pris.has(nom); i++) nom = `${base} (${i})`;
      pris.add(nom);
      return { name: nom, rows: t.rows, headerRow: true };
    }),
  );
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
/** Ce qui peut être converti : les tableaux repérés, ou les feuilles entières (aucun tableau reconnu, ou mode « feuilles entières »). */
const unites = (i: ConvItem, seulementTableaux: boolean) => (seulementTableaux && i.tableaux.length > 0 ? i.tableaux : i.sheets);
const retenues = (i: ConvItem, seulementTableaux: boolean) => unites(i, seulementTableaux).filter((s) => !i.exclues.includes(s.name));

/** Excel vers PDF : lecture locale du classeur, options du PDF, aperçu qui suit les options, téléchargement par fichier ou regroupé. */
export function ExcelVersPdf({ onStats }: { onStats: (s: StatsConversion) => void }) {
  const [items, setItems] = useState<ConvItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [mode, setMode] = useState<Mode>("both");
  // En comptabilité on ne convertit que le nécessaire : les tableaux, pas les titres, adresses ni mentions qui les entourent.
  const [seulementTableaux, setSeulementTableaux] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfErreur, setPdfErreur] = useState(false);
  const [formatGroupe, setFormatGroupe] = useState<FormatSortie>("pdf");
  const [modele, setModele] = useState(true);
  const occupe = items.some((i) => i.status === "cours");

  const active = items.find((i) => i.id === activeId && i.status === "ok") ?? null;
  const unitesActives = active ? unites(active, seulementTableaux) : [];
  const activeSheetData = unitesActives[Math.min(activeSheet, unitesActives.length - 1)] ?? null;
  const aucunTableau = Boolean(active) && seulementTableaux && active!.tableaux.length === 0;
  const { logo, cabinet } = useIdentiteCabinet();
  const optionsPdf = useMemo(() => ({ logo, cabinet, mention: "Document converti" }), [logo, cabinet]);

  useEffect(() => {
    const ok = items.filter((i) => i.status === "ok");
    onStats({ fichiers: items.length, convertis: ok.length, erreurs: items.filter((i) => i.status === "erreur").length, elements: ok.reduce((n, i) => n + retenues(i, seulementTableaux).length, 0), libelleElements: seulementTableaux ? "Tableaux" : "Feuilles" });
  }, [items, onStats, seulementTableaux]);

  async function fabriquer(entrees: ConvItem[]) {
    const multi = entrees.length > 1;
    const sheets = entrees.flatMap((e) => retenues(e, seulementTableaux).map((s) => ({ ...s, name: multi ? `${e.baseName} · ${s.name}` : s.name })));
    if (sheets.length === 0) return null;
    return buildTablesPdf({
      title: multi ? "Conversions regroupées" : entrees[0].baseName,
      subtitle: `${pluriel(sheets.length, seulementTableaux ? "tableau" : "feuille")} · converti le ${new Date().toLocaleDateString("fr-FR")}`,
      enchainer: true,
      sheets,
      fileName: `${multi ? "conversions" : entrees[0].baseName}.pdf`,
      plain: true,
      ...optionsPdf,
    });
  }

  // L'aperçu PDF est reconstruit à chaque changement d'option, de fichier ou de feuille retenue.
  useEffect(() => {
    if (!active) {
      setPdfUrl(null);
      return;
    }
    let annule = false;
    let courante: string | null = null;
    setPdfErreur(false);
    void fabriquer([active])
      .then((doc) => {
        if (annule) return;
        if (!doc) {
          setPdfUrl(null);
          return;
        }
        courante = URL.createObjectURL(doc.output("blob"));
        setPdfUrl(courante);
      })
      .catch(() => !annule && setPdfErreur(true));
    return () => {
      annule = true;
      if (courante) URL.revokeObjectURL(courante);
    };
    // fabriquer ne dépend que de optionsPdf et de l'élément actif
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, optionsPdf, seulementTableaux]);

  async function convertir(fichiers: File[]) {
    const nouveaux: ConvItem[] = fichiers.map((file) => ({
      id: crypto.randomUUID(), file, name: file.name, baseName: file.name.replace(/\.xlsx?$/i, ""), status: "cours", detail: "Lecture du classeur…", sheets: [], tableaux: [], exclues: [],
    }));
    setItems((prev) => [...nouveaux, ...prev]);
    let premier: string | null = null;
    let echecs = 0;
    for (const n of nouveaux) {
      let maj: Partial<ConvItem>;
      try {
        const sheets = await readSheets(n.file);
        const tableaux = construireTableaux(sheets);
        maj = sheets.length === 0
          ? { status: "erreur", detail: "Fichier vide" }
          : { status: "ok", sheets, tableaux, detail: tableaux.length > 0 ? `${pluriel(tableaux.length, "tableau")} reconnu${tableaux.length > 1 ? "s" : ""} dans ${pluriel(sheets.length, "feuille")}` : `${pluriel(sheets.length, "feuille")} lue${sheets.length > 1 ? "s" : ""} · aucun tableau reconnu` };
      } catch (err) {
        maj = { status: "erreur", detail: messageImport(err, "Fichier illisible — export Excel (.xlsx) attendu") };
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

  function reessayer(item: ConvItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    void convertir([item.file]);
  }

  function retirer(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function basculerFeuille(item: ConvItem, nom: string) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, exclues: i.exclues.includes(nom) ? i.exclues.filter((n) => n !== nom) : [...i.exclues, nom] } : i)));
  }

  async function telecharger(entrees: ConvItem[]) {
    try {
      const doc = await fabriquer(entrees);
      if (!doc) {
        toast.error("Rien à convertir : cochez au moins un tableau");
        return;
      }
      doc.save(entrees.length > 1 ? "conversions.pdf" : `${entrees[0].baseName}.pdf`);
    } catch {
      toast.error("Le PDF n'a pas pu être créé");
    }
  }

  function telechargerTexte(item: ConvItem) {
    const feuilles = retenues(item, seulementTableaux);
    if (feuilles.length === 0) {
      toast.error("Rien à convertir : cochez au moins un tableau");
      return;
    }
    download(new Blob([texteDepuisFeuilles(feuilles)], { type: "text/plain;charset=utf-8" }), `${item.baseName}.txt`);
  }

  /** Le même contenu (les tableaux retenus) en Excel : un classeur, une feuille par tableau. */
  async function telechargerExcel(item: ConvItem) {
    const feuilles = retenues(item, seulementTableaux);
    if (feuilles.length === 0) {
      toast.error("Rien à convertir : cochez au moins un tableau");
      return;
    }
    try {
      const { blob, nom } = await fichierConverti("xlsx", feuilles, item.baseName, { modele, identite: { logo, cabinet } });
      download(blob, nom);
    } catch {
      toast.error("Le fichier Excel n'a pas pu être créé");
    }
  }

  async function telechargerFormat(item: ConvItem, format: FormatSortie) {
    if (format === "pdf") await telecharger([item]);
    else if (format === "xlsx") await telechargerExcel(item);
    else telechargerTexte(item);
  }

  async function toutTelecharger() {
    const prets = items.filter((i) => i.status === "ok" && retenues(i, seulementTableaux).length > 0);
    for (const p of prets) await telechargerFormat(p, formatGroupe);
  }

  const prets = items.filter((i) => i.status === "ok");
  const feuilleVisible = active ? retenues(active, seulementTableaux).length > 0 : false;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
      <div className="grid min-w-0 gap-4">
        <LedgerSheet>
          <div className="border-b border-border px-[18px] py-3">
            <h2 className="text-[0.86rem] font-bold text-foreground">Fichiers à convertir</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Les fichiers restent dans cette page : ils disparaissent à sa fermeture.</p>
          </div>
          <div className="p-[18px]">
            <ZoneDepot accept=".xlsx,.xls" extensions={["xlsx", "xls"]} types=".xlsx / .xls" occupe={occupe} libelleOccupe="Conversion en cours…" onFiles={(f) => void convertir(f)} />
          </div>
        </LedgerSheet>

        <LedgerSheet>
          <div className="border-b border-border px-[18px] py-3">
            <h2 className="text-[0.86rem] font-bold text-foreground">Tableaux à convertir</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Seul le nécessaire est converti : les tableaux. Les titres, adresses, mentions et lignes isolées qui les entourent sont laissés de côté.</p>
          </div>
          <div className="grid gap-4 p-[18px] text-sm">
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={seulementTableaux} onCheckedChange={(c) => setSeulementTableaux(Boolean(c))} className="mt-0.5" />
              <span>Tableaux seulement<span className="block text-xs text-muted-foreground">Décochez pour convertir les feuilles entières, telles quelles.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={modele} onCheckedChange={(c) => setModele(Boolean(c))} className="mt-0.5" />
              <span>Modèle du cabinet pour l'Excel<span className="block text-xs text-muted-foreground">Titre, bandeau d'en-têtes bleu, lignes alternées, dates et montants formatés, comme les tableaux de Collecte. Décochez pour un classeur simple.</span></span>
            </label>
            {aucunTableau && <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning" role="status">Aucun tableau reconnu dans ce fichier : les feuilles entières sont converties.</p>}
            {active && unitesActives.length > 1 && (
              <div>
                <p className="mb-1.5">{seulementTableaux && !aucunTableau ? "Tableaux" : "Feuilles"} à inclure <span className="text-xs text-muted-foreground">— {active.name}</span></p>
                <ul className="max-h-72 space-y-1 overflow-auto">
                  {unitesActives.map((u) => {
                    const incluse = !active.exclues.includes(u.name);
                    const lignes = Math.max(0, u.rows.length - 1);
                    return (
                      <li key={u.name}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-accent/10">
                          <Checkbox checked={incluse} onCheckedChange={() => basculerFeuille(active, u.name)} aria-label={u.name} />
                          <span className="min-w-0 flex-1 truncate">{u.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{lignes} ligne{lignes > 1 ? "s" : ""} · {Math.max(...u.rows.map((r) => r.length))} col.</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
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
            <Button type="button" variant="outline" size="sm" aria-label="Télécharger le PDF affiché" onClick={() => void telecharger([active])}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button type="button" variant="outline" size="sm" aria-label="Télécharger l'Excel affiché" onClick={() => void telechargerExcel(active)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button type="button" variant="outline" size="sm" aria-label="Télécharger le texte affiché" onClick={() => telechargerTexte(active)}>
              <FileText className="h-3.5 w-3.5" /> Texte (.txt)
            </Button>
          </div>
        )}
        {active && activeSheetData ? (
          <>
            {unitesActives.length > 1 && (
              <div className="px-[18px] pt-3">
                <LedgerSegmented value={String(activeSheet)} onChange={(v) => setActiveSheet(Number(v))} options={unitesActives.map((s, i) => ({ value: String(i), label: s.name }))} ariaLabel="Choisir un tableau" />
              </div>
            )}
            <div className={cn("grid gap-3 p-[18px]", mode === "both" && "xl:grid-cols-2")}>
              {mode !== "pdf" && (
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu Excel</p>
                  <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {activeSheetData.rows.map((row, ri) => (
                          <tr key={ri} className={ri === 0 && activeSheetData.headerRow ? "bg-muted/60 font-semibold" : ""}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="whitespace-nowrap border border-border px-2 py-1">{String(cell ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {mode !== "xls" && (
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu PDF</p>
                  {pdfErreur ? (
                    <p className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive" role="alert">L'aperçu n'a pas pu être préparé.</p>
                  ) : !feuilleVisible ? (
                    <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Rien à convertir : cochez au moins un tableau.</p>
                  ) : pdfUrl ? (
                    <iframe src={`${pdfUrl}${PARAMETRES_APERCU}`} title="Aperçu PDF" className="h-[560px] w-full rounded-lg border border-border bg-muted" />
                  ) : (
                    <p className="flex h-[560px] items-center justify-center gap-2 rounded-lg border border-border text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Préparation de l'aperçu…</p>
                  )}
                </div>
              )}
            </div>
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
            <div className="flex flex-wrap gap-2">
              <TelechargerTout
                formats={FORMATS_SORTIE}
                valeur={formatGroupe}
                onValeur={setFormatGroupe}
                onTelecharger={() => void toutTelecharger()}
                disabled={prets.length < 2}
                title={prets.length < 2 ? "Disponible à partir de deux fichiers convertis" : "Télécharge chaque fichier dans le format choisi"}
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
                  className={cn("flex items-center gap-3 border-l-4 px-[18px] py-2.5", item.status === "ok" ? "cursor-pointer border-l-success hover:bg-accent/10" : item.status === "erreur" ? "border-l-destructive" : "border-l-accent", activeId === item.id && "bg-accent/15")}
                >
                  {item.status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : item.status === "erreur" ? <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> : <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className={cn("text-xs", item.status === "erreur" ? "text-destructive" : "text-muted-foreground")}>{item.detail}</p>
                  </div>
                  {item.status === "ok" && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); telechargerTexte(item); }}>
                        <FileText className="h-3.5 w-3.5" /> Texte (.txt)
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); void telechargerExcel(item); }}>
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Télécharger l'Excel
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); void telecharger([item]); }}>
                        <Download className="h-3.5 w-3.5" /> Télécharger le PDF
                      </Button>
                    </>
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
